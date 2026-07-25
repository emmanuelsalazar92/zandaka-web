import { DEFAULT_USER_ID } from "@/lib/budgets-api"

const API_BASE_URL = "/api"

export const SETTINGS_USER_ID = DEFAULT_USER_ID

type RequestOptions = {
  method?: string
  query?: Record<string, string | number | undefined | null>
  body?: unknown
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

export type UserSettings = {
  id: number
  name: string
  baseCurrency: string
  createdAt: string
  updatedAt: string
}

export type ExchangeRate = {
  id: number
  userId: number
  fromCurrency: string
  toCurrency: string
  rate: number
  effectiveDate: string
  createdAt: string
  updatedAt: string
}

export type ExchangeRateLookup = {
  compra: number
  venta: number
  fecha: string
}

export type AutoAssignmentMatchType = "CONTAINS" | "STARTS_WITH" | "ENDS_WITH" | "EXACT" | "REGEX"

export type AutoAssignmentRule = {
  id: number
  userId: number
  pattern: string
  matchType: AutoAssignmentMatchType
  accountId: number | null
  accountEnvelopeId: number | null
  priority: number
  isActive: boolean
  notes: string | null
  accountName: string | null
  accountCurrency: string | null
  accountEnvelopeAccountId: number | null
  categoryId: number | null
  categoryName: string | null
  accountEnvelopeLabel: string | null
  createdAt: string
  updatedAt: string
}

export type AutoAssignmentRuleTestResult = {
  description: string
  matched: boolean
  matchedRule: AutoAssignmentRule | null
  matches: AutoAssignmentRule[]
}

export type AccountOption = {
  id: number
  name: string
  currency: string
  institution: string | null
}

export type EnvelopeOption = {
  envelopeId: number
  categoryId: number
  categoryName: string
  balance: number
  currency: string
}

export type CashDenominationType = "BILL" | "COIN"

export type CashDenomination = {
  id: number
  userId: number
  currency: string
  value: number
  type: CashDenominationType
  label: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type PayrollRuleType = "CCSS_WORKER" | "INCOME_TAX"

export type PayrollCcssDetail = {
  id: number
  employeeRate: number
  employerRate: number | null
  baseType: string
  createdAt: string
  updatedAt: string
}

export type PayrollIncomeTaxBracket = {
  id: number
  rangeOrder: number
  amountFrom: number
  amountTo: number | null
  taxRate: number
  isExempt: boolean
  createdAt: string
  updatedAt: string
}

export type PayrollRuleSet = {
  id: number
  userId: number
  countryCode: string
  ruleType: PayrollRuleType
  name: string
  effectiveFrom: string
  effectiveTo: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  ccssDetail: PayrollCcssDetail | null
  incomeTaxBrackets: PayrollIncomeTaxBracket[]
}

export type PayrollRuleHistory = {
  userId: number
  type: PayrollRuleType | null
  items: PayrollRuleSet[]
}

export type PayrollTaxBreakdownLine = {
  rangeOrder: number
  taxableAmount: number
  taxRate: number
  taxAmount: number
}

export type NetSalaryCalculation = {
  grossSalary: number
  periodDate: string
  ccssWorkerRate: number
  ccssWorkerAmount: number
  taxableBase: number
  incomeTaxAmount: number
  netSalary: number
  ccssRuleSetId: number
  incomeTaxRuleSetId: number
  taxBreakdown: PayrollTaxBreakdownLine[]
}

export class SettingsApiError extends Error {
  status: number
  code: string | null

  constructor({
    status,
    code,
    message,
  }: {
    status: number
    code?: string | null
    message: string
  }) {
    super(message)
    this.name = "SettingsApiError"
    this.status = status
    this.code = code ?? null
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
  if (typeof value === "string") return value === "1" || value === "true"
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
    ? ((await response.json().catch(() => null)) as T | ApiErrorPayload | null)
    : null

  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload | null
    throw new SettingsApiError({
      status: response.status,
      code:
        errorPayload && typeof errorPayload === "object" && errorPayload.error?.code
          ? String(errorPayload.error.code)
          : null,
      message: getErrorMessage(errorPayload, "Request failed."),
    })
  }

  return payload as T
}

const mapUserSettings = (raw: unknown): UserSettings => {
  const item = raw as Record<string, unknown>
  return {
    id: toNumber(item.id),
    name: toStringValue(item.name),
    baseCurrency: toStringValue(item.baseCurrency ?? item.base_currency).toUpperCase(),
    createdAt: toStringValue(item.createdAt ?? item.created_at),
    updatedAt: toStringValue(item.updatedAt ?? item.updated_at),
  }
}

const mapExchangeRate = (raw: unknown): ExchangeRate => {
  const item = raw as Record<string, unknown>
  return {
    id: toNumber(item.id),
    userId: toNumber(item.userId ?? item.user_id),
    fromCurrency: toStringValue(item.fromCurrency ?? item.from_currency).toUpperCase(),
    toCurrency: toStringValue(item.toCurrency ?? item.to_currency).toUpperCase(),
    rate: toNumber(item.rate),
    effectiveDate: toStringValue(item.effectiveDate ?? item.effective_date),
    createdAt: toStringValue(item.createdAt ?? item.created_at),
    updatedAt: toStringValue(item.updatedAt ?? item.updated_at),
  }
}

const mapExchangeRateLookup = (raw: unknown): ExchangeRateLookup => {
  const item = raw as Record<string, unknown>
  return {
    compra: toNumber(item.compra),
    venta: toNumber(item.venta),
    fecha: toStringValue(item.fecha),
  }
}

const mapAutoAssignmentRule = (raw: unknown): AutoAssignmentRule => {
  const item = raw as Record<string, unknown>
  return {
    id: toNumber(item.id),
    userId: toNumber(item.userId ?? item.user_id),
    pattern: toStringValue(item.pattern),
    matchType: toStringValue(
      item.matchType ?? item.match_type,
      "CONTAINS",
    ) as AutoAssignmentMatchType,
    accountId: toNullableNumber(item.accountId ?? item.account_id),
    accountEnvelopeId: toNullableNumber(item.accountEnvelopeId ?? item.account_envelope_id),
    priority: toNumber(item.priority, 100),
    isActive: toBoolean(item.isActive ?? item.is_active),
    notes: (() => {
      const value = toStringValue(item.notes)
      return value || null
    })(),
    accountName: (() => {
      const value = toStringValue(item.accountName ?? item.account_name)
      return value || null
    })(),
    accountCurrency: (() => {
      const value = toStringValue(item.accountCurrency ?? item.account_currency)
      return value || null
    })(),
    accountEnvelopeAccountId: toNullableNumber(
      item.accountEnvelopeAccountId ?? item.account_envelope_account_id,
    ),
    categoryId: toNullableNumber(item.categoryId ?? item.category_id),
    categoryName: (() => {
      const value = toStringValue(item.categoryName ?? item.category_name)
      return value || null
    })(),
    accountEnvelopeLabel: (() => {
      const value = toStringValue(item.accountEnvelopeLabel ?? item.account_envelope_label)
      return value || null
    })(),
    createdAt: toStringValue(item.createdAt ?? item.created_at),
    updatedAt: toStringValue(item.updatedAt ?? item.updated_at),
  }
}

const mapCashDenomination = (raw: unknown): CashDenomination => {
  const item = raw as Record<string, unknown>
  return {
    id: toNumber(item.id),
    userId: toNumber(item.userId ?? item.user_id),
    currency: toStringValue(item.currency).toUpperCase(),
    value: toNumber(item.value),
    type: toStringValue(item.type, "COIN") as CashDenominationType,
    label: (() => {
      const value = toStringValue(item.label)
      return value || null
    })(),
    sortOrder: toNumber(item.sortOrder ?? item.sort_order),
    isActive: toBoolean(item.isActive ?? item.is_active),
    createdAt: toStringValue(item.createdAt ?? item.created_at),
    updatedAt: toStringValue(item.updatedAt ?? item.updated_at),
  }
}

const mapPayrollCcssDetail = (raw: unknown): PayrollCcssDetail => {
  const item = raw as Record<string, unknown>
  return {
    id: toNumber(item.id),
    employeeRate: toNumber(item.employeeRate ?? item.employee_rate),
    employerRate: toNullableNumber(item.employerRate ?? item.employer_rate),
    baseType: toStringValue(item.baseType ?? item.base_type),
    createdAt: toStringValue(item.createdAt ?? item.created_at),
    updatedAt: toStringValue(item.updatedAt ?? item.updated_at),
  }
}

const mapPayrollIncomeTaxBracket = (raw: unknown): PayrollIncomeTaxBracket => {
  const item = raw as Record<string, unknown>
  return {
    id: toNumber(item.id),
    rangeOrder: toNumber(item.rangeOrder ?? item.range_order),
    amountFrom: toNumber(item.amountFrom ?? item.amount_from),
    amountTo: toNullableNumber(item.amountTo ?? item.amount_to),
    taxRate: toNumber(item.taxRate ?? item.tax_rate),
    isExempt: toBoolean(item.isExempt ?? item.is_exempt),
    createdAt: toStringValue(item.createdAt ?? item.created_at),
    updatedAt: toStringValue(item.updatedAt ?? item.updated_at),
  }
}

const mapPayrollRuleSet = (raw: unknown): PayrollRuleSet => {
  const item = raw as Record<string, unknown>
  const incomeTaxBrackets = item.incomeTaxBrackets ?? item.income_tax_brackets
  const ccssDetail = item.ccssDetail ?? item.ccss_detail
  return {
    id: toNumber(item.id),
    userId: toNumber(item.userId ?? item.user_id),
    countryCode: toStringValue(item.countryCode ?? item.country_code, "CR").toUpperCase(),
    ruleType: toStringValue(item.ruleType ?? item.rule_type) as PayrollRuleType,
    name: toStringValue(item.name),
    effectiveFrom: toStringValue(item.effectiveFrom ?? item.effective_from),
    effectiveTo: (() => {
      const value = toStringValue(item.effectiveTo ?? item.effective_to)
      return value || null
    })(),
    isActive: toBoolean(item.isActive ?? item.is_active),
    createdAt: toStringValue(item.createdAt ?? item.created_at),
    updatedAt: toStringValue(item.updatedAt ?? item.updated_at),
    ccssDetail: ccssDetail ? mapPayrollCcssDetail(ccssDetail) : null,
    incomeTaxBrackets: Array.isArray(incomeTaxBrackets)
      ? incomeTaxBrackets.map(mapPayrollIncomeTaxBracket)
      : [],
  }
}

const mapNetSalaryCalculation = (raw: unknown): NetSalaryCalculation => {
  const item = raw as Record<string, unknown>
  const breakdown = item.taxBreakdown ?? item.tax_breakdown

  return {
    grossSalary: toNumber(item.grossSalary ?? item.gross_salary),
    periodDate: toStringValue(item.periodDate ?? item.period_date),
    ccssWorkerRate: toNumber(item.ccssWorkerRate ?? item.ccss_worker_rate),
    ccssWorkerAmount: toNumber(item.ccssWorkerAmount ?? item.ccss_worker_amount),
    taxableBase: toNumber(item.taxableBase ?? item.taxable_base),
    incomeTaxAmount: toNumber(item.incomeTaxAmount ?? item.income_tax_amount),
    netSalary: toNumber(item.netSalary ?? item.net_salary),
    ccssRuleSetId: toNumber(item.ccssRuleSetId ?? item.ccss_rule_set_id),
    incomeTaxRuleSetId: toNumber(item.incomeTaxRuleSetId ?? item.income_tax_rule_set_id),
    taxBreakdown: Array.isArray(breakdown)
      ? breakdown.map((line) => {
          const row = line as Record<string, unknown>
          return {
            rangeOrder: toNumber(row.rangeOrder ?? row.range_order),
            taxableAmount: toNumber(row.taxableAmount ?? row.taxable_amount),
            taxRate: toNumber(row.taxRate ?? row.tax_rate),
            taxAmount: toNumber(row.taxAmount ?? row.tax_amount),
          }
        })
      : [],
  }
}

export async function fetchUserSettings(userId = SETTINGS_USER_ID) {
  const data = await request<unknown>(`/users/${userId}`)
  return mapUserSettings(data)
}

export async function updateUserSettings(
  input: Pick<UserSettings, "name" | "baseCurrency">,
  userId = SETTINGS_USER_ID,
) {
  const data = await request<unknown>(`/users/${userId}`, {
    method: "PUT",
    body: {
      name: input.name.trim(),
      baseCurrency: input.baseCurrency.trim().toUpperCase(),
    },
  })

  return mapUserSettings(data)
}

export async function fetchExchangeRates(userId = SETTINGS_USER_ID) {
  const data = await request<unknown[]>(`/exchange-rate`, {
    query: { userId },
  })

  return Array.isArray(data) ? data.map(mapExchangeRate) : []
}

export async function fetchExchangeRateByDate(date: string) {
  const [year, month, day] = date.split("-")
  const normalizedYear = Number.parseInt(year ?? "", 10)
  const normalizedMonth = Number.parseInt(month ?? "", 10)
  const normalizedDay = Number.parseInt(day ?? "", 10)

  if (
    !Number.isInteger(normalizedYear) ||
    !Number.isInteger(normalizedMonth) ||
    !Number.isInteger(normalizedDay)
  ) {
    throw new Error("Invalid exchange rate date.")
  }

  const data = await request<unknown>(
    `/exchange-rate/${normalizedDay}/${normalizedMonth}/${normalizedYear}`,
  )
  return mapExchangeRateLookup(data)
}

export async function createExchangeRate(
  input: Pick<ExchangeRate, "fromCurrency" | "toCurrency" | "rate" | "effectiveDate">,
  userId = SETTINGS_USER_ID,
) {
  const data = await request<unknown>(`/exchange-rate`, {
    method: "POST",
    body: {
      userId,
      fromCurrency: input.fromCurrency.trim().toUpperCase(),
      toCurrency: input.toCurrency.trim().toUpperCase(),
      rate: input.rate,
      effectiveDate: input.effectiveDate,
    },
  })

  return mapExchangeRate(data)
}

export async function updateExchangeRate(
  id: number,
  input: Pick<ExchangeRate, "fromCurrency" | "toCurrency" | "rate" | "effectiveDate">,
  userId = SETTINGS_USER_ID,
) {
  const data = await request<unknown>(`/exchange-rate/${id}`, {
    method: "PUT",
    body: {
      userId,
      fromCurrency: input.fromCurrency.trim().toUpperCase(),
      toCurrency: input.toCurrency.trim().toUpperCase(),
      rate: input.rate,
      effectiveDate: input.effectiveDate,
    },
  })

  return mapExchangeRate(data)
}

export async function deleteExchangeRate(id: number, userId = SETTINGS_USER_ID) {
  await request<void>(`/exchange-rate/${id}`, {
    method: "DELETE",
    query: { userId },
  })
}

export async function fetchAccounts() {
  const data = await request<unknown[]>(`/accounts`)

  return Array.isArray(data)
    ? data.map((item) => {
        const row = item as Record<string, unknown>
        return {
          id: toNumber(row.id),
          name: toStringValue(row.name),
          currency: toStringValue(row.currency).toUpperCase(),
          institution: (() => {
            const value = toStringValue(row.institution)
            return value || null
          })(),
        }
      })
    : []
}

export async function fetchEnvelopeOptions(accountId: number) {
  const data = await request<unknown[]>(`/reports/envelope-balances`, {
    query: { accountId },
  })

  return Array.isArray(data)
    ? data.map((item) => {
        const row = item as Record<string, unknown>
        return {
          envelopeId: toNumber(row.envelopeId ?? row.envelope_id),
          categoryId: toNumber(row.categoryId ?? row.category_id),
          categoryName: toStringValue(row.categoryName ?? row.category_name),
          balance: toNumber(row.balance),
          currency: toStringValue(row.currency).toUpperCase(),
        }
      })
    : []
}

export async function fetchAutoAssignmentRules(userId = SETTINGS_USER_ID) {
  const data = await request<unknown[]>(`/auto-assignment-rules`, {
    query: { userId },
  })

  return Array.isArray(data) ? data.map(mapAutoAssignmentRule) : []
}

export async function createAutoAssignmentRule(
  input: {
    pattern: string
    matchType: AutoAssignmentMatchType
    accountId: number | null
    accountEnvelopeId: number | null
    priority: number
    isActive: boolean
    notes: string | null
  },
  userId = SETTINGS_USER_ID,
) {
  const data = await request<unknown>(`/auto-assignment-rules`, {
    method: "POST",
    body: {
      userId,
      pattern: input.pattern,
      matchType: input.matchType,
      accountId: input.accountId,
      accountEnvelopeId: input.accountEnvelopeId,
      priority: input.priority,
      isActive: input.isActive,
      notes: input.notes,
    },
  })

  return mapAutoAssignmentRule(data)
}

export async function updateAutoAssignmentRule(
  id: number,
  input: {
    pattern: string
    matchType: AutoAssignmentMatchType
    accountId: number | null
    accountEnvelopeId: number | null
    priority: number
    isActive: boolean
    notes: string | null
  },
  userId = SETTINGS_USER_ID,
) {
  const data = await request<unknown>(`/auto-assignment-rules/${id}`, {
    method: "PUT",
    body: {
      userId,
      pattern: input.pattern,
      matchType: input.matchType,
      accountId: input.accountId,
      accountEnvelopeId: input.accountEnvelopeId,
      priority: input.priority,
      isActive: input.isActive,
      notes: input.notes,
    },
  })

  return mapAutoAssignmentRule(data)
}

export async function toggleAutoAssignmentRuleStatus(
  id: number,
  isActive: boolean,
  userId = SETTINGS_USER_ID,
) {
  const data = await request<unknown>(`/auto-assignment-rules/${id}/status`, {
    method: "PATCH",
    body: {
      userId,
      isActive,
    },
  })

  return mapAutoAssignmentRule(data)
}

export async function archiveAutoAssignmentRule(id: number, userId = SETTINGS_USER_ID) {
  await request<void>(`/auto-assignment-rules/${id}`, {
    method: "DELETE",
    query: { userId },
  })
}

export async function testAutoAssignmentRule(description: string, userId = SETTINGS_USER_ID) {
  const data = await request<{
    description: string
    matched: boolean
    matchedRule: unknown | null
    matches: unknown[]
  }>(`/auto-assignment-rules/test`, {
    method: "POST",
    body: {
      userId,
      description,
    },
  })

  return {
    description: data.description,
    matched: data.matched,
    matchedRule: data.matchedRule ? mapAutoAssignmentRule(data.matchedRule) : null,
    matches: Array.isArray(data.matches) ? data.matches.map(mapAutoAssignmentRule) : [],
  } satisfies AutoAssignmentRuleTestResult
}

export async function fetchCashDenominations(
  options?: {
    currency?: string
    includeInactive?: boolean
  },
  userId = SETTINGS_USER_ID,
) {
  const data = await request<{ items?: unknown[] }>(`/settings/cash-denominations`, {
    query: {
      userId,
      currency: options?.currency?.trim().toUpperCase(),
      includeInactive: (options?.includeInactive ?? true) ? "true" : "false",
    },
  })

  return Array.isArray(data?.items) ? data.items.map(mapCashDenomination) : []
}

export async function createCashDenomination(
  input: {
    currency: string
    value: number
    type: CashDenominationType
    label?: string | null
    sortOrder?: number
    isActive?: boolean
  },
  userId = SETTINGS_USER_ID,
) {
  const data = await request<unknown>(`/settings/cash-denominations`, {
    method: "POST",
    body: {
      userId,
      currency: input.currency.trim().toUpperCase(),
      value: input.value,
      type: input.type,
      label: input.label?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  })

  return mapCashDenomination(data)
}

export async function updateCashDenomination(
  id: number,
  input: {
    currency: string
    value: number
    type: CashDenominationType
    label?: string | null
    sortOrder?: number
    isActive?: boolean
  },
  userId = SETTINGS_USER_ID,
) {
  const data = await request<unknown>(`/settings/cash-denominations/${id}`, {
    method: "PUT",
    body: {
      userId,
      currency: input.currency.trim().toUpperCase(),
      value: input.value,
      type: input.type,
      label: input.label?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  })

  return mapCashDenomination(data)
}

export async function deactivateCashDenomination(id: number, userId = SETTINGS_USER_ID) {
  const data = await request<unknown>(`/settings/cash-denominations/${id}`, {
    method: "DELETE",
    query: { userId },
  })

  return mapCashDenomination(data)
}

export async function fetchPayrollRuleHistory(
  options?: { type?: PayrollRuleType },
  userId = SETTINGS_USER_ID,
) {
  const data = await request<{
    user_id?: unknown
    type?: unknown
    items?: unknown[]
  }>(`/payroll-rules/history`, {
    query: {
      user_id: userId,
      type: options?.type,
    },
  })

  return {
    userId: toNumber(data?.user_id),
    type: (() => {
      const value = toStringValue(data?.type)
      return value ? (value as PayrollRuleType) : null
    })(),
    items: Array.isArray(data?.items) ? data.items.map(mapPayrollRuleSet) : [],
  } satisfies PayrollRuleHistory
}

export async function fetchActivePayrollRule(
  type: PayrollRuleType,
  date: string,
  userId = SETTINGS_USER_ID,
) {
  const data = await request<unknown>(`/payroll-rules/active`, {
    query: {
      user_id: userId,
      type,
      date,
    },
  })

  return mapPayrollRuleSet(data)
}

export async function createPayrollCcssRule(
  input: {
    name: string
    effectiveFrom: string
    effectiveTo: string | null
    isActive?: boolean
    employeeRate: number
    employerRate?: number | null
    baseType?: string
    countryCode?: string
  },
  userId = SETTINGS_USER_ID,
) {
  const data = await request<unknown>(`/payroll-rules/ccss`, {
    method: "POST",
    body: {
      user_id: userId,
      country_code: input.countryCode?.trim().toUpperCase() || undefined,
      name: input.name.trim(),
      effective_from: input.effectiveFrom,
      effective_to: input.effectiveTo,
      is_active: input.isActive ?? true,
      employee_rate: input.employeeRate,
      employer_rate: input.employerRate ?? null,
      base_type: input.baseType?.trim().toUpperCase() || "GROSS_SALARY",
    },
  })

  return mapPayrollRuleSet(data)
}

export async function createPayrollIncomeTaxRule(
  input: {
    name: string
    effectiveFrom: string
    effectiveTo: string | null
    isActive?: boolean
    countryCode?: string
    brackets: Array<{
      rangeOrder: number
      amountFrom: number
      amountTo: number | null
      taxRate: number
      isExempt: boolean
    }>
  },
  userId = SETTINGS_USER_ID,
) {
  const data = await request<unknown>(`/payroll-rules/income-tax`, {
    method: "POST",
    body: {
      user_id: userId,
      country_code: input.countryCode?.trim().toUpperCase() || undefined,
      name: input.name.trim(),
      effective_from: input.effectiveFrom,
      effective_to: input.effectiveTo,
      is_active: input.isActive ?? true,
      brackets: input.brackets.map((bracket) => ({
        range_order: bracket.rangeOrder,
        amount_from: bracket.amountFrom,
        amount_to: bracket.amountTo,
        tax_rate: bracket.taxRate,
        is_exempt: bracket.isExempt ? 1 : 0,
      })),
    },
  })

  return mapPayrollRuleSet(data)
}

export async function updatePayrollRule(
  id: number,
  input: {
    name?: string
    effectiveFrom?: string
    effectiveTo?: string | null
    isActive?: boolean
    countryCode?: string
    employeeRate?: number
    employerRate?: number | null
    baseType?: string
    brackets?: Array<{
      rangeOrder: number
      amountFrom: number
      amountTo: number | null
      taxRate: number
      isExempt: boolean
    }>
  },
  userId = SETTINGS_USER_ID,
) {
  const data = await request<unknown>(`/payroll-rules/${id}`, {
    method: "PUT",
    body: {
      user_id: userId,
      name: input.name?.trim(),
      effective_from: input.effectiveFrom,
      effective_to: input.effectiveTo,
      is_active: input.isActive,
      country_code: input.countryCode?.trim().toUpperCase(),
      employee_rate: input.employeeRate,
      employer_rate: input.employerRate,
      base_type: input.baseType?.trim().toUpperCase(),
      brackets: input.brackets?.map((bracket) => ({
        range_order: bracket.rangeOrder,
        amount_from: bracket.amountFrom,
        amount_to: bracket.amountTo,
        tax_rate: bracket.taxRate,
        is_exempt: bracket.isExempt ? 1 : 0,
      })),
    },
  })

  return mapPayrollRuleSet(data)
}

export async function deactivatePayrollRule(id: number, userId = SETTINGS_USER_ID) {
  const data = await request<unknown>(`/payroll-rules/${id}`, {
    method: "DELETE",
    query: { user_id: userId },
  })

  return mapPayrollRuleSet(data)
}

export async function calculateNetSalary(
  input: { grossSalary: number; periodDate: string },
  userId = SETTINGS_USER_ID,
) {
  const data = await request<unknown>(`/payroll/calculate-net-salary`, {
    method: "POST",
    body: {
      user_id: userId,
      gross_salary: input.grossSalary,
      period_date: input.periodDate,
    },
  })

  return mapNetSalaryCalculation(data)
}
