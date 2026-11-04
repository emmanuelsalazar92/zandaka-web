import { describe, expect, it } from "vitest"

import {
  emptyHistoryFilters,
  historyFilterError,
  historyQuery,
  historyResultLabel,
  parseHistory,
} from "@/lib/transaction-history"
import { getTimelineAmounts, type TimelineTransaction } from "@/lib/transaction-timeline"

const row = {
  id: 1,
  userId: 1,
  date: "2026-11-01",
  type: "EXPENSE",
  description: "Registro",
  lines: [{ accountId: 1, envelopeId: 1, amount: -0.1 }],
}
const response = () => ({
  data: [row],
  meta: {
    page: 1,
    pageSize: 10,
    totalItems: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  },
})
const transaction = (
  type: TimelineTransaction["type"],
  entries: Array<[number, string]>,
): TimelineTransaction => ({
  id: 1,
  date: row.date,
  type,
  description: row.description,
  lines: entries.map(([amount, accountCurrency], index) => ({
    accountId: index + 1,
    envelopeId: index + 1,
    account: "Cuenta",
    envelope: "Sobre",
    accountCurrency,
    amount,
  })),
})

describe("history browsing contract", () => {
  it("encodes only applied filters, including a literal ALL search, signed decimal amounts and categoryId", () => {
    const query = new URLSearchParams(
      historyQuery(
        {
          ...emptyHistoryFilters,
          keyword: "ALL",
          accountId: "2",
          envelopeId: "3",
          amountMin: "-0.2",
          amountMax: "-0.1",
        },
        2,
        50,
        1,
      ),
    )
    expect(Object.fromEntries(query)).toEqual({
      userId: "1",
      accountId: "2",
      categoryId: "3",
      q: "ALL",
      amountMin: "-0.2",
      amountMax: "-0.1",
      page: "2",
      pageSize: "50",
      sortBy: "date",
      sortDir: "desc",
    })
  })
  it("preserves the response signs and snake/camel identifiers without fabricating currency", () => {
    const parsed = parseHistory(response(), 1, 10, 1)
    expect(parsed.data[0].lines[0].amount).toBe(-0.1)
    expect(parsed.data[0].lines[0].accountCurrency).toBeUndefined()
  })
  it("rejects another page, size, owner, impossible count or duplicated record", () => {
    expect(() => parseHistory(response(), 2, 10, 1)).toThrow()
    expect(() => parseHistory(response(), 1, 50, 1)).toThrow()
    expect(() => parseHistory(response(), 1, 10, 2)).toThrow()
    expect(() => parseHistory({ ...response(), data: [row, row] }, 1, 10)).toThrow()
    const invalid = response()
    invalid.meta.totalItems = 0
    invalid.meta.totalPages = 0
    expect(() => parseHistory(invalid, 1, 10)).toThrow()
  })
  it("rejects malformed money and metadata instead of announcing a verified empty history", () => {
    expect(() => parseHistory({}, 1, 10)).toThrow()
    expect(() =>
      parseHistory({ ...response(), data: [{ ...row, lines: [{ amount: null }] }] }, 1, 10),
    ).toThrow()
    expect(() =>
      parseHistory({ ...response(), meta: { ...response().meta, totalPages: 8 } }, 1, 10),
    ).toThrow()
  })
  it("announces the actual last page range and a confirmed empty result", () => {
    expect(
      historyResultLabel(
        {
          page: 2,
          pageSize: 50,
          totalItems: 63,
          totalPages: 2,
          hasNextPage: false,
          hasPrevPage: true,
        },
        13,
      ),
    ).toBe("Mostrando 51–63 de 63 movimientos. Página 2 de 2. 50 por página.")
    expect(historyResultLabel({ ...response().meta, totalItems: 0, totalPages: 0 }, 0)).toBe(
      "Sin movimientos para mostrar.",
    )
  })
  it("validates dates and signed amount ranges before requesting the history", () => {
    expect(
      historyFilterError({ ...emptyHistoryFilters, dateFrom: "2026-11-02", dateTo: "2026-11-01" })
        ?.field,
    ).toBe("dateFrom")
    expect(
      historyFilterError({ ...emptyHistoryFilters, amountMin: "-1", amountMax: "-10" })?.field,
    ).toBe("amountMin")
    expect(historyFilterError({ ...emptyHistoryFilters, amountMin: "NaN" })?.field).toBe(
      "amountMin",
    )
    expect(
      historyFilterError({ ...emptyHistoryFilters, amountMin: "-0.2", amountMax: "-0.1" }),
    ).toBeNull()
  })
  it("announces recovery of a page removed by changes in the result set", () => {
    expect(
      historyResultLabel(
        {
          page: 2,
          pageSize: 10,
          totalItems: 5,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: true,
        },
        0,
      ),
    ).toBe("El historial cambió. Cargando la última página disponible.")
  })
})
describe("history amounts", () => {
  it("adds exact cents by currency without changing historical signs", () => {
    expect(
      getTimelineAmounts(
        transaction("ADJUSTMENT", [
          [0.1, "CRC"],
          [0.2, "CRC"],
          [-2, "USD"],
        ]),
      ),
    ).toEqual([
      { currency: "CRC", direction: "net", amount: 0.3 },
      { currency: "USD", direction: "net", amount: -2 },
    ])
  })
  it("separates transfer directions and all repeated lines, never a net zero expense or the largest line", () => {
    expect(
      getTimelineAmounts(
        transaction("TRANSFER", [
          [-0.1, "USD"],
          [-0.2, "USD"],
          [0.3, "USD"],
        ]),
      ),
    ).toEqual([
      { currency: "USD", direction: "out", amount: -0.3 },
      { currency: "USD", direction: "in", amount: 0.3 },
    ])
  })
  it("does not invent an amount for unknown currency, missing lines or unsafe totals", () => {
    for (const entries of [
      [],
      [[1, ""]],
      [[Infinity, "CRC"]],
      [
        [Number.MAX_SAFE_INTEGER, "CRC"],
        [1, "CRC"],
      ],
    ] as Array<Array<[number, string]>>)
      expect(getTimelineAmounts(transaction("INCOME", entries))).toBeNull()
  })
})
