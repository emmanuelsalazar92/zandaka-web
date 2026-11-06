import type { DashboardMonthlyExpense } from "@/lib/dashboard-api"
import { percentageFromAmount, sumMoney } from "@/lib/money"

export function dashboardMonthRange(month: string) {
  if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Elige un mes válido.")
  const [year, number] = month.split("-").map(Number)
  const last = new Date(Date.UTC(year, number, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${last}` }
}

export function dashboardMonthLabel(month: string) {
  return new Intl.DateTimeFormat("es-CR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(dashboardMonthRange(month).from + "T12:00:00Z"))
}

export function dashboardAccountId(value: string | null) {
  return value !== null && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value))
    ? value
    : null
}

/** A denominator per currency, across all categories; never compare USD against CRC. */
export function dashboardSpending(values: DashboardMonthlyExpense[]) {
  return (["CRC", "USD"] as const)
    .map((currency) => {
      const rows = values
        .filter((value) => value.currency === currency && value.total < 0)
        .sort((a, b) => a.total - b.total || a.categoryId - b.categoryId)
      const total = sumMoney(rows.map((row) => Math.abs(row.total)))
      return {
        currency,
        total,
        rows: rows.map((row) => ({
          ...row,
          amount: Math.abs(row.total),
          share: percentageFromAmount(Math.abs(row.total), total),
        })),
      }
    })
    .filter((group) => group.rows.length > 0)
}

export function dashboardHistoryLink(params: Record<string, string>) {
  return `/transactions?${new URLSearchParams({ source: "dashboard", ...params })}`
}
