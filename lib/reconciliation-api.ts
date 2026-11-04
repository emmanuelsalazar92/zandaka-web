import { decimalNumber } from "@/lib/money"
import { publicErrorMessage } from "@/lib/public-error"
import type { CashDenomination, CashDenominationType } from "@/lib/settings-api"

type RequestOptions = {
  method?: string
  query?: Record<string, string | number | undefined | null>
  body?: unknown
  signal?: AbortSignal
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

export type ReconciliationCountMethod = "MANUAL_TOTAL" | "DENOMINATION_COUNT"
export type ReconciliationStatus = "OPEN" | "BALANCED" | "IGNORED"

export type ReconciliationAccount = {
  id: number
  name: string
  currency: string
  active: boolean
  institution: string | null
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

const invalid = () =>
  new Error("No pudimos verificar los datos de conciliación. Vuelve a consultar.")
const object = (raw: unknown): Record<string, unknown> => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw invalid()
  return raw as Record<string, unknown>
}
const text = (value: unknown) => {
  if (typeof value !== "string") throw invalid()
  return value
}
const optionalText = (value: unknown) =>
  value === undefined || value === null ? null : text(value)
const number = (value: unknown) => {
  if ((typeof value !== "number" && typeof value !== "string") || value === "") throw invalid()
  return decimalNumber(value as number | string)
}
const identifier = (value: unknown) => {
  const result = number(value)
  if (!Number.isSafeInteger(result) || result <= 0) throw invalid()
  return result
}
const quantity = (value: unknown) => {
  const result = number(value)
  if (!Number.isSafeInteger(result) || result < 0) throw invalid()
  return result
}
const active = (value: unknown) => {
  if (![0, 1, true, false].includes(value as number | boolean)) throw invalid()
  return value === true || value === 1
}
const method = (value: unknown): ReconciliationCountMethod => {
  if (value !== "MANUAL_TOTAL" && value !== "DENOMINATION_COUNT") throw invalid()
  return value
}
const status = (value: unknown): ReconciliationStatus => {
  if (value !== "OPEN" && value !== "BALANCED" && value !== "IGNORED") throw invalid()
  return value
}
const denominationType = (value: unknown): CashDenominationType => {
  if (value !== "BILL" && value !== "COIN") throw invalid()
  return value
}
const array = (value: unknown) => {
  if (!Array.isArray(value)) throw invalid()
  return value as unknown[]
}
const unique = <T extends { id: number }>(items: T[]) => {
  if (new Set(items.map((item) => item.id)).size !== items.length) throw invalid()
  return items
}

async function request(path: string, options: RequestOptions = {}): Promise<unknown> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(options.query ?? {}))
    if (value !== undefined && value !== null) params.set(key, String(value))
  const controller = new AbortController()
  const abort = () => controller.abort()
  options.signal?.addEventListener("abort", abort, { once: true })
  if (options.signal?.aborted) controller.abort()
  const timeout = setTimeout(abort, options.method === "POST" ? 30_000 : 15_000)
  try {
    const response = await fetch(`/api${path}${params.size ? `?${params}` : ""}`, {
      method: options.method ?? "GET",
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const error = payload && typeof payload === "object" ? (payload as ApiErrorPayload) : null
      throw new ReconciliationApiError({
        status: response.status,
        code: typeof error?.error?.code === "string" ? error.error.code : null,
        message: publicErrorMessage(
          payload,
          "No pudimos completar la consulta. Vuelve a intentar.",
        ),
      })
    }
    return payload
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener("abort", abort)
  }
}

function mapLine(raw: unknown): ReconciliationLine {
  const item = object(raw)
  return {
    id: identifier(item.id),
    reconciliationId: identifier(item.reconciliationId ?? item.reconciliation_id),
    denominationId:
      item.denominationId === null || item.denomination_id === null
        ? null
        : identifier(item.denominationId ?? item.denomination_id),
    denominationValue: number(item.denominationValue ?? item.denomination_value),
    denominationType: denominationType(item.denominationType ?? item.denomination_type),
    denominationLabel: optionalText(item.denominationLabel ?? item.denomination_label),
    quantity: quantity(item.quantity),
    lineTotal: number(item.lineTotal ?? item.line_total),
    sortOrder: quantity(item.sortOrder ?? item.sort_order ?? 0),
    createdAt: optionalText(item.createdAt ?? item.created_at),
    updatedAt: optionalText(item.updatedAt ?? item.updated_at),
  }
}

export function parseReconciliation(raw: unknown): ReconciliationRecord {
  const item = object(raw),
    expectedTotal = number(
      item.expectedTotal ??
        item.expected_total ??
        item.calculatedBalance ??
        item.calculated_balance,
    ),
    countedTotal = number(
      item.countedTotal ?? item.counted_total ?? item.realBalance ?? item.real_balance,
    )
  const note = optionalText(item.notes ?? item.note)
  const record: ReconciliationRecord = {
    id: identifier(item.id),
    accountId: identifier(item.accountId ?? item.account_id),
    currency: text(item.currency).toUpperCase(),
    date: text(item.date),
    countMethod: method(item.countMethod ?? item.count_method),
    expectedTotal,
    countedTotal,
    realBalance: countedTotal,
    calculatedBalance: expectedTotal,
    difference: number(item.difference),
    status: status(item.status),
    isActive: active(item.isActive ?? item.is_active) ? 1 : 0,
    note,
    notes: note,
    createdAt: optionalText(item.createdAt ?? item.created_at),
    updatedAt: optionalText(item.updatedAt ?? item.updated_at),
    closedAt: optionalText(item.closedAt ?? item.closed_at),
    lines: item.lines === undefined ? [] : unique(array(item.lines).map(mapLine)),
  }
  const cut = new Date(record.date + "T12:00:00Z")
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(record.date) ||
    Number.isNaN(cut.getTime()) ||
    cut.toISOString().slice(0, 10) !== record.date
  )
    throw invalid()
  if (record.lines.some((line) => line.reconciliationId !== record.id)) throw invalid()
  return record
}

export async function fetchReconciliationAccounts(
  signal?: AbortSignal,
): Promise<ReconciliationAccount[]> {
  let data: unknown
  try {
    data = await request("/accounts", { signal })
  } catch (error) {
    if (
      error instanceof ReconciliationApiError &&
      error.status === 404 &&
      error.code === "NOT_FOUND"
    )
      return []
    throw error
  }
  return unique(
    array(data).map((raw) => {
      const item = object(raw)
      return {
        id: identifier(item.id),
        name: text(item.name),
        currency: text(item.currency).toUpperCase(),
        active: active(item.is_active ?? item.active),
        type: optionalText(item.type),
        institution: optionalText(item.institution ?? item.institution_name),
      }
    }),
  )
}
export async function fetchReconciliations(accountId: number, signal?: AbortSignal) {
  const data = await request("/reconciliations", {
    query: { account_id: accountId, limit: 50, offset: 0 },
    signal,
  })
  const records = unique(array(data).map(parseReconciliation))
  if (records.some((item) => item.accountId !== accountId)) throw invalid()
  return records.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
}
export async function fetchReconciliation(id: number, signal?: AbortSignal) {
  const record = parseReconciliation(await request(`/reconciliations/${id}`, { signal }))
  if (record.id !== id) throw invalid()
  return record
}
export async function fetchActiveReconciliation(accountId: number, signal?: AbortSignal) {
  try {
    const record = parseReconciliation(
      await request(`/accounts/${accountId}/reconciliations/active`, { signal }),
    )
    if (record.accountId !== accountId || record.isActive !== 1) throw invalid()
    return record
  } catch (error) {
    if (
      error instanceof ReconciliationApiError &&
      error.status === 404 &&
      error.code === "NOT_FOUND"
    )
      return null
    throw error
  }
}
export async function createReconciliation(input: {
  accountId: number
  date: string
  countMethod: ReconciliationCountMethod
  countedTotal?: number
  note?: string
  lines?: Array<{ denominationId: number; quantity: number }>
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
  const record = parseReconciliation(await request("/reconciliations", { method: "POST", body }))
  if (
    record.accountId !== input.accountId ||
    record.date !== input.date ||
    record.countMethod !== input.countMethod
  )
    throw invalid()
  return record
}
export async function ignoreReconciliation(id: number) {
  const record = parseReconciliation(
    await request(`/reconciliations/${id}/ignore`, { method: "POST" }),
  )
  if (record.id !== id || record.isActive !== 0 || record.status !== "IGNORED") throw invalid()
  return record
}
export async function fetchExpectedTotalForAccount(
  accountId: number,
  date: string,
  signal?: AbortSignal,
): Promise<ReconciliationExpectedTotal> {
  const item = object(
    await request(`/reconciliations/accounts/${accountId}/expected-total`, {
      query: { date },
      signal,
    }),
  )
  const result = {
    accountId: identifier(item.accountId),
    currency: text(item.currency).toUpperCase(),
    date: text(item.date),
    expectedTotal: number(item.expectedTotal ?? item.expected_total),
  }
  if (result.accountId !== accountId || result.date !== date) throw invalid()
  return result
}
export async function fetchCashDenominationsForAccount(
  accountId: number,
  signal?: AbortSignal,
): Promise<AccountCashDenominations> {
  const item = object(
    await request(`/reconciliations/accounts/${accountId}/denominations`, { signal }),
  )
  const currency = text(item.currency).toUpperCase()
  if (identifier(item.accountId) !== accountId || item.countMethod !== "DENOMINATION_COUNT")
    throw invalid()
  const denominations = unique(
    array(item.denominations).map((raw) => {
      const row = object(raw)
      return {
        id: identifier(row.id),
        userId: identifier(row.userId ?? row.user_id),
        currency: text(row.currency).toUpperCase(),
        value: number(row.value),
        type: denominationType(row.type),
        label: optionalText(row.label),
        sortOrder: quantity(row.sortOrder ?? row.sort_order ?? 0),
        isActive: active(row.isActive ?? row.is_active),
        createdAt: optionalText(row.createdAt ?? row.created_at) ?? "",
        updatedAt: optionalText(row.updatedAt ?? row.updated_at) ?? "",
      } satisfies CashDenomination
    }),
  )
  if (denominations.some((row) => row.currency !== currency || row.value <= 0 || !row.isActive))
    throw invalid()
  return { accountId, currency, countMethod: "DENOMINATION_COUNT", denominations }
}
