import { describe, expect, it } from "vitest"

import {
  buildBudgetPayrollReferenceIds,
  calculateBudgetIncomeAdjustments,
} from "@/lib/budget-income-adjustments"

describe("budget income adjustments", () => {
  it("keeps the original income when no deduction is selected", () => {
    expect(
      calculateBudgetIncomeAdjustments({
        originalIncome: 1500000,
        applyCcss: false,
        ccssAmount: 162450,
        applyIncomeTax: false,
        incomeTaxAmount: 41582.5,
        applyExchangeLoss: false,
        exchangeLossAmount: 25000,
      }),
    ).toEqual({
      ccssDeduction: 0,
      incomeTaxDeduction: 0,
      exchangeLossDeduction: 0,
      finalIncome: 1500000,
    })
  })

  it("subtracts every selected deduction and rounds the final result", () => {
    expect(
      calculateBudgetIncomeAdjustments({
        originalIncome: 1500000,
        applyCcss: true,
        ccssAmount: 162450,
        applyIncomeTax: true,
        incomeTaxAmount: 41582.5,
        applyExchangeLoss: true,
        exchangeLossAmount: 25000,
      }),
    ).toEqual({
      ccssDeduction: 162450,
      incomeTaxDeduction: 41582.5,
      exchangeLossDeduction: 25000,
      finalIncome: 1270967.5,
    })
  })

  it("never returns a negative final income", () => {
    expect(
      calculateBudgetIncomeAdjustments({
        originalIncome: 1000,
        applyCcss: true,
        ccssAmount: 700,
        applyIncomeTax: true,
        incomeTaxAmount: 600,
        applyExchangeLoss: true,
        exchangeLossAmount: 50,
      }).finalIncome,
    ).toBe(0)
  })

  it("keeps payroll references only for the deductions that actually use them", () => {
    expect(
      buildBudgetPayrollReferenceIds({
        applyCcss: false,
        applyIncomeTax: false,
        ccssRuleSetId: 10,
        incomeTaxRuleSetId: 11,
      }),
    ).toEqual({
      ccssRuleSetId: null,
      incomeTaxRuleSetId: null,
    })

    expect(
      buildBudgetPayrollReferenceIds({
        applyCcss: false,
        applyIncomeTax: true,
        ccssRuleSetId: 10,
        incomeTaxRuleSetId: 11,
      }),
    ).toEqual({
      ccssRuleSetId: 10,
      incomeTaxRuleSetId: 11,
    })
  })
})
