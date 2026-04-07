import { describe, expect, it } from "vitest"

import {
  createIncomeTaxBracketDraft,
  formatIncomeTaxBracketRange,
  formatPayrollRate,
  formatPayrollRuleWindow,
  getCostaRicaTodayDateValue,
  getPayrollTopTaxRate,
} from "@/lib/payroll-rule-helpers"

describe("payroll rule helpers", () => {
  it("formats payroll rates as percentages", () => {
    expect(formatPayrollRate(0.1083)).toBe("10.83%")
  })

  it("formats effective windows including open-ended rules", () => {
    expect(
      formatPayrollRuleWindow({
        effectiveFrom: "2026-01-01",
        effectiveTo: "2026-12-31",
      }),
    ).toBe("01/01/2026 to 31/12/2026")

    expect(
      formatPayrollRuleWindow({
        effectiveFrom: "2027-01-01",
        effectiveTo: null,
      }),
    ).toBe("01/01/2027 to Open-ended")
  })

  it("returns the Costa Rica date-only value for today", () => {
    expect(getCostaRicaTodayDateValue(new Date("2026-04-01T12:00:00Z"))).toBe("2026-04-01")
  })

  it("returns the highest tax rate from a bracket list", () => {
    expect(
      getPayrollTopTaxRate([
        {
          id: 1,
          rangeOrder: 1,
          amountFrom: 0,
          amountTo: 918000,
          taxRate: 0,
          isExempt: true,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: 2,
          rangeOrder: 2,
          amountFrom: 918000,
          amountTo: null,
          taxRate: 0.25,
          isExempt: false,
          createdAt: "",
          updatedAt: "",
        },
      ]),
    ).toBe(0.25)
  })

  it("formats bracket ranges and creates the initial bracket draft", () => {
    expect(
      formatIncomeTaxBracketRange({
        amountFrom: 918000,
        amountTo: null,
      }),
    ).toContain("and above")

    expect(createIncomeTaxBracketDraft(1, 0)).toEqual({
      rangeOrder: "1",
      amountFrom: "0",
      amountTo: "",
      taxRate: "0",
      isExempt: true,
    })
  })
})
