import { afterEach, describe, expect, it, vi } from "vitest"

import { fetchDashboardPeriod, fetchDashboardSummary } from "@/lib/dashboard-api"
import { dashboardMonthRange, dashboardSpending } from "@/lib/dashboard-period"
import { dashboardHistoryFilters, historyQuery } from "@/lib/transaction-history"
import { getTimelineAmounts } from "@/lib/transaction-timeline"

afterEach(() => vi.unstubAllGlobals())
const movement = {
  id: 1,
  userId: 1,
  date: "2026-11-01",
  description: "Transferencia",
  type: "TRANSFER",
  lines: [
    { accountId: 1, envelopeId: 1, accountCurrency: "USD", amount: -12.5 },
    { accountId: 2, envelopeId: 2, accountCurrency: "USD", amount: 12.5 },
  ],
}
function transport(expenses: unknown = [], transactions: unknown = [movement]) {
  const requests: string[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requests.push(url)
      if (url.startsWith("/api/reports/monthly-expenses")) return Response.json(expenses)
      return Response.json({
        data: transactions,
        meta: {
          page: 1,
          pageSize: 10,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      })
    }),
  )
  return requests
}
describe("dashboard period and navigation", () => {
  it("uses inclusive calendar bounds including leap years and rejects invalid months", () => {
    expect(dashboardMonthRange("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" })
    expect(dashboardMonthRange("2026-12").to).toBe("2026-12-31")
    for (const month of ["2026-13", "2026-00", "2026-2", "0000-01", "2026-11&x=1"])
      expect(() => dashboardMonthRange(month)).toThrow()
  })
  it("sends the same month to both reads and derives transfer directions from returned lines", async () => {
    const reads = transport()
    const result = await fetchDashboardPeriod("2026-11")
    expect(reads).toHaveLength(2)
    expect(reads[0]).toContain("month=2026-11&type=EXPENSE")
    const params = new URL(reads[1], "http://local.test").searchParams
    expect([params.get("from"), params.get("to")]).toEqual(["2026-11-01", "2026-11-30"])
    expect(getTimelineAmounts(result.transactions![0])).toEqual([
      { currency: "USD", direction: "out", amount: -12.5 },
      { currency: "USD", direction: "in", amount: 12.5 },
    ])
  })
  it("keeps a valid source available when the other response is malformed or outside its period", async () => {
    transport({}, [movement])
    const first = await fetchDashboardPeriod("2026-11")
    expect(first.expenses).toBeNull()
    expect(first.transactions).toHaveLength(1)
    transport([], [{ ...movement, date: "2026-10-31" }])
    const second = await fetchDashboardPeriod("2026-11")
    expect(second.expenses).toEqual([])
    expect(second.transactions).toBeNull()
  })
  it("never converts malformed or duplicate expense rows into zero or a believable distribution", async () => {
    const row = { categoryId: 1, categoryName: "Casa", currency: "CRC", total: -10 }
    for (const rows of [
      [row, row],
      [{ ...row, total: 10 }],
      [{ ...row, total: -0.001 }],
      [{ ...row, currency: "XXX" }],
    ]) {
      transport(rows)
      expect((await fetchDashboardPeriod("2026-11")).expenses).toBeNull()
    }
  })
  it("has an independent denominator for each currency and includes all categories", () => {
    const groups = dashboardSpending([
      { categoryId: 1, categoryName: "A", currency: "CRC", total: -0.1 },
      { categoryId: 2, categoryName: "B", currency: "CRC", total: -0.2 },
      { categoryId: 1, categoryName: "A", currency: "USD", total: -100 },
    ])
    expect(groups.map((group) => [group.currency, group.total])).toEqual([
      ["CRC", 0.3],
      ["USD", 100],
    ])
    expect(groups[0].rows.map((row) => row.share)).toEqual([66.67, 33.33])
    expect(groups[1].rows[0].share).toBe(100)
  })
  it("opens the exact month or envelope history without applying the month to current negative balances", () => {
    const period = dashboardHistoryFilters(
      new URLSearchParams("source=dashboard&month=2026-11&type=EXPENSE"),
    )!
    expect(historyQuery(period, 1, 10, 1)).toContain("from=2026-11-01&to=2026-11-30&type=EXPENSE")
    const envelope = dashboardHistoryFilters(
      new URLSearchParams("source=dashboard&accountId=2&categoryId=3"),
    )!
    expect(envelope).toMatchObject({ accountId: "2", envelopeId: "3", dateFrom: "", dateTo: "" })
    for (const value of [
      "source=other&month=2026-11",
      "source=dashboard&month=2026-13",
      "source=dashboard&accountId=NaN&categoryId=3",
      "source=dashboard&month=2026-11&type=BAD",
    ])
      expect(dashboardHistoryFilters(new URLSearchParams(value))).toBeNull()
  })
  it("does not label malformed successful balance responses as a complete zero", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({})),
    )
    const result = await fetchDashboardSummary()
    expect(result.balancesAvailable).toBe(false)
    expect(result.settingsAvailable).toBe(false)
    expect(result.negativeEnvelopesAvailable).toBe(false)
    expect(result.inconsistenciesAvailable).toBe(false)
  })
})
