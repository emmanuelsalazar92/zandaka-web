import { z } from "zod"

import { dashboardAccountId, dashboardMonthRange } from "@/lib/dashboard-period"

export const emptyHistoryFilters = {
  dateFrom: "",
  dateTo: "",
  keyword: "",
  type: "ALL",
  accountId: "ALL",
  envelopeId: "ALL",
  amountMin: "",
  amountMax: "",
}
export type HistoryFilters = typeof emptyHistoryFilters
export const historyPageSizes = [10, 25, 50, 100]

export function accountContextHistoryFilters(params: URLSearchParams): HistoryFilters | null {
  if (params.get("source") !== "account-context") return null
  if (params.getAll("accountId").length !== 1 || params.getAll("categoryId").length > 1) return null
  const accountId = dashboardAccountId(params.get("accountId"))
  const categoryId = params.has("categoryId") ? dashboardAccountId(params.get("categoryId")) : "ALL"
  return accountId && categoryId
    ? { ...emptyHistoryFilters, accountId, envelopeId: categoryId }
    : null
}

/** Dashboard links deliberately scope either a month or one account/category. */
export function dashboardHistoryFilters(params: URLSearchParams): HistoryFilters | null {
  if (params.get("source") !== "dashboard") return null
  const month = params.get("month")
  if (month) {
    try {
      const range = dashboardMonthRange(month)
      if (params.has("type") && params.get("type") !== "EXPENSE") return null
      return {
        ...emptyHistoryFilters,
        dateFrom: range.from,
        dateTo: range.to,
        type: params.get("type") ?? "ALL",
      }
    } catch {
      return null
    }
  }
  const accountId = dashboardAccountId(params.get("accountId"))
  const categoryId = dashboardAccountId(params.get("categoryId"))
  return accountId && categoryId
    ? { ...emptyHistoryFilters, accountId, envelopeId: categoryId }
    : null
}

/** Explicit navigation from a reconciliation: account and inclusive cutoff only. */
export function reconciliationHistoryFilters(params: URLSearchParams): HistoryFilters | null {
  if (params.get("source") !== "reconciliation") return null
  const account = params.get("accountId") ?? "",
    to = params.get("to") ?? ""
  const cutoff = new Date(to + "T12:00:00Z")
  if (
    !/^[1-9]\d*$/.test(account) ||
    !Number.isSafeInteger(Number(account)) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
    Number.isNaN(cutoff.getTime()) ||
    cutoff.toISOString().slice(0, 10) !== to
  )
    return null
  return { ...emptyHistoryFilters, accountId: account, dateTo: to }
}
const id = z.number().int().positive().safe()
const optionalName = z.string().nullable().optional()
const line = z.object({
  account_id: id.optional(),
  accountId: id.optional(),
  envelope_id: id.optional(),
  envelopeId: id.optional(),
  amount: z.number().finite(),
  account_name: optionalName,
  accountName: optionalName,
  accountCurrency: optionalName,
  account_currency: optionalName,
  categoryName: optionalName,
  category_name: optionalName,
})
const response = z.object({
  data: z.array(
    z.object({
      id,
      user_id: id.optional(),
      userId: id.optional(),
      date: z.string(),
      description: z.string(),
      type: z.enum(["INCOME", "EXPENSE", "TRANSFER", "ADJUSTMENT"]),
      lines: z.array(line),
    }),
  ),
  meta: z.object({
    page: id,
    pageSize: id,
    totalItems: z.number().int().nonnegative().safe(),
    totalPages: z.number().int().nonnegative().safe(),
    hasNextPage: z.boolean(),
    hasPrevPage: z.boolean(),
  }),
})
export type HistoryTransaction = z.infer<typeof response>["data"][number]
export type HistoryMeta = z.infer<typeof response>["meta"]
export const emptyHistoryMeta: HistoryMeta = {
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPrevPage: false,
}

export function historyQuery(
  filters: HistoryFilters,
  page: number,
  pageSize: number,
  userId: number,
) {
  const query = new URLSearchParams({ userId: String(userId) })
  for (const [key, name] of [
    ["dateFrom", "from"],
    ["dateTo", "to"],
    ["type", "type"],
    ["accountId", "accountId"],
    ["envelopeId", "categoryId"],
    ["keyword", "q"],
    ["amountMin", "amountMin"],
    ["amountMax", "amountMax"],
  ] as const) {
    if (
      filters[key] &&
      (!["type", "accountId", "envelopeId"].includes(key) || filters[key] !== "ALL")
    )
      query.set(name, filters[key])
  }
  query.set("page", String(page))
  query.set("pageSize", String(pageSize))
  query.set("sortBy", "date")
  query.set("sortDir", "desc")
  return query.toString()
}

export function parseHistory(value: unknown, page: number, pageSize: number, userId?: number) {
  const parsed = response.parse(value)
  if (
    parsed.meta.page !== page ||
    parsed.meta.pageSize !== pageSize ||
    parsed.data.length > pageSize ||
    parsed.data.length > Math.max(0, parsed.meta.totalItems - (page - 1) * pageSize) ||
    parsed.data.some(
      (item) => userId !== undefined && (item.userId ?? item.user_id ?? userId) !== userId,
    ) ||
    new Set(parsed.data.map((item) => item.id)).size !== parsed.data.length ||
    parsed.meta.totalPages !== Math.ceil(parsed.meta.totalItems / pageSize)
  )
    throw new Error("Inconsistent history response")
  return parsed
}

export function historyResultLabel(meta: HistoryMeta, count: number) {
  if (meta.page > Math.max(meta.totalPages, 1))
    return "El historial cambió. Cargando la última página disponible."
  if (!count) return "Sin movimientos para mostrar."
  const first = (meta.page - 1) * meta.pageSize + 1
  return `Mostrando ${first}–${first + count - 1} de ${meta.totalItems} movimientos. Página ${meta.page} de ${meta.totalPages}. ${meta.pageSize} por página.`
}

export function historyFilterError(
  filters: HistoryFilters,
): { field: "dateFrom" | "amountMin"; message: string } | null {
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo)
    return { field: "dateFrom", message: "La fecha Desde debe ser anterior o igual a Hasta." }
  if (
    [filters.amountMin, filters.amountMax].some((value) => value && !Number.isFinite(Number(value)))
  )
    return { field: "amountMin", message: "Escribe importes numéricos válidos." }
  if (
    filters.amountMin &&
    filters.amountMax &&
    Number(filters.amountMin) > Number(filters.amountMax)
  )
    return { field: "amountMin", message: "El importe mínimo debe ser menor o igual al máximo." }
  return null
}
