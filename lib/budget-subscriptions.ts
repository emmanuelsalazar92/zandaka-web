import { z } from "zod"

import { PLAN_USER_ID, PlanApiError, planRequest } from "@/lib/budget-plan-api"

const id = z.number().int().positive().safe()
const amount = z.string().regex(/^-?\d+(?:\.\d+)?$/)
const currency = z.enum(["CRC", "USD"])
const roundUsd = z.enum(["none", "up"])
const definition = z.object({
  name: z.string(),
  amount,
  currency,
  payCurrency: currency,
  iva: amount,
  roundUsd,
})
const catalogItem = z.object({ id: z.guid(), revision: id, definition })
const forecast = z.object({
  lineId: z.guid(),
  name: z.string(),
  originalAmount: z.string(),
  originalCurrency: currency,
  iva: z.string(),
  currency,
  roundUsd,
  source: z.object({ id: z.guid(), revision: id }).nullable(),
  engineVersion: z.literal(1),
  buy: amount.nullable(),
  sell: amount.nullable(),
  quoteSource: z.string(),
  quoteDate: z.string(),
  envelopeId: id.nullable(),
  accountId: id.nullable(),
  accountName: z.string().nullable(),
  categoryName: z.string().nullable(),
  planned: amount.nullable(),
  reserveUsd: amount.nullable(),
  explanation: z.array(z.string()),
})
const receipt = z.object({
  transactionId: id,
  transactionLineId: id,
  date: z.string(),
  description: z.string(),
  amount,
  forecast,
  difference: amount,
  current: z.boolean(),
})
const occurrence = forecast.extend({ receipt: receipt.nullable() })
const result = z.object({
  planId: z.guid(),
  revision: id,
  month: z.string(),
  occurrences: z.array(occurrence),
  detachedCount: z.number().int().nonnegative(),
})
export type SubscriptionDefinition = z.infer<typeof definition>
export type SubscriptionCatalogItem = z.infer<typeof catalogItem>
export type SubscriptionOccurrence = z.infer<typeof occurrence>
export type SubscriptionPlan = z.infer<typeof result>

export const subscriptionChargeId = (value: string | string[] | undefined) =>
  typeof value === "string" && /^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(Number(value))
    ? Number(value)
    : undefined

export async function loadSubscriptionCatalog(signal: AbortSignal) {
  return z
    .object({ items: z.array(catalogItem) })
    .parse(await planRequest("/subscriptions", "GET", undefined, signal)).items
}

export async function saveSubscriptionDefinition(item: SubscriptionCatalogItem) {
  const payload = await planRequest(`/subscriptions/${item.id}`, "PUT", {
    userId: PLAN_USER_ID,
    revision: item.revision,
    definition: item.definition,
  })
  const parsed = catalogItem.safeParse(payload)
  if (
    !parsed.success ||
    parsed.data.id !== item.id ||
    (parsed.data.revision !== item.revision && parsed.data.revision !== item.revision + 1)
  )
    throw new PlanApiError(0, "INVALID_REPLY", true)
  return parsed.data
}

export async function loadSubscriptionPlan(planId: string, signal: AbortSignal) {
  const data = result.parse(await planRequest(`/${planId}/subscriptions`, "GET", undefined, signal))
  if (data.planId !== planId) throw new Error("Inconsistent subscription plan")
  return data
}

export async function linkSubscriptionCharge(
  plan: SubscriptionPlan,
  lineId: string,
  transactionId: number,
  transactionLineId: number,
) {
  const raw = await planRequest(`/${plan.planId}/subscriptions/${lineId}`, "PUT", {
    userId: PLAN_USER_ID,
    revision: plan.revision,
    transactionId,
    transactionLineId,
  })
  const parsed = result.safeParse(raw)
  if (
    !parsed.success ||
    parsed.data.planId !== plan.planId ||
    parsed.data.revision !== plan.revision
  )
    throw new PlanApiError(0, "INVALID_REPLY", true)
  const confirmed = parsed.data.occurrences.find((item) => item.lineId === lineId)?.receipt
  if (
    !confirmed?.current ||
    confirmed.transactionId !== transactionId ||
    confirmed.transactionLineId !== transactionLineId
  )
    throw new PlanApiError(0, "INVALID_REPLY", true)
  return parsed.data
}
