import { describe, expect, it } from "vitest"

import {
  detailAmount,
  detailTotals,
  parseTransactionDetail,
  type TransactionDetail,
} from "@/lib/transaction-detail"

const line = (id = 1, amount = -0.1, currency: string | null = "CRC") => ({
  id,
  accountId: 1,
  accountName: "Cuenta",
  accountCurrency: currency,
  institutionName: "Banco",
  envelopeId: 1,
  categoryName: "Sobre",
  envelopeActive: true,
  amount,
})
const detail = (overrides: Partial<TransactionDetail> = {}): TransactionDetail => ({
  id: 88,
  userId: 1,
  date: "2026-11-01",
  createdAt: null,
  description: "Detalle completo",
  type: "EXPENSE",
  correction: { available: false, reason: "NO_AUDITED_CORRECTION_FLOW" },
  lines: [line()],
  ...overrides,
})

describe("historical transaction detail", () => {
  it("preserves stored signs, all repeated endpoints, inactive links and unavailable names", () => {
    const value = detail({
      type: "INCOME",
      lines: [line(1, -0.1), { ...line(2, 0.2), envelopeActive: false, accountName: null }],
    })
    expect(parseTransactionDetail(value, 88, 1)).toEqual(value)
  })
  it("rejects another transaction/user and duplicate line identities", () => {
    expect(() => parseTransactionDetail(detail(), 99, 1)).toThrow()
    expect(() => parseTransactionDetail(detail(), 88, 2)).toThrow()
    expect(() => parseTransactionDetail(detail({ lines: [line(), line()] }), 88, 1)).toThrow()
  })
  it("rejects malformed receipts rather than turning absent amounts into zero", () => {
    for (const amount of [undefined, null, "10", NaN, Infinity])
      expect(() =>
        parseTransactionDetail({ ...detail(), lines: [{ ...line(), amount }] }, 88, 1),
      ).toThrow()
    expect(() => parseTransactionDetail({}, 88, 1)).toThrow()
  })
  it("sums exact cents and keeps different currencies apart", () => {
    expect(
      detailTotals(detail({ lines: [line(1, -0.1), line(2, -0.2), line(3, -2, "USD")] })),
    ).toEqual([
      { currency: "CRC", direction: "net", amount: -0.3 },
      { currency: "USD", direction: "net", amount: -2 },
    ])
  })
  it("shows all outgoing and incoming transfer amounts without netting or picking the largest line", () => {
    expect(
      detailTotals(
        detail({ type: "TRANSFER", lines: [line(1, -0.1), line(2, -0.2), line(3, 0.3)] }),
      ),
    ).toEqual([
      { currency: "CRC", direction: "out", amount: -0.3 },
      { currency: "CRC", direction: "in", amount: 0.3 },
    ])
  })
  it("identifies a zero transfer line without claiming an incoming transfer", () => {
    expect(detailTotals(detail({ type: "TRANSFER", lines: [line(1, 0)] }))).toEqual([
      { currency: "CRC", direction: "net", amount: 0 },
    ])
  })
  it("does not invent totals for empty lines, unknown currency or unsafe aggregate", () => {
    expect(detailTotals(detail({ lines: [] }))).toBeNull()
    expect(detailTotals(detail({ lines: [line(1, 1, null)] }))).toBeNull()
    expect(
      detailTotals(detail({ lines: [line(1, Number.MAX_SAFE_INTEGER), line(2, 1)] })),
    ).toBeNull()
  })
  it("formats signed currency and preserves the number when currency is unavailable or unsupported", () => {
    expect(detailAmount(-10, "USD")).toMatch(/-USD.*10,00/)
    expect(detailAmount(0.123456, null)).toContain("+0,123456 · Moneda no disponible")
    expect(detailAmount(1, "XYZ")).toContain("Moneda no disponible")
    expect(detailAmount(0, null)).toBe("0 · Moneda no disponible")
  })
})
