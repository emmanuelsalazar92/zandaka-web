import { describe, expect, it } from "vitest"

import type { DashboardSummary } from "@/lib/dashboard-api"
import { consolidatedDashboardBalance } from "@/lib/dashboard-summary"

const summary = (patch: Partial<DashboardSummary> = {}): DashboardSummary => ({
  balancesAvailable: true,
  negativeEnvelopesAvailable: true,
  inconsistenciesAvailable: true,
  monthlyExpensesAvailable: true,
  totals: { CRC: 100.01, USD: 0.02 },
  preferredCurrency: "CRC",
  exchangeRate: { compra: 500, venta: 510, fecha: "02/11/2026" },
  monthlyExpenses: [],
  recentTransactions: [],
  negativeEnvelopes: [],
  inconsistencies: [],
  warnings: [],
  ...patch,
})

describe("consolidated dashboard balance", () => {
  it("uses exact arithmetic and the correct buy rate for CRC", () => {
    expect(consolidatedDashboardBalance(summary())).toBe(110.01)
  })

  it("does not turn missing data into a complete zero or subtotal", () => {
    expect(consolidatedDashboardBalance(summary({ balancesAvailable: false }))).toBeNull()
    expect(consolidatedDashboardBalance(summary({ exchangeRate: null }))).toBeNull()
    expect(
      consolidatedDashboardBalance(summary({ exchangeRate: { compra: 0, venta: 510, fecha: "" } })),
    ).toBeNull()
  })

  it("can display a complete single-currency balance without a conversion", () => {
    expect(
      consolidatedDashboardBalance(
        summary({ totals: { CRC: 100.01, USD: 0 }, exchangeRate: null }),
      ),
    ).toBe(100.01)
  })

  it("uses the sell rate when presenting USD", () => {
    expect(
      consolidatedDashboardBalance(
        summary({ preferredCurrency: "USD", totals: { CRC: 510, USD: 1 } }),
      ),
    ).toBe(2)
  })
})
