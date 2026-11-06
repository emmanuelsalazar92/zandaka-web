import { assertMoney, decimalNumber } from "@/lib/money"
import { publicErrorMessage } from "@/lib/public-error"
import { SETTINGS_USER_ID } from "@/lib/settings-api"

const API_BASE_URL = "/api"

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
  ccssRuleSetId?: number | null
  incomeTaxRuleSetId?: number | null
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
  rateMode?: "auto" | "stored" | "manual"
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
  if (typeof value === "number" && Number.isFinite(value)) return decimalNumber(value)
  if (typeof value === "string" && value.trim() !== "") {
    return decimalNumber(value.trim())
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

const getErrorMessage = (payload: ApiErrorPayload | null, fallback: string) =>
  publicErrorMessage(payload, fallback)

async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const response = await fetch(buildUrl(path, options?.query), {
    method: options?.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
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
      message: getErrorMessage(
        errorPayload,
        "No pudimos completar la consulta. Vuelve a intentar.",
      ),
    })
  }

  return payload as T
}

const mapReportSnapshot = (raw: unknown): ReportSnapshot => {
  if (!raw || typeof raw !== "object") throw new Error("Versión de reporte no disponible.")
  const item = raw as Record<string, unknown>
  const result: ReportSnapshot = {
    id: toNumber(item.id),
    userId: toNumber(item.userId ?? item.user_id),
    reportMonth: toStringValue(item.reportMonth ?? item.report_month),
    generatedAt: toStringValue(item.generatedAt ?? item.generated_at),
    baseCurrency: toStringValue(item.baseCurrency ?? item.base_currency).toUpperCase(),
    totalCrc: toNumber(item.totalCrc ?? item.total_crc, Number.NaN),
    totalUsd: toNumber(item.totalUsd ?? item.total_usd, Number.NaN),
    exchangeRateUsed: toNullableNumber(item.exchangeRateUsed ?? item.exchange_rate_used),
    exchangeRateId: toNullableNumber(item.exchangeRateId ?? item.exchange_rate_id),
    ccssRuleSetId: toNullableNumber(item.ccssRuleSetId ?? item.ccss_rule_set_id),
    incomeTaxRuleSetId: toNullableNumber(item.incomeTaxRuleSetId ?? item.income_tax_rule_set_id),
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
  if (
    !Number.isSafeInteger(result.id) ||
    result.id <= 0 ||
    !Number.isSafeInteger(result.version) ||
    result.version <= 0 ||
    !/^[A-Z]{3}$/.test(result.baseCurrency) ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(result.reportMonth)
  )
    throw new Error("Versión de reporte no disponible.")
  assertMoney(result.totalCrc, "CRC")
  assertMoney(result.totalUsd, "USD")
  if (result.consolidatedAmount !== null)
    assertMoney(result.consolidatedAmount, result.baseCurrency)
  return result
}

export async function fetchReportSnapshots(userId = SETTINGS_USER_ID, includeArchived = false) {
  const data = await request<unknown[]>(`/reports`, {
    query: { userId, includeArchived: includeArchived ? 1 : undefined },
  })

  if (!Array.isArray(data)) throw new Error("El archivo de reportes no está disponible.")
  return data.map(mapReportSnapshot)
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
      ...(input.rateMode ? { rate_mode: input.rateMode } : {}),
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

export function getReportHtmlUrl(id: number) {
  return buildUrl(`/reports/${id}/html`)
}
