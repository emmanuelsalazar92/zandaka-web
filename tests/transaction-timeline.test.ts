import { describe, expect, it } from "vitest"

import {
  formatTransactionGroupLabel,
  getTransactionDisplayAmount,
  getTransactionDisplayCurrency,
  getTransactionTypeMeta,
  groupTransactionsForTimeline,
  type TimelineTransaction,
} from "@/lib/transaction-timeline"

function buildTransaction(overrides: Partial<TimelineTransaction>): TimelineTransaction {
  return {
    id: 1,
    date: "2026-04-01",
    type: "EXPENSE",
    description: "Default transaction",
    lines: [
      {
        accountId: 10,
        account: "Cuenta Principal",
        accountCurrency: "CRC",
        envelopeId: 20,
        envelope: "Comida",
        amount: -5000,
      },
    ],
    ...overrides,
  }
}

describe("transaction timeline helpers", () => {
  it("creates friendly relative labels for recent dates", () => {
    const now = new Date(2026, 3, 1, 9, 30)

    expect(formatTransactionGroupLabel("2026-04-01", { now })).toBe("Today")
    expect(formatTransactionGroupLabel("2026-03-31", { now })).toBe("Yesterday")
    expect(formatTransactionGroupLabel("2026-03-28", { now })).toBe("March 28, 2026")
    expect(formatTransactionGroupLabel("invalid-date", { now })).toBe("Unknown date")
  })

  it("groups transactions by descending day and keeps invalid dates at the end", () => {
    const now = new Date(2026, 3, 1, 9, 30)
    const transactions = [
      buildTransaction({ id: 1, date: "2026-03-31", description: "Yesterday item" }),
      buildTransaction({ id: 2, date: "2026-04-01", description: "Today item" }),
      buildTransaction({ id: 3, date: "2026-03-28", description: "Older item" }),
      buildTransaction({ id: 4, date: "not-a-date", description: "Broken date" }),
    ]

    const groups = groupTransactionsForTimeline(transactions, { now })

    expect(groups.map((group) => group.label)).toEqual([
      "Today",
      "Yesterday",
      "March 28, 2026",
      "Unknown date",
    ])
    expect(groups[0]?.items[0]?.id).toBe(2)
    expect(groups[3]?.items[0]?.id).toBe(4)
  })

  it("derives display amounts and currencies safely", () => {
    const transfer = buildTransaction({
      type: "TRANSFER",
      lines: [
        {
          accountId: 10,
          account: "Caja",
          accountCurrency: "CRC",
          envelopeId: 20,
          envelope: "Disponible",
          amount: -12500,
        },
        {
          accountId: 11,
          account: "Ahorros",
          accountCurrency: "CRC",
          envelopeId: 21,
          envelope: "Reserva",
          amount: 12500,
        },
      ],
    })

    const mixedCurrency = buildTransaction({
      type: "ADJUSTMENT",
      lines: [
        {
          accountId: 10,
          account: "Caja",
          accountCurrency: "CRC",
          envelopeId: 20,
          envelope: "Disponible",
          amount: 500,
        },
        {
          accountId: 11,
          account: "Broker",
          accountCurrency: "USD",
          envelopeId: 21,
          envelope: "Investments",
          amount: -2,
        },
      ],
    })

    expect(getTransactionDisplayAmount(transfer)).toBe(12500)
    expect(getTransactionDisplayCurrency(transfer)).toBe("CRC")
    expect(getTransactionDisplayCurrency(mixedCurrency)).toBeNull()
  })

  it("returns stable visual metadata per transaction type", () => {
    expect(getTransactionTypeMeta("INCOME")).toMatchObject({
      label: "Income",
      tone: "income",
    })
    expect(getTransactionTypeMeta("EXPENSE")).toMatchObject({
      label: "Expense",
      tone: "expense",
    })
    expect(getTransactionTypeMeta("TRANSFER")).toMatchObject({
      label: "Transfer",
      tone: "transfer",
    })
    expect(getTransactionTypeMeta("ADJUSTMENT")).toMatchObject({
      label: "Adjustment",
      tone: "adjustment",
    })
  })
})
