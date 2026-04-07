import { SETTINGS_USER_ID, fetchUserSettings } from "@/lib/settings-api"

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "")
const API_BASE_URL = `${API_ROOT}/api`

type RequestOptions = {
  query?: Record<string, string | number | undefined | null>
}

type ApiErrorPayload = {
  message?: unknown
  error?: {
    code?: unknown
    message?: unknown
  }
}

export type DashboardMonthlyExpense = {
  categoryId: number
  categoryName: string
  currency: string
  total: number
}

export type DashboardNegativeEnvelope = {
  envelopeId: number
  accountId: number
  accountName: string
  currency: string
  categoryId: number
  categoryName: string
  balance: number
}

export type DashboardInconsistency = {
  accountId: number
  accountName: string
  currency: string
  reconciliationDate: string
  realBalance: number
  calculatedBalance: number
  difference: number
}

export type DashboardRecentTransaction = {
  id: number
  date: string
  description: string
  accountName: string | null
  accountCurrency: string | null
  amount: number
  lines: Array<{
    accountCurrency: string | null
  }>
}

export type DashboardExchangeRate = {
  compra: number
  venta: number
  fecha: string
}

export type DashboardSummary = {
  totals: {
    CRC: number
    USD: number
  }
  preferredCurrency: "CRC" | "USD"
  exchangeRate: DashboardExchangeRate | null
  monthlyExpenses: DashboardMonthlyExpense[]
  recentTransactions: DashboardRecentTransaction[]
  negativeEnvelopes: DashboardNegativeEnvelope[]
  inconsistencies: DashboardInconsistency[]
  warnings: string[]
}

const EMPTY_DASHBOARD_SUMMARY: DashboardSummary = {
  totals: {
    CRC: 0,
    USD: 0,
  },
  preferredCurrency: "CRC",
  exchangeRate: null,
  monthlyExpenses: [],
  recentTransactions: [],
  negativeEnvelopes: [],
  inconsistencies: [],
  warnings: [],
}

export class DashboardApiError extends Error {
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
    this.name = "DashboardApiError"
    this.status = status
    this.code = code ?? null
  }
}

type SettledResult<T> = { status: "fulfilled"; value: T } | { status: "rejected"; reason: unknown }

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

const toStringValue = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback

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
  if (typeof payload.message === "string" && payload.message.trim()) return payload.message
  if (typeof payload.error?.message === "string" && payload.error.message.trim()) {
    return payload.error.message
  }
  return fallback
}

async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const response = await fetch(buildUrl(path, options?.query), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  })

  const contentType = response.headers.get("content-type") || ""
  const payload = contentType.includes("application/json")
    ? ((await response.json().catch(() => null)) as T | ApiErrorPayload | null)
    : null

  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload | null
    throw new DashboardApiError({
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

const mapMonthlyExpense = (raw: unknown): DashboardMonthlyExpense => {
  const item = raw as Record<string, unknown>
  return {
    categoryId: toNumber(item.categoryId ?? item.category_id),
    categoryName: toStringValue(item.categoryName ?? item.category_name),
    currency: toStringValue(item.currency).toUpperCase(),
    total: toNumber(item.total),
  }
}

const mapNegativeEnvelope = (raw: unknown): DashboardNegativeEnvelope => {
  const item = raw as Record<string, unknown>
  return {
    envelopeId: toNumber(item.envelopeId ?? item.envelope_id),
    accountId: toNumber(item.accountId ?? item.account_id),
    accountName: toStringValue(item.accountName ?? item.account_name),
    currency: toStringValue(item.currency).toUpperCase(),
    categoryId: toNumber(item.categoryId ?? item.category_id),
    categoryName: toStringValue(item.categoryName ?? item.category_name),
    balance: toNumber(item.balance),
  }
}

const mapInconsistency = (raw: unknown): DashboardInconsistency => {
  const item = raw as Record<string, unknown>
  return {
    accountId: toNumber(item.accountId ?? item.account_id),
    accountName: toStringValue(item.accountName ?? item.account_name),
    currency: toStringValue(item.currency).toUpperCase(),
    reconciliationDate: toStringValue(item.reconciliationDate ?? item.reconciliation_date),
    realBalance: toNumber(item.realBalance ?? item.real_balance),
    calculatedBalance: toNumber(item.calculatedBalance ?? item.calculated_balance),
    difference: toNumber(item.difference),
  }
}

const mapRecentTransaction = (raw: unknown): DashboardRecentTransaction => {
  const item = raw as Record<string, unknown>
  return {
    id: toNumber(item.id),
    date: toStringValue(item.date),
    description: toStringValue(item.description),
    accountName: (() => {
      const value = toStringValue(item.accountName ?? item.account_name)
      return value || null
    })(),
    accountCurrency: (() => {
      const value = toStringValue(item.accountCurrency ?? item.account_currency).toUpperCase()
      return value || null
    })(),
    amount: toNumber(item.amount),
    lines: Array.isArray(item.lines)
      ? item.lines.map((line) => {
          const row = line as Record<string, unknown>
          return {
            accountCurrency: (() => {
              const value = toStringValue(row.accountCurrency ?? row.account_currency).toUpperCase()
              return value || null
            })(),
          }
        })
      : [],
  }
}

export async function fetchDashboardSummary(userId = SETTINGS_USER_ID): Promise<DashboardSummary> {
  try {
    const today = new Date()
    const day = today.getDate()
    const month = today.getMonth() + 1
    const year = today.getFullYear()
    const monthKey = `${year}-${String(month).padStart(2, "0")}`

    const [
      crcEnvelopeTotal,
      usdEnvelopeTotal,
      monthlyExpenses,
      recentTransactions,
      negativeEnvelopes,
      inconsistencies,
      userSettings,
      exchangeRate,
    ] = (await Promise.allSettled([
      request<{ currency: string; total: number }>(`/reports/envelope-total`, {
        query: { currency: "CRC" },
      }),
      request<{ currency: string; total: number }>(`/reports/envelope-total`, {
        query: { currency: "USD" },
      }),
      request<unknown[]>(`/reports/monthly-expenses`, { query: { month: monthKey } }),
      request<{ data: unknown[] }>(`/transactions`, {
        query: {
          userId,
          page: 1,
          pageSize: 10,
          sortBy: "date",
          sortDir: "desc",
        },
      }),
      request<unknown[]>(`/reports/negative-envelopes`),
      request<unknown[]>(`/reports/active-inconsistencies`),
      fetchUserSettings(userId),
      request<DashboardExchangeRate>(`/exchange-rate/${day}/${month}/${year}`),
    ])) as [
      SettledResult<{ currency: string; total: number }>,
      SettledResult<{ currency: string; total: number }>,
      SettledResult<unknown[]>,
      SettledResult<{ data: unknown[] }>,
      SettledResult<unknown[]>,
      SettledResult<unknown[]>,
      SettledResult<Awaited<ReturnType<typeof fetchUserSettings>>>,
      SettledResult<DashboardExchangeRate>,
    ]

    const warnings = [
      crcEnvelopeTotal,
      usdEnvelopeTotal,
      monthlyExpenses,
      recentTransactions,
      negativeEnvelopes,
      inconsistencies,
      userSettings,
      exchangeRate,
    ]
      .filter((result) => result.status === "rejected")
      .map((result) => {
        const reason = (result as { reason: unknown }).reason
        return reason instanceof Error && reason.message
          ? reason.message
          : "Some dashboard data could not be loaded."
      })

    return {
      totals: {
        CRC: crcEnvelopeTotal.status === "fulfilled" ? toNumber(crcEnvelopeTotal.value.total) : 0,
        USD: usdEnvelopeTotal.status === "fulfilled" ? toNumber(usdEnvelopeTotal.value.total) : 0,
      },
      preferredCurrency:
        userSettings.status === "fulfilled"
          ? (userSettings.value.baseCurrency as "CRC" | "USD")
          : "CRC",
      exchangeRate: exchangeRate.status === "fulfilled" ? exchangeRate.value : null,
      monthlyExpenses:
        monthlyExpenses.status === "fulfilled" && Array.isArray(monthlyExpenses.value)
          ? monthlyExpenses.value.map(mapMonthlyExpense)
          : [],
      recentTransactions:
        recentTransactions.status === "fulfilled" && Array.isArray(recentTransactions.value.data)
          ? recentTransactions.value.data.map(mapRecentTransaction).slice(0, 5)
          : [],
      negativeEnvelopes:
        negativeEnvelopes.status === "fulfilled" && Array.isArray(negativeEnvelopes.value)
          ? negativeEnvelopes.value.map(mapNegativeEnvelope)
          : [],
      inconsistencies:
        inconsistencies.status === "fulfilled" && Array.isArray(inconsistencies.value)
          ? inconsistencies.value.map(mapInconsistency)
          : [],
      warnings,
    }
  } catch (error) {
    return {
      ...EMPTY_DASHBOARD_SUMMARY,
      warnings: [
        error instanceof Error && error.message ? error.message : "Failed to load dashboard.",
      ],
    }
  }
}
