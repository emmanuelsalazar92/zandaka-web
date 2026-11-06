import { z } from "zod"

import { dashboardMonthRange, dashboardSpending } from "@/lib/dashboard-period"
import { getAccountingDate } from "@/lib/date-only"
import { assertMoney } from "@/lib/money"
import { SETTINGS_USER_ID } from "@/lib/settings-api"
import { parseHistory } from "@/lib/transaction-history"
import type { TimelineTransaction } from "@/lib/transaction-timeline"

const id = z.number().int().positive().safe()
const currency = z.enum(["CRC", "USD"])
const amount = z.number().finite()
const monthlyExpense = z.object({
  categoryId: id,
  categoryName: z.string(),
  currency,
  total: amount.nonpositive(),
})
const negativeEnvelope = z.object({
  envelopeId: id,
  accountId: id,
  accountName: z.string(),
  currency,
  categoryId: id,
  categoryName: z.string(),
  balance: amount.negative(),
})
const inconsistency = z.object({
  accountId: id,
  accountName: z.string(),
  currency,
  reconciliationDate: z.string(),
  realBalance: amount,
  calculatedBalance: amount,
  difference: amount,
})
const exchangeRate = z.object({ compra: amount, venta: amount, fecha: z.string() })
export type DashboardMonthlyExpense = z.infer<typeof monthlyExpense>
export type DashboardNegativeEnvelope = z.infer<typeof negativeEnvelope>
export type DashboardInconsistency = z.infer<typeof inconsistency>
export type DashboardExchangeRate = z.infer<typeof exchangeRate>
export type DashboardSummary = {
  balancesAvailable: boolean
  currencyAvailable: { CRC: boolean; USD: boolean }
  settingsAvailable: boolean
  negativeEnvelopesAvailable: boolean
  inconsistenciesAvailable: boolean
  totals: { CRC: number; USD: number }
  preferredCurrency: "CRC" | "USD"
  exchangeRate: DashboardExchangeRate | null
  negativeEnvelopes: DashboardNegativeEnvelope[]
  inconsistencies: DashboardInconsistency[]
  warnings: string[]
}
export type DashboardPeriod = {
  expenses: DashboardMonthlyExpense[] | null
  transactions: TimelineTransaction[] | null
}

/** Bounded read with cancellation; failures are unavailable data, never a confirmed zero. */
async function request(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(`/api${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
      : AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error("No pudimos consultar esta información.")
  return response.json()
}

export async function fetchDashboardSummary(userId = SETTINGS_USER_ID): Promise<DashboardSummary> {
  const [year, month, day] = getAccountingDate().split("-").map(Number)
  const [crc, usd, negatives, differences, settings, rate] = await Promise.allSettled([
    request("/reports/envelope-total?currency=CRC").then((value) => {
      const result = z.object({ currency: z.literal("CRC"), total: amount }).parse(value)
      return assertMoney(result.total, "CRC")
    }),
    request("/reports/envelope-total?currency=USD").then((value) => {
      const result = z.object({ currency: z.literal("USD"), total: amount }).parse(value)
      return assertMoney(result.total, "USD")
    }),
    request("/reports/negative-envelopes").then((value) => {
      const rows = z.array(negativeEnvelope).parse(value)
      rows.forEach((row) => assertMoney(row.balance, row.currency))
      return rows
    }),
    request("/reports/active-inconsistencies").then((value) => {
      const rows = z.array(inconsistency).parse(value)
      rows.forEach((row) =>
        [row.realBalance, row.calculatedBalance, row.difference].forEach((value) =>
          assertMoney(value, row.currency),
        ),
      )
      return rows
    }),
    request(`/users/${userId}`).then((value) => {
      const user = z
        .object({ baseCurrency: currency.optional(), base_currency: currency.optional() })
        .parse(value)
      return currency.parse(user.baseCurrency ?? user.base_currency)
    }),
    request(`/exchange-rate/${day}/${month}/${year}`).then((value) => exchangeRate.parse(value)),
  ])
  return {
    balancesAvailable: crc.status === "fulfilled" && usd.status === "fulfilled",
    currencyAvailable: { CRC: crc.status === "fulfilled", USD: usd.status === "fulfilled" },
    settingsAvailable: settings.status === "fulfilled",
    negativeEnvelopesAvailable: negatives.status === "fulfilled",
    inconsistenciesAvailable: differences.status === "fulfilled",
    totals: {
      CRC: crc.status === "fulfilled" ? crc.value : 0,
      USD: usd.status === "fulfilled" ? usd.value : 0,
    },
    preferredCurrency: settings.status === "fulfilled" ? settings.value : "CRC",
    exchangeRate: rate.status === "fulfilled" ? rate.value : null,
    negativeEnvelopes: negatives.status === "fulfilled" ? negatives.value : [],
    inconsistencies: differences.status === "fulfilled" ? differences.value : [],
    warnings: [crc, usd, negatives, differences, settings, rate]
      .filter((result) => result.status === "rejected")
      .map(() => "Una fuente no está disponible."),
  }
}

export async function fetchDashboardPeriod(
  month: string,
  signal?: AbortSignal,
  userId = SETTINGS_USER_ID,
): Promise<DashboardPeriod> {
  const range = dashboardMonthRange(month)
  const query = new URLSearchParams({
    userId: String(userId),
    ...range,
    page: "1",
    pageSize: "10",
    sortBy: "date",
    sortDir: "desc",
  })
  const [expenses, transactions] = await Promise.allSettled([
    request(
      `/reports/monthly-expenses?${new URLSearchParams({ month, type: "EXPENSE" })}`,
      signal,
    ).then((value) => {
      const rows = z.array(monthlyExpense).parse(value)
      if (new Set(rows.map((row) => `${row.categoryId}:${row.currency}`)).size !== rows.length)
        throw new Error("Distribución duplicada")
      rows.forEach((row) => assertMoney(row.total, row.currency))
      dashboardSpending(rows)
      return rows
    }),
    request(`/transactions?${query}`, signal).then((value) => {
      const parsed = parseHistory(value, 1, 10, userId)
      if (parsed.data.some((row) => row.date < range.from || row.date > range.to))
        throw new Error("Actividad fuera del período")
      return parsed.data.slice(0, 5).map((row) => ({
        id: row.id,
        date: row.date,
        description: row.description,
        type: row.type,
        lines: row.lines.map((line) => ({
          accountId: line.accountId ?? line.account_id ?? 0,
          account: line.accountName ?? line.account_name ?? "Cuenta por identificar",
          envelopeId: line.envelopeId ?? line.envelope_id ?? 0,
          envelope: line.categoryName ?? line.category_name ?? "Sobre por identificar",
          accountCurrency: line.accountCurrency ?? line.account_currency ?? "",
          amount: line.amount,
        })),
      }))
    }),
  ])
  return {
    expenses: expenses.status === "fulfilled" ? expenses.value : null,
    transactions: transactions.status === "fulfilled" ? transactions.value : null,
  }
}
