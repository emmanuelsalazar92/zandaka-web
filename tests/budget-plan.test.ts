import { describe, expect, it } from "vitest"

import { calculateBudgetPlan } from "@/lib/budget-plan"
import { formatPlanMoney } from "@/lib/budget-plan-view"

import { exampleDocument } from "./fixtures/budget-plan"

describe("monthly budget planning", () => {
  it("keeps percentage precision before deriving CRC and settles only the envelope amount", () => {
    const doc = exampleDocument()
    doc.income.gross = "3600.05"
    doc.income.q2 = "1499.95"
    const result = calculateBudgetPlan(doc)
    expect(result.net).toBe("3000.05")
    expect(result.lines[1]).toMatchObject({
      reserveUsd: "450.0075",
      rawPayAmount: "220503.675",
      payAmount: "220503.68",
    })
    expect(result.closing).toBe("0")
  })
  it("uses venta for an invoiced USD subscription and compra for its USD reserve", () => {
    const result = calculateBudgetPlan(exampleDocument())
    expect(result).toMatchObject({ buy: "490", sell: "526", incomeDifference: "0" })
    expect(result.lines[2]).toMatchObject({ payAmount: "8900", reserveUsd: "19" })
  })
  it("does not round a fixed USD original to a whole dollar", () => {
    expect(calculateBudgetPlan(exampleDocument()).lines[3]).toMatchObject({
      reserveUsd: "68.25",
      payAmount: "68.25",
      payCurrency: "USD",
    })
  })
  it("supports already-net income without any payroll deduction", () => {
    const doc = exampleDocument()
    doc.incomeMode = "net"
    doc.income.net = "3000"
    doc.income.gross = ""
    doc.income.ccss = ""
    doc.income.tax = ""
    const result = calculateBudgetPlan(doc)
    expect(result.net).toBe("3000")
    expect(result.incomeDifference).toBeNull()
    expect(result.issues).toEqual([])
  })
  it("keeps blanks unavailable and zero deductions valid", () => {
    const doc = exampleDocument()
    doc.income.gross = ""
    expect(calculateBudgetPlan(doc).net).toBeNull()
    doc.income.gross = "3000"
    doc.income.ccss = "0"
    doc.income.tax = "0"
    expect(calculateBudgetPlan(doc).incomeDifference).toBe("0")
  })
  it("flags unreconciled payslips, overspending, invalid rates and percentage policy", () => {
    const doc = exampleDocument()
    doc.income.q1 = "1"
    expect(calculateBudgetPlan(doc).issues.some((i) => i.field === "income")).toBe(true)
    doc.lines[0].amount = "9999999999"
    expect(calculateBudgetPlan(doc).issues.some((i) => i.field === "lines")).toBe(true)
    doc.exchange.margin = "21"
    expect(calculateBudgetPlan(doc).buy).toBeNull()
    doc.exchange.margin = "2"
    doc.lines[1].roundUsd = "up"
    expect(calculateBudgetPlan(doc).issues.some((i) => i.field.includes(doc.lines[1].id))).toBe(
      true,
    )
  })
  it("applies a group reference to the full net and preserves an unconverted USD remainder", () => {
    const result = calculateBudgetPlan(exampleDocument())
    expect(result.groups.map((g) => g.cap)).toEqual(["1500", "900", "600"])
    expect(result.paymentsUsd).toBe("68.25")
    expect(Number(result.convertUsd)).toBeLessThan(Number(result.assigned))
    expect(Number(result.free)).toBeGreaterThan(0)
  })
  it("formats only at the display boundary", () => {
    expect(formatPlanMoney(null)).toBe("Por confirmar")
    expect(formatPlanMoney("450.0075")).toMatch(/450,01/)
    expect(formatPlanMoney("0")).toMatch(/0,00/)
  })
})
