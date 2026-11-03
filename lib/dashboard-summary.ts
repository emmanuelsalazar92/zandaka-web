import type { DashboardSummary } from "@/lib/dashboard-api"
import { convertMoney, sumMoney } from "@/lib/money"

/** Never present a partial or unavailable currency balance as a complete consolidated balance. */
export function consolidatedDashboardBalance(summary: DashboardSummary): number | null {
  if (!summary.balancesAvailable) return null
  const base = summary.preferredCurrency
  const foreign = base === "CRC" ? summary.totals.USD : summary.totals.CRC
  const rate = base === "CRC" ? summary.exchangeRate?.compra : summary.exchangeRate?.venta
  if (foreign !== 0 && (!rate || !Number.isFinite(rate) || rate <= 0)) return null
  return sumMoney([
    summary.totals[base],
    foreign === 0 ? 0 : convertMoney(foreign, rate!, base, base === "USD"),
  ])
}
