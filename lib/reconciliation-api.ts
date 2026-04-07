import type { CashDenomination, CashDenominationType } from "@/lib/settings-api"

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "")
const API_BASE_URL = `${API_ROOT}/api`

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

type ApiAccount = {
  id: number
  name: string
  currency?: string | null
  is_active?: number | boolean
  active?: boolean
  type?: string | null
}

type ApiReconciliationLine = {
  id?: unknown
  reconciliationId?: unknown
  reconciliation_id?: unknown
  denominationId?: unknown
  denomination_id?: unknown
  denominationValue?: unknown
  denomination_value?: unknown
  denominationType?: unknown
  denomination_type?: unknown
  denominationLabel?: unknown
  denomination_label?: unknown
  quantity?: unknown
  lineTotal?: unknown
  line_total?: unknown
  sortOrder?: unknown
  sort_order?: unknown
  createdAt?: unknown
  created_at?: unknown
  updatedAt?: unknown
  updated_at?: unknown
}

type ApiReconciliation = {
  id: number
  accountId?: unknown
  account_id?: unknown
  currency?: unknown
  date?: unknown
  countMethod?: unknown
  count_method?: unknown
  expectedTotal?: unknown
  expected_total?: unknown
  countedTotal?: unknown
  counted_total?: unknown
  realBalance?: unknown
  real_balance?: unknown
  calculatedBalance?: unknown
  calculated_balance?: unknown
  difference?: unknown
  status?: unknown
  isActive?: unknown
  is_active?: unknown
  note?: unknown
  notes?: unknown
  createdAt?: unknown
  created_at?: unknown
  updatedAt?: unknown
  updated_at?: unknown
  closedAt?: unknown
  closed_at?: unknown
  lines?: unknown
}

export type ReconciliationCountMethod = "MANUAL_TOTAL" | "DENOMINATION_COUNT"
export type ReconciliationStatus = "OPEN" | "BALANCED" | "IGNORED"

export type ReconciliationAccount = {
  id: number
  name: string
  currency: string
  active: boolean
  type: string | null
}

export type ReconciliationLine = {
  id: number
  reconciliationId: number
  denominationId: number | null
  denominationValue: number
  denominationType: CashDenominationType
  denominationLabel: string | null
  quantity: number
  lineTotal: number
  sortOrder: number
  createdAt: string | null
  updatedAt: string | null
}

export type ReconciliationRecord = {
  id: number
  accountId: number
  currency: string
  date: string
  countMethod: ReconciliationCountMethod
  expectedTotal: number
  countedTotal: number
  realBalance: number
  calculatedBalance: number
  difference: number
  status: ReconciliationStatus
  isActive: number
  note: string | null
  notes: string | null
  createdAt: string | null
  updatedAt: string | null
  closedAt: string | null
  lines: ReconciliationLine[]
}

export type AccountCashDenominations = {
  accountId: number
  currency: string
  countMethod: "DENOMINATION_COUNT"
  denominations: CashDenomination[]
}

export type ReconciliationExpectedTotal = {
  accountId: number
  currency: string
  date: string
  expectedTotal: number
}

export class ReconciliationApiError extends Error {
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
    this.name = "ReconciliationApiError"
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
    throw new ReconciliationApiError({
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

const mapReconciliationLine = (raw: unknown): ReconciliationLine => {
  const item = raw as ApiReconciliationLine
  return {
    id: toNumber(item.id),
    reconciliationId: toNumber(item.reconciliationId ?? item.reconciliation_id),
    denominationId: toNullableNumber(item.denominationId ?? item.denomination_id),
    denominationValue: toNumber(item.denominationValue ?? item.denomination_value),
    denominationType: toStringValue(
      item.denominationType ?? item.denomination_type,
      "COIN",
    ) as CashDenominationType,
    denominationLabel: (() => {
      const value = toStringValue(item.denominationLabel ?? item.denomination_label)
      return value || null
    })(),
    quantity: toNumber(item.quantity),
    lineTotal: toNumber(item.lineTotal ?? item.line_total),
    sortOrder: toNumber(item.sortOrder ?? item.sort_order),
    createdAt: toStringValue(item.createdAt ?? item.created_at) || null,
    updatedAt: toStringValue(item.updatedAt ?? item.updated_at) || null,
  }
}

const mapReconciliation = (raw: unknown): ReconciliationRecord => {
  const item = raw as ApiReconciliation
  const countedTotal = toNumber(
    item.countedTotal ?? item.counted_total ?? item.realBalance ?? item.real_balance,
  )
  const expectedTotal = toNumber(
    item.expectedTotal ?? item.expected_total ?? item.calculatedBalance ?? item.calculated_balance,
  )
  const noteValue = (() => {
    const value = toStringValue(item.notes ?? item.note)
    return value || null
  })()

  return {
    id: toNumber(item.id),
    accountId: toNumber(item.accountId ?? item.account_id),
    currency: toStringValue(item.currency, "CRC").toUpperCase(),
    date: toStringValue(item.date),
    countMethod: toStringValue(
      item.countMethod ?? item.count_method,
      "MANUAL_TOTAL",
    ) as ReconciliationCountMethod,
    expectedTotal,
    countedTotal,
    realBalance: countedTotal,
    calculatedBalance: expectedTotal,
    difference: toNumber(item.difference),
    status: toStringValue(item.status, "OPEN") as ReconciliationStatus,
    isActive: toNumber(item.isActive ?? item.is_active),
    note: noteValue,
    notes: noteValue,
    createdAt: toStringValue(item.createdAt ?? item.created_at) || null,
    updatedAt: toStringValue(item.updatedAt ?? item.updated_at) || null,
    closedAt: toStringValue(item.closedAt ?? item.closed_at) || null,
    lines: Array.isArray(item.lines) ? item.lines.map(mapReconciliationLine) : [],
  }
}

export async function fetchReconciliationAccounts() {
  const data = await request<unknown[]>(`/accounts`)

  return Array.isArray(data)
    ? data.map((item) => {
        const row = item as ApiAccount
        return {
          id: toNumber(row.id),
          name: toStringValue(row.name),
          currency: toStringValue(row.currency, "CRC").toUpperCase(),
          active: toBoolean(row.is_active ?? row.active),
          type: (() => {
            const value = toStringValue(row.type)
            return value || null
          })(),
        } satisfies ReconciliationAccount
      })
    : []
}

export async function fetchReconciliations(accountId: number) {
  const data = await request<unknown[]>(`/reconciliations`, {
    query: { account_id: accountId, limit: 50, offset: 0 },
  })

  return Array.isArray(data)
    ? data
        .map(mapReconciliation)
        .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
    : []
}

export async function fetchReconciliation(id: number) {
  const data = await request<unknown>(`/reconciliations/${id}`)
  return mapReconciliation(data)
}

export async function createReconciliation(input: {
  accountId: number
  date: string
  countMethod: ReconciliationCountMethod
  countedTotal?: number
  note?: string
  lines?: Array<{
    denominationId: number
    quantity: number
  }>
}) {
  const body =
    input.countMethod === "DENOMINATION_COUNT"
      ? {
          accountId: input.accountId,
          date: input.date,
          countMethod: input.countMethod,
          notes: input.note?.trim() || undefined,
          lines: input.lines ?? [],
        }
      : {
          accountId: input.accountId,
          date: input.date,
          countMethod: input.countMethod,
          realBalance: input.countedTotal,
          note: input.note?.trim() || undefined,
        }

  const data = await request<unknown>(`/reconciliations`, {
    method: "POST",
    body,
  })

  return mapReconciliation(data)
}

export async function ignoreReconciliation(reconciliationId: number) {
  const data = await request<unknown>(`/reconciliations/${reconciliationId}/ignore`, {
    method: "POST",
  })

  return mapReconciliation(data)
}

export async function fetchCashDenominationsForAccount(accountId: number) {
  const data = await request<{
    accountId?: unknown
    currency?: unknown
    countMethod?: unknown
    denominations?: unknown[]
  }>(`/reconciliations/accounts/${accountId}/denominations`)

  return {
    accountId: toNumber(data.accountId),
    currency: toStringValue(data.currency, "CRC").toUpperCase(),
    countMethod: "DENOMINATION_COUNT",
    denominations: Array.isArray(data.denominations)
      ? data.denominations.map(mapCashDenomination)
      : [],
  } satisfies AccountCashDenominations
}

export async function fetchExpectedTotalForAccount(accountId: number, date: string) {
  const data = await request<{
    accountId?: unknown
    currency?: unknown
    date?: unknown
    expectedTotal?: unknown
    expected_total?: unknown
  }>(`/reconciliations/accounts/${accountId}/expected-total`, {
    query: { date },
  })

  return {
    accountId: toNumber(data.accountId),
    currency: toStringValue(data.currency, "CRC").toUpperCase(),
    date: toStringValue(data.date, date),
    expectedTotal: toNumber(data.expectedTotal ?? data.expected_total),
  } satisfies ReconciliationExpectedTotal
}
