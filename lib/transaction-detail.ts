import { z } from "zod"

import { formatSignedCurrency } from "@/lib/currency-formatter"
import { sumMoney } from "@/lib/money"

const id = z.number().int().positive().safe()
const detailSchema = z.object({
  id,
  userId: id,
  date: z.string(),
  description: z.string(),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER", "ADJUSTMENT"]),
  createdAt: z.string().nullable(),
  correction: z.object({
    available: z.literal(false),
    reason: z.literal("NO_AUDITED_CORRECTION_FLOW"),
  }),
  lines: z.array(
    z.object({
      id,
      accountId: id,
      accountName: z.string().nullable(),
      accountCurrency: z.string().nullable(),
      institutionName: z.string().nullable(),
      envelopeId: id,
      categoryName: z.string().nullable(),
      envelopeActive: z.boolean().nullable(),
      amount: z.number().finite(),
    }),
  ),
})

export type TransactionDetail = z.infer<typeof detailSchema>

export function parseTransactionDetail(value: unknown, transactionId: number, userId: number) {
  const detail = detailSchema.parse(value)
  if (
    detail.id !== transactionId ||
    detail.userId !== userId ||
    new Set(detail.lines.map((line) => line.id)).size !== detail.lines.length
  ) {
    throw new Error("Inconsistent transaction detail")
  }
  return detail
}

export function detailAmount(amount: number, currency: string | null) {
  if (currency) {
    try {
      return formatSignedCurrency(amount, currency)
    } catch {
      /* Keep the amount without inventing a currency. */
    }
  }
  const sign = amount > 0 ? "+" : amount < 0 ? "−" : ""
  return `${sign}${Math.abs(amount).toLocaleString("es-CR", { maximumFractionDigits: 20 })} · Moneda no disponible`
}

/** Group without mixing currencies or netting transfers into an apparent zero expense. */
export function detailTotals(detail: TransactionDetail) {
  const groups = new Map<
    string,
    { currency: string; direction: "out" | "in" | "net"; values: number[] }
  >()
  if (!detail.lines.length || detail.lines.some((line) => !line.accountCurrency)) return null
  for (const line of detail.lines) {
    const direction =
      detail.type === "TRANSFER"
        ? line.amount < 0
          ? "out"
          : line.amount > 0
            ? "in"
            : "net"
        : "net"
    const currency = line.accountCurrency!
    const key = `${currency}:${direction}`
    const group = groups.get(key) ?? { currency, direction, values: [] }
    group.values.push(line.amount)
    groups.set(key, group)
  }
  try {
    return Array.from(groups.values(), ({ currency, direction, values }) => ({
      currency,
      direction,
      amount: sumMoney(values),
    }))
  } catch {
    return null
  }
}
