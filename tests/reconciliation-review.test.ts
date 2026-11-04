import { afterEach, describe, expect, it, vi } from "vitest"

import {
  fetchCashDenominationsForAccount,
  fetchActiveReconciliation,
  fetchExpectedTotalForAccount,
  fetchReconciliation,
  parseReconciliation,
} from "@/lib/reconciliation-api"
import {
  reconciliationAmount,
  reconciliationManualAmount,
  reconciliationMovementLink,
  reconciliationQuantities,
  reconciliationState,
  validReconciliationDate,
} from "@/lib/reconciliation-review"
import type { CashDenomination } from "@/lib/settings-api"
import { reconciliationHistoryFilters } from "@/lib/transaction-history"

const raw = () => ({
  id: 1,
  accountId: 1,
  currency: "USD",
  date: "2026-11-01",
  countMethod: "MANUAL_TOTAL",
  expectedTotal: 100.3,
  countedTotal: 99.3,
  difference: -1,
  status: "OPEN",
  isActive: 1,
  note: null,
  createdAt: null,
  closedAt: null,
})
const denominations: CashDenomination[] = [
  {
    id: 1,
    userId: 1,
    currency: "USD",
    value: 0.1,
    type: "COIN",
    label: "Pequeña",
    sortOrder: 1,
    isActive: true,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: 2,
    userId: 1,
    currency: "USD",
    value: 20,
    type: "BILL",
    label: "Veinte",
    sortOrder: 2,
    isActive: true,
    createdAt: "",
    updatedAt: "",
  },
]
afterEach(() => vi.unstubAllGlobals())
describe("guided reconciliation", () => {
  it("only treats a coded not-found active review as absence, not an unverified route response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: { code: "NOT_FOUND" } }), { status: 404 }),
        ),
    )
    await expect(fetchActiveReconciliation(1)).resolves.toBeNull()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Missing route", { status: 404 })),
    )
    await expect(fetchActiveReconciliation(1)).rejects.toThrow()
  })
  it("separates historical nonzero differences from an open problem", () => {
    const record = parseReconciliation({
      ...raw(),
      status: "BALANCED",
      isActive: 0,
      closedAt: "2026-11-02 01:00:00",
    })
    expect(reconciliationState(record)).toMatchObject({ label: "Conciliada", open: false })
    expect(reconciliationState(record).explanation).toContain("dato histórico")
    expect(record.difference).toBe(-1)
  })
  it("explains open, ignored and inactive legacy states without inventing a correction action", () => {
    expect(reconciliationState(parseReconciliation(raw()))).toMatchObject({
      label: "Abierta",
      open: true,
    })
    expect(
      reconciliationState(parseReconciliation({ ...raw(), status: "IGNORED", isActive: 0 })),
    ).toMatchObject({ label: "Ignorada", open: false })
    expect(
      reconciliationState(parseReconciliation({ ...raw(), status: "OPEN", isActive: 0 })),
    ).toMatchObject({ label: "Cerrada", open: false })
  })
  it("rejects missing monetary values, state, identity or invalid cutoff instead of making zero records", () => {
    for (const field of [
      "expectedTotal",
      "countedTotal",
      "difference",
      "status",
      "isActive",
      "id",
      "date",
    ]) {
      const value: Record<string, unknown> = raw()
      delete value[field]
      expect(() => parseReconciliation(value)).toThrow()
    }
    expect(() => parseReconciliation({ ...raw(), date: "2026-02-30" })).toThrow()
    expect(() => parseReconciliation({ ...raw(), difference: null })).toThrow()
  })
  it("retains a legitimate zero and never assigns CRC to an unknown currency", () => {
    const record = parseReconciliation({
      ...raw(),
      expectedTotal: 0,
      countedTotal: 0,
      difference: 0,
      currency: "",
    })
    expect(record.countedTotal).toBe(0)
    expect(record.currency).toBe("")
    expect(reconciliationAmount(2, "XYZ")).toContain("Moneda no disponible")
  })
  it("preserves stored denomination totals and deactivated denomination references", () => {
    const record = parseReconciliation({
      ...raw(),
      countMethod: "DENOMINATION_COUNT",
      lines: [
        {
          id: 1,
          reconciliationId: 1,
          denominationId: null,
          denominationValue: 0.1,
          denominationType: "COIN",
          denominationLabel: "Original",
          quantity: 3,
          lineTotal: 0.3,
          sortOrder: 0,
        },
      ],
    })
    expect(record.lines[0]).toMatchObject({
      denominationId: null,
      lineTotal: 0.3,
      quantity: 3,
      denominationLabel: "Original",
    })
    expect(() =>
      parseReconciliation({ ...raw(), lines: [{ ...record.lines[0], reconciliationId: 2 }] }),
    ).toThrow()
  })
  it("validates manual precision without stripping letters, thousands or exponents", () => {
    expect(reconciliationManualAmount("100.30", "USD").value).toBe(100.3)
    expect(reconciliationManualAmount("-0,02", "USD").value).toBe(-0.02)
    expect(reconciliationManualAmount("0", "USD").value).toBe(0)
    for (const value of ["", "1 000", "1,234.56", "x10", "1e2", "0.001"])
      expect(reconciliationManualAmount(value, "USD").value).toBeNull()
  })
  it("counts exact denominations and preserves invalid quantities for correction", () => {
    expect(reconciliationQuantities(denominations, { 1: "3", 2: "5" })).toMatchObject({
      total: 100.3,
      subtotals: { 1: 0.3, 2: 100 },
      lines: [
        { denominationId: 1, quantity: 3 },
        { denominationId: 2, quantity: 5 },
      ],
    })
    for (const quantity of ["-2", "1.5", "1e2", "x2", "9007199254740992"]) {
      const result = reconciliationQuantities(denominations, { 1: quantity })
      expect(result.total).toBeNull()
      expect(result.errors[1]).toBeTruthy()
    }
    expect(reconciliationQuantities(denominations, { 1: "0", 2: "" }).total).toBe(0)
  })
  it("validates calendar cutoff and navigation scope without invented period starts", () => {
    expect(validReconciliationDate("2024-02-29")).toBe(true)
    expect(validReconciliationDate("2026-02-29")).toBe(false)
    const href = reconciliationMovementLink(2, "2026-11-01")!
    expect(reconciliationHistoryFilters(new URL(href, "http://local").searchParams)).toMatchObject({
      accountId: "2",
      dateTo: "2026-11-01",
      dateFrom: "",
    })
    expect(
      reconciliationHistoryFilters(
        new URLSearchParams("source=reconciliation&accountId=1%20OR%201&to=2026-11-01"),
      ),
    ).toBeNull()
    expect(
      reconciliationHistoryFilters(
        new URLSearchParams("source=reconciliation&accountId=1&to=2026-02-30"),
      ),
    ).toBeNull()
    expect(reconciliationMovementLink(0, "2026-11-01")).toBeNull()
  })
  it("rejects a detail, preview or catalog from a different request context", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(raw()), { status: 200 })),
    )
    await expect(fetchReconciliation(2)).rejects.toThrow()
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ accountId: 2, currency: "USD", date: "2026-11-01", expectedTotal: 0 }),
            { status: 200 },
          ),
        ),
    )
    await expect(fetchExpectedTotalForAccount(1, "2026-11-01")).rejects.toThrow()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            accountId: 1,
            currency: "CRC",
            countMethod: "DENOMINATION_COUNT",
            denominations,
          }),
          { status: 200 },
        ),
      ),
    )
    await expect(fetchCashDenominationsForAccount(1)).rejects.toThrow()
  })
})
