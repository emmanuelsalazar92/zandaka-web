import { SETTINGS_USER_ID } from "@/lib/settings-api"

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "")
const API_BASE_URL = `${API_ROOT}/api`

type RequestOptions = {
  method?: string
  query?: Record<string, string | number | undefined | null>
  body?: unknown
}

type ApiErrorPayload = {
  message?: unknown
  error?: {
    code?: unknown
    message?: unknown
  }
}

type GenerateResponseEnvelope = {
  message?: string
  data?: unknown
}

export type ReportSnapshot = {
  id: number
  userId: number
  reportMonth: string
  generatedAt: string
  baseCurrency: string
  totalCrc: number
  totalUsd: number
  exchangeRateUsed: number | null
  exchangeRateId: number | null
  consolidatedAmount: number | null
  version: number
  isLatest: boolean
  notes: string | null
  status: "DRAFT" | "FINALIZED" | "ARCHIVED"
  createdAt: string
  updatedAt: string
}

export type GenerateReportSnapshotInput = {
  userId?: number
  reportMonth: string
  baseCurrency?: string
  exchangeRateId?: number | null
  usdToCrcRate?: number | null
  notes?: string | null
}

export class ReportsApiError extends Error {
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
    this.name = "ReportsApiError"
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
  if (typeof payload.message === "string" && payload.message.trim()) return payload.message
  if (typeof payload.error?.message === "string" && payload.error.message.trim()) {
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
    cache: "no-store",
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })

  const contentType = response.headers.get("content-type") || ""
  const payload = contentType.includes("application/json")
    ? ((await response.json().catch(() => null)) as
        | T
        | ApiErrorPayload
        | GenerateResponseEnvelope
        | null)
    : null

  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload | null
    throw new ReportsApiError({
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

const mapReportSnapshot = (raw: unknown): ReportSnapshot => {
  const item = raw as Record<string, unknown>
  return {
    id: toNumber(item.id),
    userId: toNumber(item.userId ?? item.user_id),
    reportMonth: toStringValue(item.reportMonth ?? item.report_month),
    generatedAt: toStringValue(item.generatedAt ?? item.generated_at),
    baseCurrency: toStringValue(item.baseCurrency ?? item.base_currency).toUpperCase(),
    totalCrc: toNumber(item.totalCrc ?? item.total_crc),
    totalUsd: toNumber(item.totalUsd ?? item.total_usd),
    exchangeRateUsed: toNullableNumber(item.exchangeRateUsed ?? item.exchange_rate_used),
    exchangeRateId: toNullableNumber(item.exchangeRateId ?? item.exchange_rate_id),
    consolidatedAmount: toNullableNumber(item.consolidatedAmount ?? item.consolidated_amount),
    version: toNumber(item.version, 1),
    isLatest: toBoolean(item.isLatest ?? item.is_latest),
    notes: (() => {
      const value = toStringValue(item.notes)
      return value || null
    })(),
    status: (toStringValue(item.status, "FINALIZED") || "FINALIZED") as
      | "DRAFT"
      | "FINALIZED"
      | "ARCHIVED",
    createdAt: toStringValue(item.createdAt ?? item.created_at),
    updatedAt: toStringValue(item.updatedAt ?? item.updated_at),
  }
}

export async function fetchReportSnapshots(userId = SETTINGS_USER_ID, includeArchived = false) {
  const data = await request<unknown[]>(`/reports`, {
    query: { userId, includeArchived: includeArchived ? 1 : undefined },
  })

  return Array.isArray(data) ? data.map(mapReportSnapshot) : []
}

export async function fetchReportSnapshot(id: number) {
  const data = await request<unknown>(`/reports/${id}`)
  return mapReportSnapshot(data)
}

export async function generateReportSnapshot(input: GenerateReportSnapshotInput) {
  const data = await request<GenerateResponseEnvelope>(`/reports/generate`, {
    method: "POST",
    body: {
      user_id: input.userId ?? SETTINGS_USER_ID,
      report_month: input.reportMonth,
      ...(input.baseCurrency ? { base_currency: input.baseCurrency.toUpperCase() } : {}),
      ...(input.exchangeRateId ? { exchange_rate_id: input.exchangeRateId } : {}),
      ...(input.usdToCrcRate ? { usd_to_crc_rate: input.usdToCrcRate } : {}),
      ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    },
  })

  return mapReportSnapshot(data.data ?? data)
}

export async function archiveReportSnapshot(id: number, userId = SETTINGS_USER_ID) {
  const data = await request<GenerateResponseEnvelope>(`/reports/${id}/archive`, {
    method: "PATCH",
    body: {
      user_id: userId,
    },
  })

  return mapReportSnapshot(data.data ?? data)
}

export function getReportPdfUrl(id: number, disposition: "inline" | "attachment" = "attachment") {
  return buildUrl(`/reports/${id}/pdf`, { disposition })
}
