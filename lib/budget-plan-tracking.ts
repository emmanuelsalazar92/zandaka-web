import { z } from "zod"

import { planRequest } from "@/lib/budget-plan-api"
import { dashboardMonthRange } from "@/lib/dashboard-period"

const id = z.number().int().positive().safe()
const amount = z.string().regex(/^\d+(?:\.\d+)?$/)
const schema = z.object({
  planId: z.guid(),
  revision: id,
  month: z.string(),
  from: z.iso.date(),
  to: z.iso.date(),
  fundingStatus: z.enum(["confirmed", "pending", "unverified"]),
  fundingDate: z.iso.date().nullable(),
  unmappedCount: z.number().int().nonnegative(),
  rows: z.array(
    z.object({
      envelopeId: id,
      accountId: id,
      accountName: z.string(),
      categoryName: z.string(),
      currency: z.enum(["CRC", "USD"]),
      active: z.boolean(),
      hasPlan: z.boolean(),
      planned: amount.nullable(),
      assigned: amount.nullable(),
      spent: amount,
    }),
  ),
})
export type BudgetTracking = z.infer<typeof schema>

export async function loadBudgetTracking(planId: string, month: string, signal: AbortSignal) {
  const result = schema.parse(await planRequest(`/${planId}/tracking`, "GET", undefined, signal))
  const range = dashboardMonthRange(month)
  if (
    result.planId !== planId ||
    result.month !== month ||
    result.from !== range.from ||
    result.to !== range.to ||
    new Set(result.rows.map((row) => row.envelopeId)).size !== result.rows.length ||
    (result.fundingStatus === "confirmed") !== (result.fundingDate !== null) ||
    result.rows.some((row) => (result.fundingStatus === "unverified") !== (row.assigned === null))
  ) {
    throw new Error("Inconsistent budget tracking")
  }
  return result
}
