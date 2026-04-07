export type BudgetIncomeAdjustmentsInput = {
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

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export function calculateBudgetIncomeAdjustments(
  input: BudgetIncomeAdjustmentsInput,
): BudgetIncomeAdjustmentsResult {
  const originalIncome = Number.isFinite(input.originalIncome)
    ? Math.max(input.originalIncome, 0)
    : 0
  const ccssDeduction =
    input.applyCcss && Number.isFinite(input.ccssAmount)
      ? Math.max(roundMoney(input.ccssAmount), 0)
      : 0
  const incomeTaxDeduction =
    input.applyIncomeTax && Number.isFinite(input.incomeTaxAmount)
      ? Math.max(roundMoney(input.incomeTaxAmount), 0)
      : 0
  const exchangeLossDeduction =
    input.applyExchangeLoss && Number.isFinite(input.exchangeLossAmount)
      ? Math.max(roundMoney(input.exchangeLossAmount), 0)
      : 0

  return {
    ccssDeduction,
    incomeTaxDeduction,
    exchangeLossDeduction,
    finalIncome: roundMoney(
      Math.max(originalIncome - ccssDeduction - incomeTaxDeduction - exchangeLossDeduction, 0),
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
