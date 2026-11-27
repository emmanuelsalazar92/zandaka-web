import { z } from "zod"

import { PLAN_USER_ID, PlanApiError, planRequest } from "@/lib/budget-plan-api"
import { parseTransactionDetail } from "@/lib/transaction-detail"

const id = z.number().int().positive().safe()
const amount = z.string().regex(/^\d+(?:\.\d+)?$/)
const currency = z.enum(["USD", "CRC"])
const movement = z.object({
  id,
  date: z.string(),
  accountId: id,
  accountName: z.string().nullable(),
  envelopeId: id,
  amount,
  currency,
})
const step = z.object({
  key: z.string(),
  kind: z.enum(["fx", "transfer", "payment"]),
  label: z.string(),
  planned: amount,
  currency,
  fromAccountId: id,
  alternateFromAccountId: id.optional(),
  fromEnvelopeId: id.nullable(),
  toAccountId: id.nullable(),
  toEnvelopeId: id.nullable(),
  evidence: z
    .object({
      current: z.boolean(),
      movements: z.array(movement).min(1).max(2),
      rate: amount.nullable(),
    })
    .nullable(),
})
const monthStart = z.object({
  planId: z.guid(),
  revision: id,
  steps: z.array(step),
  detachedCount: z.number().int().nonnegative(),
})
export type MonthStartStep = z.infer<typeof step>
export type MonthStart = z.infer<typeof monthStart>

export async function requestMonthStart(
  planId: string,
  revision: number,
  link?: { step: MonthStartStep; movementIds: number[] },
  signal?: AbortSignal,
) {
  const raw = await planRequest(
    `/${planId}/month-start${link ? "/link" : ""}`,
    link ? "PUT" : "GET",
    link
      ? { userId: PLAN_USER_ID, revision, step: link.step.key, movementIds: link.movementIds }
      : undefined,
    signal,
  )
  const result = monthStart.safeParse(raw)
  if (!result.success || result.data.planId !== planId || result.data.revision !== revision)
    throw new PlanApiError(409, "CONFLICT", !!link)
  if (link) {
    const evidence = result.data.steps.find((item) => item.key === link.step.key)?.evidence
    const ids = [...new Set(evidence?.movements.map((item) => item.id))]
    if (
      !evidence?.current ||
      ids.length !== link.movementIds.length ||
      ids.some((id, index) => id !== link.movementIds[index])
    )
      throw new PlanApiError(0, "INVALID_REPLY", true)
  }
  return result.data
}

export async function loadMonthStartMovement(transactionId: number, signal: AbortSignal) {
  const response = await fetch(`/api/transactions/${transactionId}?userId=${PLAN_USER_ID}`, {
    cache: "no-store",
    signal,
  })
  if (!response.ok) throw new Error("No pudimos consultar ese movimiento.")
  return parseTransactionDetail(await response.json(), transactionId, PLAN_USER_ID)
}
