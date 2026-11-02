import { describe, expect, it } from "vitest"

import { parseBankAmount, parseBacCredomatic, parseGrupoMutual } from "@/lib/bank-import"
import { calculateDenominationCountedTotal } from "@/lib/cash-denomination-helpers"
import { formatCurrency } from "@/lib/currency-formatter"
import { calculateEnvelopesTotalBalance } from "@/lib/envelope-helpers"
import {
  assertMoney,
  convertMoney,
  currencyDigits,
  roundMoney,
  sumMoney,
  subtractMoney,
  tryDecimalInput,
} from "@/lib/money"
import {
  calculateReconciliationDifference,
  isAccountReconciled,
} from "@/lib/reconciliation-helpers"
import { calculateTransactionSum, validateTransaction } from "@/lib/transaction-helpers"
import { buildTransactionImportPayload } from "@/lib/transaction-import-helpers"

describe("money contract shared with the backend", () => {
  it("adds many movements and cancels them exactly", () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3)
    expect(sumMoney(Array.from({ length: 10000 }, () => 0.01))).toBe(100)
    expect(subtractMoney(0.3, 0.1, 0.2)).toBe(0)
    for (const expected of [121734.27, 0, 16814.14]) {
      expect(sumMoney([expected, ...Array.from({ length: 1000 }, () => 0.01), -10])).toBe(expected)
    }
  })
  it("settles by currency scale with symmetric half-up rounding", () => {
    expect(currencyDigits("JPY")).toBe(0)
    expect(currencyDigits("BHD")).toBe(3)
    expect(currencyDigits("CLF")).toBe(4)
    expect(roundMoney("1.005", "USD")).toBe(1.01)
    expect(roundMoney("-1.005", "USD")).toBe(-1.01)
    expect(convertMoney(75000, 520, "USD", true)).toBe(144.23)
    expect(convertMoney(1, "1.2345", "BHD")).toBe(1.235)
    expect(formatCurrency(1.234, "BHD")).toContain("1.234")
    expect(formatCurrency(123, "JPY")).not.toContain(".00")
  })
  it("rejects unsupported precision and unsafe numeric transport", () => {
    expect(() => assertMoney("1.001", "USD")).toThrow()
    expect(() => assertMoney("90071992547409.91", "USD")).toThrow()
    expect(() => assertMoney(9.094947017729282e-13, "CRC")).toThrow()
    expect(tryDecimalInput("12garbage")).toBeNaN()
    expect(tryDecimalInput("1.001", "USD")).toBeNaN()
    expect(tryDecimalInput("9007199254740993")).toBeNaN()
    expect(JSON.parse(JSON.stringify({ amount: sumMoney([0.1, 0.2]) })).amount).toBe(0.3)
  })
  it("uses exact calculations in financial UI helpers", () => {
    expect(
      calculateDenominationCountedTotal(
        [
          { id: 1, value: 0.1, sortOrder: 0 },
          { id: 2, value: 0.2, sortOrder: 1 },
        ],
        { 1: "1", 2: "1" },
      ),
    ).toBe(0.3)
    expect(
      calculateEnvelopesTotalBalance(
        [0.1, 0.2].map((balance, id) => ({
          id,
          balance,
          accountId: 1,
          categoryId: 1,
          active: true,
        })),
      ),
    ).toBe(0.3)
    expect(calculateReconciliationDifference(0.3, sumMoney([0.1, 0.2]))).toBe(0)
    expect(
      isAccountReconciled({
        id: 1,
        accountId: 1,
        date: "2026-03-01",
        calculatedBalance: 0,
        realBalance: 0.01,
        difference: 0.01,
      }),
    ).toBe(false)
    expect(
      calculateTransactionSum([
        { accountId: 1, envelopeId: 1, amount: 0.1 },
        { accountId: 1, envelopeId: 1, amount: 0.2 },
      ]),
    ).toBe(0.3)
    expect(
      validateTransaction({
        date: "2026-03-01",
        description: "Transfer",
        type: "TRANSFER",
        lines: [
          { accountId: 1, envelopeId: 1, amount: -0.1 },
          { accountId: 1, envelopeId: 2, amount: 0.11 },
        ],
      }).isValid,
    ).toBe(false)
  })
})

describe("bank monetary imports", () => {
  it("validates grouping and decimal separators before converting to transport numbers", () => {
    expect(parseBankAmount("₡- 432,500.00")).toBe(-432500)
    expect(parseBankAmount("$1,234.56", "USD")).toBe(1234.56)
    for (const value of [
      "1.234,56",
      "12,34.56",
      "1,23",
      "1.001",
      "1.00junk",
      "--1.00",
      "90071992547409.91",
    ]) {
      expect(parseBankAmount(value)).toBeNaN()
    }
  })
  it("preserves a Grupo Mutual amount exactly with its original text", () => {
    const [row] = parseGrupoMutual(
      "15/03/2026\n11:22:40 PM\nPAGO INTERESES\n₡7,379.25\n₡25,307,671.77",
    )
    expect(row.amount).toBe(7379.25)
    expect(row.sourceAmountText).toBe("₡7,379.25")
    const payload = buildTransactionImportPayload({ ...row, accountId: "1", envelopeId: "1" }, 1)
    expect(payload.lines[0]).toEqual({
      accountId: 1,
      envelopeId: 1,
      amount: 7379.25,
      sourceAmountText: "₡7,379.25",
    })
    expect(parseGrupoMutual("15/03/2026\n12:00\nInvalid\n₡1,23\n0")[0].status).toBe("error")
  })
  it("preserves BAC debits and credits and rejects partial numeric parses", () => {
    const rows = parseBacCredomatic(
      "02/03/2026\t30100000\tSHOP\t2,300.01\t0.00\t114,501.92\n03/03/2026\tREF\tCREDIT\t0.00\t0.10\t114,502.02",
      "CRC",
    )
    expect(rows.map((row) => row.amount)).toEqual([-2300.01, 0.1])
    expect(rows[0].sourceAmountText).toBe("2,300.01 | 0.00")
    expect(
      parseBacCredomatic("02/03/2026\tREF\tBROKEN\tinvalid\t1.00\t1.00", "CRC")[0].status,
    ).toBe("error")
  })
})
