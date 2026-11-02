import { assertMoney, subtractMoney } from "@/lib/money"
export type BudgetIncomeAdjustmentsInput = {
  currency?: string
  originalIncome: number
  applyCcss: boolean
  ccssAmount: number
  applyIncomeTax: boolean
  incomeTaxAmount: number
  applyExchangeLoss: boolean
  exchangeLossAmount: number
}

export type BudgetIncomeAdjustmentsResult = {
  ccssDeduction: number
  incomeTaxDeduction: number
  exchangeLossDeduction: number
  finalIncome: number
}

export function calculateBudgetIncomeAdjustments(
  input: BudgetIncomeAdjustmentsInput,
): BudgetIncomeAdjustmentsResult {
  const originalIncome = Number.isFinite(input.originalIncome)
    ? Math.max(assertMoney(input.originalIncome, input.currency ?? "CRC"), 0)
    : 0
  const ccssDeduction =
    input.applyCcss && Number.isFinite(input.ccssAmount)
      ? Math.max(assertMoney(input.ccssAmount, input.currency ?? "CRC"), 0)
      : 0
  const incomeTaxDeduction =
    input.applyIncomeTax && Number.isFinite(input.incomeTaxAmount)
      ? Math.max(assertMoney(input.incomeTaxAmount, input.currency ?? "CRC"), 0)
      : 0
  const exchangeLossDeduction =
    input.applyExchangeLoss && Number.isFinite(input.exchangeLossAmount)
      ? Math.max(assertMoney(input.exchangeLossAmount, input.currency ?? "CRC"), 0)
      : 0

  return {
    ccssDeduction,
    incomeTaxDeduction,
    exchangeLossDeduction,
    finalIncome: assertMoney(
      Math.max(
        subtractMoney(originalIncome, ccssDeduction, incomeTaxDeduction, exchangeLossDeduction),
        0,
      ),
      input.currency ?? "CRC",
    ),
  }
}

export function buildBudgetPayrollReferenceIds(input: {
  applyCcss: boolean
  applyIncomeTax: boolean
  ccssRuleSetId: number | null
  incomeTaxRuleSetId: number | null
}) {
  return {
    ccssRuleSetId: input.applyCcss || input.applyIncomeTax ? input.ccssRuleSetId : null,
    incomeTaxRuleSetId: input.applyIncomeTax ? input.incomeTaxRuleSetId : null,
  }
}
