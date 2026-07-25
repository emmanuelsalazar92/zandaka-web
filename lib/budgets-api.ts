import type {
  Budget,
  BudgetCategoryOption,
  BudgetFundingAccountOption,
  BudgetFundingOptionLine,
  BudgetFundingOptions,
  BudgetFundingPlan,
  BudgetFundingPlanLine,
  BudgetFundingEnvelopeOption,
  BudgetLine,
  BudgetStatus,
  BudgetValidation,
  BudgetValidationIssue,
  CreateBudgetInput,
  SaveBudgetFundingPlanInput,
  SaveBudgetLinesInput,
} from "@/components/budgets/types"

const API_BASE_URL = "/api"

export const DEFAULT_USER_ID = 1

type RequestOptions = {
  method?: string
  query?: Record<string, string | number | undefined | null>
  body?: unknown
}

type ApiEnvelope<T> = {
  message?: string
  data?: T
}

type ApiErrorPayload = {
  message?: unknown
  errors?: unknown
  error?: {
    code?: unknown
    message?: unknown
    details?: unknown
  }
}

export class BudgetApiError extends Error {
  status: number
  code: string | null
  details: BudgetValidationIssue[]

  constructor({
    status,
    code,
    message,
    details,
  }: {
    status: number
    code?: string | null
    message: string
    details?: BudgetValidationIssue[]
  }) {
    super(message)
    this.name = "BudgetApiError"
    this.status = status
    this.code = code ?? null
    this.details = details ?? []
  }
}

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

const toNullableNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null
  const parsed = toNumber(value, Number.NaN)
  return Number.isNaN(parsed) ? null : parsed
}

const toStringValue = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback

const toBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value === 1
  if (typeof value === "string") {
    return value === "true" || value === "1"
  }
  return false
}

const buildUrl = (path: string, query?: RequestOptions["query"]) => {
  const params = new URLSearchParams()

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return
    params.set(key, String(value))
  })

  const queryString = params.toString()
  return `${API_BASE_URL}${path}${queryString ? `?${queryString}` : ""}`
}

const extractDetails = (payload: ApiErrorPayload | null): BudgetValidationIssue[] => {
  const detailCandidates = [payload?.error?.details, payload?.errors]

  for (const candidate of detailCandidates) {
    if (!Array.isArray(candidate)) continue

    return candidate
      .map((item) => {
        if (!item || typeof item !== "object") return null
        const field =
          typeof (item as { field?: unknown }).field === "string"
            ? ((item as { field?: string }).field ?? "")
            : typeof (item as { path?: unknown }).path === "string"
              ? ((item as { path?: string }).path ?? "")
              : ""
        const detail =
          typeof (item as { detail?: unknown }).detail === "string"
            ? ((item as { detail?: string }).detail ?? "")
            : typeof (item as { message?: unknown }).message === "string"
              ? ((item as { message?: string }).message ?? "")
              : ""

        if (!field && !detail) return null
        return { field, detail: detail || field }
      })
      .filter((item): item is BudgetValidationIssue => item !== null)
  }

  return []
}

const getErrorMessage = (payload: ApiErrorPayload | null, fallback: string) => {
  if (!payload || typeof payload !== "object") return fallback

  if (typeof payload.message === "string" && payload.message.trim().length > 0) {
    return payload.message
  }

  if (
    payload.error &&
    typeof payload.error.message === "string" &&
    payload.error.message.trim().length > 0
  ) {
    return payload.error.message
  }

  return fallback
}

async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const response = await fetch(buildUrl(path, options?.query), {
    method: options?.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })

  const contentType = response.headers.get("content-type") || ""
  const payload = contentType.includes("application/json")
    ? ((await response.json().catch(() => null)) as ApiEnvelope<T> | ApiErrorPayload | null)
    : null

  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload | null
    throw new BudgetApiError({
      status: response.status,
      code:
        errorPayload && typeof errorPayload === "object" && errorPayload.error?.code
          ? String(errorPayload.error.code)
          : null,
      message: getErrorMessage(errorPayload, "Request failed."),
      details: extractDetails(errorPayload),
    })
  }

  if (payload && typeof payload === "object" && "data" in payload) {
    return ((payload as ApiEnvelope<T>).data ?? null) as T
  }

  return payload as T
}

const normalizeBudgetStatus = (value: unknown): BudgetStatus => {
  if (value === "finalized" || value === "funded") return value
  return "draft"
}

const mapBudget = (raw: unknown): Budget => {
  const item = raw as Record<string, unknown>

  return {
    id: toNumber(item.id),
    userId: toNumber(item.userId ?? item.user_id),
    month: toStringValue(item.month),
    currency: toStringValue(item.currency, "CRC"),
    totalIncome: toNumber(item.totalIncome ?? item.total_income),
    ccssRuleSetId: toNullableNumber(item.ccssRuleSetId ?? item.ccss_rule_set_id),
    incomeTaxRuleSetId: toNullableNumber(item.incomeTaxRuleSetId ?? item.income_tax_rule_set_id),
    status: normalizeBudgetStatus(item.status),
    sourceAccountId: toNullableNumber(item.sourceAccountId ?? item.source_account_id),
    createdAt: toStringValue(item.createdAt ?? item.created_at) || null,
    updatedAt: toStringValue(item.updatedAt ?? item.updated_at) || null,
    linesCount: toNumber(item.linesCount ?? item.lines_count),
    distributedAmount: toNumber(item.distributedAmount ?? item.distributed_amount),
    distributedPercentage: toNumber(item.distributedPercentage ?? item.distributed_percentage),
    remainingAmount: toNumber(item.remainingAmount ?? item.remaining_amount),
    remainingPercentage: toNumber(item.remainingPercentage ?? item.remaining_percentage),
  }
}

const mapBudgetLine = (raw: unknown): BudgetLine => {
  const item = raw as Record<string, unknown>
  const category =
    item.category && typeof item.category === "object"
      ? (item.category as Record<string, unknown>)
      : null
  const parent =
    category?.parent && typeof category.parent === "object"
      ? (category.parent as Record<string, unknown>)
      : null

  return {
    id: toNullableNumber(item.id),
    budgetId: toNullableNumber(item.budgetId ?? item.budget_id),
    categoryId: toNumber(item.categoryId ?? item.category_id ?? category?.id),
    categoryName: toStringValue(item.categoryName ?? item.category_name ?? category?.name),
    parentCategoryId: toNullableNumber(
      item.parentCategoryId ??
        item.parent_category_id ??
        category?.parentId ??
        category?.parent_id ??
        parent?.id,
    ),
    parentCategoryName: (() => {
      const value = toStringValue(
        item.parentCategoryName ?? item.parent_category_name ?? item.parentName ?? parent?.name,
      )
      return value || null
    })(),
    amount: toNumber(item.amount),
    percentage: toNumber(item.percentage),
    notes: toStringValue(item.notes),
    sortOrder: toNumber(item.sortOrder ?? item.sort_order),
  }
}

const mapBudgetValidation = (raw: unknown): BudgetValidation => {
  const item = raw as Record<string, unknown>
  return {
    isValid: toBoolean(item.isValid ?? item.is_valid),
    distributedAmount: toNumber(item.distributedAmount ?? item.distributed_amount),
    distributedPercentage: toNumber(item.distributedPercentage ?? item.distributed_percentage),
    remainingAmount: toNumber(item.remainingAmount ?? item.remaining_amount),
    remainingPercentage: toNumber(item.remainingPercentage ?? item.remaining_percentage),
    errors: Array.isArray(item.errors)
      ? item.errors
          .map((error) => {
            if (!error || typeof error !== "object") return null
            const field = toStringValue((error as { field?: unknown }).field)
            const detail =
              toStringValue((error as { detail?: unknown }).detail) ||
              toStringValue((error as { message?: unknown }).message)
            if (!field && !detail) return null
            return { field, detail }
          })
          .filter((error): error is BudgetValidationIssue => error !== null)
      : [],
  }
}

const mapCategoryOption = (raw: unknown): BudgetCategoryOption => {
  const item = raw as Record<string, unknown>
  return {
    id: toNumber(item.id),
    name: toStringValue(item.name),
    parentId: toNullableNumber(item.parentId ?? item.parent_id),
    parentName: null,
    active: toBoolean(item.active ?? item.is_active ?? true),
  }
}

const mapFundingAccountOption = (raw: unknown): BudgetFundingAccountOption => {
  const item = raw as Record<string, unknown>

  return {
    id: toNumber(item.id),
    name: toStringValue(item.name),
    currency: toStringValue(item.currency, "CRC"),
    institutionId: toNullableNumber(item.institutionId ?? item.institution_id),
    institutionName: (() => {
      const value = toStringValue(item.institutionName ?? item.institution_name)
      return value || null
    })(),
  }
}

const mapFundingEnvelopeOption = (raw: unknown): BudgetFundingEnvelopeOption => {
  const item = raw as Record<string, unknown>

  return {
    id: toNumber(item.id),
    accountId: toNumber(item.accountId ?? item.account_id),
    accountName: toStringValue(item.accountName ?? item.account_name),
    accountCurrency: toStringValue(item.accountCurrency ?? item.account_currency, "CRC"),
    institutionName: (() => {
      const value = toStringValue(item.institutionName ?? item.institution_name)
      return value || null
    })(),
    categoryId: toNumber(item.categoryId ?? item.category_id),
    categoryName: toStringValue(item.categoryName ?? item.category_name),
  }
}

const mapFundingOptionLine = (raw: unknown): BudgetFundingOptionLine => {
  const item = raw as Record<string, unknown>
  const line = mapBudgetLine(item)

  return {
    budgetLineId: toNumber(item.budgetLineId ?? item.budget_line_id ?? line.id),
    categoryId: line.categoryId,
    categoryName: line.categoryName,
    amount: line.amount,
    percentage: line.percentage,
    notes: line.notes,
    sortOrder: line.sortOrder,
    availableEnvelopes: Array.isArray(item.availableEnvelopes)
      ? item.availableEnvelopes.map(mapFundingEnvelopeOption)
      : [],
  }
}

const mapFundingPlanLine = (raw: unknown): BudgetFundingPlanLine => {
  const item = raw as Record<string, unknown>

  return {
    budgetLineId: toNumber(item.budgetLineId ?? item.budget_line_id),
    categoryId: toNumber(item.categoryId ?? item.category_id),
    categoryName: toStringValue(item.categoryName ?? item.category_name),
    amount: toNumber(item.amount),
    percentage: toNumber(item.percentage),
    accountEnvelopeId: toNullableNumber(item.accountEnvelopeId ?? item.account_envelope_id),
    accountId: toNullableNumber(item.accountId ?? item.account_id),
    accountName: (() => {
      const value = toStringValue(item.accountName ?? item.account_name)
      return value || null
    })(),
    accountCurrency: (() => {
      const value = toStringValue(item.accountCurrency ?? item.account_currency)
      return value || null
    })(),
    isAssigned: toBoolean(item.isAssigned ?? item.is_assigned),
  }
}

const mapFundingOptions = (raw: unknown): BudgetFundingOptions => {
  const item = raw as Record<string, unknown>

  return {
    budget: mapBudget(item.budget),
    accounts: Array.isArray(item.accounts) ? item.accounts.map(mapFundingAccountOption) : [],
    lines: Array.isArray(item.lines)
      ? item.lines.map(mapFundingOptionLine).sort((left, right) => left.sortOrder - right.sortOrder)
      : [],
  }
}

const mapFundingPlan = (raw: unknown): BudgetFundingPlan => {
  const item = raw as Record<string, unknown>

  return {
    budget: mapBudget(item.budget),
    sourceAccountId: toNullableNumber(item.sourceAccountId ?? item.source_account_id),
    sourceAccountName: (() => {
      const value = toStringValue(item.sourceAccountName ?? item.source_account_name)
      return value || null
    })(),
    lines: Array.isArray(item.lines) ? item.lines.map(mapFundingPlanLine) : [],
    isComplete: toBoolean(item.isComplete ?? item.is_complete),
  }
}

export async function fetchBudgets(filters?: {
  currency?: string
  status?: string
  month?: string
}) {
  const data = await request<unknown>("/budgets", {
    query: {
      userId: DEFAULT_USER_ID,
      currency: filters?.currency,
      status: filters?.status,
      month: filters?.month,
    },
  })

  const items = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { items?: unknown[] }).items)
      ? ((data as { items: unknown[] }).items ?? [])
      : []

  return items.map(mapBudget)
}

export async function createBudget(input: CreateBudgetInput) {
  const data = await request<unknown>("/budgets", {
    method: "POST",
    body: {
      userId: DEFAULT_USER_ID,
      month: input.month,
      currency: input.currency,
      totalIncome: input.totalIncome,
      ccssRuleSetId: input.ccssRuleSetId ?? null,
      incomeTaxRuleSetId: input.incomeTaxRuleSetId ?? null,
    },
  })

  return mapBudget(data)
}

export async function fetchBudget(budgetId: number) {
  const data = await request<unknown>(`/budgets/${budgetId}`, {
    query: { userId: DEFAULT_USER_ID },
  })

  return mapBudget(data)
}

export async function fetchBudgetLines(budgetId: number) {
  const data = await request<{ budgetId?: number; items?: unknown[] }>(
    `/budgets/${budgetId}/lines`,
    {
      query: { userId: DEFAULT_USER_ID },
    },
  )

  return Array.isArray(data?.items) ? data.items.map(mapBudgetLine) : []
}

export async function saveBudgetLines(budgetId: number, lines: SaveBudgetLinesInput[]) {
  await request<unknown>(`/budgets/${budgetId}/lines/bulk`, {
    method: "PUT",
    body: {
      userId: DEFAULT_USER_ID,
      lines,
    },
  })
}

export async function fetchBudgetValidation(budgetId: number) {
  const data = await request<unknown>(`/budgets/${budgetId}/validation`, {
    query: { userId: DEFAULT_USER_ID },
  })

  return mapBudgetValidation(data)
}

export async function finalizeBudget(budgetId: number) {
  await request<unknown>(`/budgets/${budgetId}/finalize`, {
    method: "POST",
    body: { userId: DEFAULT_USER_ID },
  })
}

export async function deleteBudget(budgetId: number) {
  await request<unknown>(`/budgets/${budgetId}`, {
    method: "DELETE",
    query: { userId: DEFAULT_USER_ID },
  })
}

export async function copyBudgetFromPrevious(budgetId: number) {
  await request<unknown>(`/budgets/${budgetId}/copy-from-previous`, {
    method: "POST",
    body: { userId: DEFAULT_USER_ID },
  })
}

export async function fetchBudgetCategories() {
  const data = await request<unknown[]>("/categories", {
    query: { activeOnly: "true" },
  })

  const mapped = Array.isArray(data) ? data.map(mapCategoryOption) : []
  const byId = new Map(mapped.map((category) => [category.id, category]))

  return mapped.map((category) => ({
    ...category,
    parentName: category.parentId !== null ? (byId.get(category.parentId)?.name ?? null) : null,
  }))
}

export async function fetchBudgetFundingOptions(budgetId: number) {
  const data = await request<unknown>(`/budgets/${budgetId}/funding-options`, {
    query: { userId: DEFAULT_USER_ID },
  })

  return mapFundingOptions(data)
}

export async function fetchBudgetFundingPlan(budgetId: number) {
  const data = await request<unknown>(`/budgets/${budgetId}/funding-plan`, {
    query: { userId: DEFAULT_USER_ID },
  })

  return mapFundingPlan(data)
}

export async function saveBudgetFundingPlan(budgetId: number, input: SaveBudgetFundingPlanInput) {
  const data = await request<unknown>(`/budgets/${budgetId}/funding-plan`, {
    method: "PUT",
    body: {
      userId: DEFAULT_USER_ID,
      sourceAccountId: input.sourceAccountId,
      lines: input.lines,
    },
  })

  return mapFundingPlan(data)
}

export async function fundBudget(budgetId: number, description?: string) {
  return request<unknown>(`/budgets/${budgetId}/fund`, {
    method: "POST",
    body: {
      userId: DEFAULT_USER_ID,
      ...(description?.trim() ? { description: description.trim() } : {}),
    },
  })
}
