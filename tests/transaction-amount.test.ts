import { describe, expect, it } from "vitest"

import { sumMoney } from "@/lib/money"
import {
  normalizeAmountInput,
  parseAmountInput,
  sanitizeAmountInput,
  transactionAmount,
} from "@/lib/transaction-amount"

describe("transaction amount editing contract", () => {
  it.each(["1000", "10000"])("preserves %s while typing, on blur and in the payload", (text) => {
    let draft = ""
    for (const digit of text) {
      draft = sanitizeAmountInput(draft + digit)
      expect(draft).toBe(text.slice(0, draft.length))
    }
    const blurred = normalizeAmountInput(draft, "INCOME")
    expect(blurred).toBe(text)
    expect(transactionAmount(blurred, "INCOME", "CRC")).toBe(Number(text))
    expect(normalizeAmountInput(blurred, "INCOME")).toBe(text)
  })

  it.each(["1e-2", "12abc34", "1,000", "1 000", "--1", "1.2.3"])(
    "rejects %s without silently changing it",
    (text) => {
      expect(sanitizeAmountInput(text)).toBe(text)
      expect(parseAmountInput(text)).toBeNaN()
      expect(normalizeAmountInput(text, "INCOME")).toBe(text)
      expect(() => transactionAmount(text, "INCOME", "CRC")).toThrow()
    },
  )

  it("keeps drafts incomplete, rejects zero/fractional cents and uses type signs", () => {
    for (const draft of ["", "-", ".", "-."]) expect(parseAmountInput(draft)).toBeNaN()
    for (const invalid of ["0", "0.001", "0.019999999998617554"]) {
      expect(() => transactionAmount(invalid, "ADJUSTMENT", "CRC")).toThrow()
    }
    expect(normalizeAmountInput("0.02", "EXPENSE")).toBe("-0.02")
    expect(transactionAmount("0.02", "EXPENSE", "CRC")).toBe(-0.02)
    expect(transactionAmount("-0.02", "ADJUSTMENT", "CRC")).toBe(-0.02)
    expect(transactionAmount("0.1", "TRANSFER", "CRC")).toBe(0.1)
    expect(
      sumMoney([
        transactionAmount("-0.1", "TRANSFER", "CRC"),
        transactionAmount("0.1", "TRANSFER", "CRC"),
      ]),
    ).toBe(0)
  })
})
