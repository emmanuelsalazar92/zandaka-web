export type BudgetStatus = "draft" | "finalized" | "funded"

export type Budget = {
  id: number
  userId: number
  month: string
  currency: string
  totalIncome: number
  ccssRuleSetId: number | null
  incomeTaxRuleSetId: number | null
  status: BudgetStatus
  sourceAccountId: number | null
  createdAt: string | null
  updatedAt: string | null
  linesCount: number
  distributedAmount: number
  distributedPercentage: number
  remainingAmount: number
  remainingPercentage: number
}

export type BudgetLine = {
  id: number | null
  budgetId: number | null
  categoryId: number
  categoryName: string
  parentCategoryId: number | null
  parentCategoryName: string | null
  amount: number
  percentage: number
  notes: string
  sortOrder: number
}

export type BudgetValidationIssue = {
  field: string
  detail: string
}

export type BudgetValidation = {
  isValid: boolean
  distributedAmount: number
  distributedPercentage: number
  remainingAmount: number
  remainingPercentage: number
  errors: BudgetValidationIssue[]
}

export type BudgetCategoryOption = {
  id: number
  name: string
  parentId: number | null
  parentName: string | null
  active: boolean
}

export type CreateBudgetInput = {
  month: string
  currency: string
  totalIncome: number
  ccssRuleSetId?: number | null
  incomeTaxRuleSetId?: number | null
}

export type SaveBudgetLinesInput = {
  categoryId: number
  amount: number
  percentage: number
  notes?: string
  sortOrder: number
}

export type BudgetPlanningLineDraft = {
  clientId: string
  id: number | null
  categoryId: number
  categoryName: string
  parentCategoryId: number | null
  parentCategoryName: string | null
  amount: number
  percentage: number
  notes: string
  sortOrder: number
}

export type BudgetFundingAccountOption = {
  id: number
  name: string
  currency: string
  institutionId: number | null
  institutionName: string | null
}

export type BudgetFundingEnvelopeOption = {
  id: number
  accountId: number
  accountName: string
  accountCurrency: string
  institutionName: string | null
  categoryId: number
  categoryName: string
}

export type BudgetFundingOptionLine = {
  budgetLineId: number
  categoryId: number
  categoryName: string
  amount: number
  percentage: number
  notes: string
  sortOrder: number
  availableEnvelopes: BudgetFundingEnvelopeOption[]
}

export type BudgetFundingOptions = {
  budget: Budget
  accounts: BudgetFundingAccountOption[]
  lines: BudgetFundingOptionLine[]
}

export type BudgetFundingPlanLine = {
  budgetLineId: number
  categoryId: number
  categoryName: string
  amount: number
  percentage: number
  accountEnvelopeId: number | null
  accountId: number | null
  accountName: string | null
  accountCurrency: string | null
  isAssigned: boolean
}

export type BudgetFundingPlan = {
  budget: Budget
  sourceAccountId: number | null
  sourceAccountName: string | null
  lines: BudgetFundingPlanLine[]
  isComplete: boolean
}

export type SaveBudgetFundingPlanInput = {
  sourceAccountId: number
  lines: Array<{
    budgetLineId: number
    accountEnvelopeId: number
  }>
}
