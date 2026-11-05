import { z } from "zod"

import {
  calculateBudgetPlan,
  type BudgetPlanDocument,
  type PlanCalculation,
} from "@/lib/budget-plan"
import { decimal } from "@/lib/money"

export type PlanReceipt = {
  requestId: string
  date: string
  revision: number
  postedAt: string
  transactions: Array<{
    lineId: string
    transactionId: number
    amount: string
    currency: "USD" | "CRC"
    sourceEnvelopeId: number
    targetEnvelopeId: number
    accountId: number
  }>
}
export type SavedBudgetPlan = {
  id: string
  userId: number
  revision: number
  status: "draft" | "finalized" | "funded"
  document: BudgetPlanDocument
  calculation: PlanCalculation
  receipt: PlanReceipt | null
  createdAt: string
  updatedAt: string
}
export type PlanEnvelope = {
  id: number
  accountId: number
  accountName: string
  currency: "USD" | "CRC"
  categoryName: string
  institutionName: string
  balance: number
}
export type PlanOptions = {
  envelopes: PlanEnvelope[]
  accounts: Array<{ id: number; name: string; currency: string; institutionName: string }>
}
export type FundingPreview = {
  transfers: Array<{
    lineId: string
    name: string
    amount: string
    currency: "USD" | "CRC"
    source: PlanEnvelope
    target: PlanEnvelope
  }>
  sources: Array<PlanEnvelope & { required: string; sufficient: boolean }>
}
export class PlanApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public uncertain: boolean,
    public details: Array<{ field: string; detail: string }> = [],
  ) {
    super(
      code === "FEATURE_NOT_READY"
        ? "La planificación de presupuestos aún no está habilitada en este entorno."
        : code === "CONFLICT"
          ? "El plan cambió, ya existe para ese mes o faltan fondos. Actualiza y revisa antes de continuar."
          : code === "FORBIDDEN"
            ? "No tienes acceso a esta operación."
            : code === "VALIDATION_ERROR"
              ? "Revisa los datos y destinos del presupuesto."
              : code === "NOT_FOUND"
                ? "No encontramos este plan."
                : uncertain
                  ? "No pudimos confirmar el resultado. Conservamos el intento para consultar o reintentar sin duplicarlo."
                  : "No pudimos completar la operación. Vuelve a intentar.",
    )
  }
}
const moneyText = z.string().regex(/^-?\d+(?:\.\d+)?$/)
const decimalInput = z
  .string()
  .max(20)
  .regex(/^(?:|(?:0|[1-9]\d{0,9})(?:\.\d{1,6})?)$/)
const month = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/)
const lineSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  group: z.union([z.literal(50), z.literal(30), z.literal(20)]),
  kind: z.enum(["fixed", "percent", "subscription"]),
  currency: z.enum(["USD", "CRC"]),
  payCurrency: z.enum(["USD", "CRC"]),
  amount: decimalInput,
  iva: decimalInput,
  roundUsd: z.enum(["up", "none"]),
  targetEnvelopeId: z.number().int().positive().nullable(),
})
export const planDocumentSchema = z.object({
  version: z.literal(1),
  month,
  incomeMonth: z.union([month, z.literal("")]),
  incomeMode: z.enum(["net", "receipts"]),
  income: z.object({
    net: decimalInput,
    gross: decimalInput,
    ccss: decimalInput,
    tax: decimalInput,
    q1: decimalInput,
    q2: decimalInput,
  }),
  exchange: z.object({
    source: z.string(),
    date: z.string(),
    buy: decimalInput,
    sell: decimalInput,
    margin: decimalInput,
  }),
  incomeAccountId: z.number().int().positive().nullable(),
  retainedAccountId: z.number().int().positive().nullable(),
  sources: z
    .array(
      z.object({ accountId: z.number().int().positive(), envelopeId: z.number().int().positive() }),
    )
    .max(100),
  lines: z.array(lineSchema).max(200),
})
const receiptSchema = z.object({
  requestId: z.string().uuid(),
  date: z.string(),
  revision: z.number().int().positive(),
  postedAt: z.string(),
  transactions: z.array(
    z.object({
      lineId: z.string().uuid(),
      transactionId: z.number().int().positive(),
      amount: moneyText,
      currency: z.enum(["USD", "CRC"]),
      sourceEnvelopeId: z.number().int().positive(),
      targetEnvelopeId: z.number().int().positive(),
      accountId: z.number().int().positive(),
    }),
  ),
})
const savedSchema = z.object({
  id: z.string().uuid(),
  userId: z.literal(1),
  revision: z.number().int().positive(),
  status: z.enum(["draft", "finalized", "funded"]),
  document: planDocumentSchema,
  calculation: z.unknown(),
  receipt: receiptSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export const PLAN_USER_ID = 1
export async function planRequest<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response
  const controller = new AbortController()
  const cancel = () => controller.abort()
  if (signal?.aborted) controller.abort()
  signal?.addEventListener("abort", cancel, { once: true })
  const timeout = setTimeout(cancel, 20_000)
  let payload: unknown
  try {
    response = await fetch(
      `/api/budget-plans${path}${path.includes("?") ? "&" : "?"}userId=${PLAN_USER_ID}`,
      {
        method,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    )
    payload = await response.json().catch(() => null)
  } catch (error) {
    if (signal?.aborted && error instanceof DOMException && error.name === "AbortError") throw error
    throw new PlanApiError(0, "NETWORK", method !== "GET")
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener("abort", cancel)
  }
  if (!response.ok) {
    const error =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as { error: { code?: unknown; details?: unknown } }).error
        : null
    const details = Array.isArray(error?.details)
      ? error.details.filter(
          (x): x is { field: string; detail: string } =>
            typeof x?.field === "string" && typeof x?.detail === "string",
        )
      : []
    throw new PlanApiError(
      response.status,
      typeof error?.code === "string" ? error.code : "UNKNOWN",
      method !== "GET" && response.status >= 500 && error?.code !== "FEATURE_NOT_READY",
      details,
    )
  }
  if (payload === null) throw new PlanApiError(0, "INVALID_REPLY", method !== "GET")
  return payload as T
}
export function parseSavedPlan(value: unknown, id?: string): SavedBudgetPlan {
  const parsed = savedSchema.safeParse(value)
  if (
    !parsed.success ||
    (id && parsed.data.id !== id) ||
    parsed.data.document.month === undefined ||
    (parsed.data.status === "funded") !== !!parsed.data.receipt
  )
    throw new PlanApiError(0, "INVALID_REPLY", true)
  const result = parsed.data as SavedBudgetPlan
  if (result.receipt) {
    const receipt = result.receipt,
      expected = calculateBudgetPlan(result.document)
    if (
      receipt.revision + 1 !== result.revision ||
      receipt.transactions.length !== result.document.lines.length ||
      new Set(receipt.transactions.map((t) => t.lineId)).size !== receipt.transactions.length ||
      new Set(receipt.transactions.map((t) => t.transactionId)).size !==
        receipt.transactions.length ||
      receipt.transactions.some((t) => {
        const line = result.document.lines.find((l) => l.id === t.lineId),
          value = expected.lines.find((l) => l.id === t.lineId)
        return (
          !line ||
          !value ||
          line.targetEnvelopeId !== t.targetEnvelopeId ||
          value.payCurrency !== t.currency ||
          !decimal(value.payAmount).eq(t.amount) ||
          result.document.sources.find((s) => s.accountId === t.accountId)?.envelopeId !==
            t.sourceEnvelopeId ||
          t.sourceEnvelopeId === t.targetEnvelopeId
        )
      })
    )
      throw new PlanApiError(0, "INVALID_REPLY", true)
  }
  return result
}
export async function getPlan(id: string, signal?: AbortSignal) {
  return parseSavedPlan(await planRequest(`/${id}`, "GET", undefined, signal), id)
}
export async function savePlan(id: string, expectedRevision: number, document: BudgetPlanDocument) {
  const result = parseSavedPlan(
    await planRequest(`/${id}`, "PUT", { userId: PLAN_USER_ID, expectedRevision, document }),
    id,
  )
  if (
    result.revision !== expectedRevision + 1 ||
    JSON.stringify(planDocumentSchema.parse(result.document)) !==
      JSON.stringify(planDocumentSchema.parse(document))
  )
    throw new PlanApiError(0, "INVALID_REPLY", true)
  return result
}
export async function transitionPlan(id: string, revision: number, action: "finalize" | "reopen") {
  const result = parseSavedPlan(
    await planRequest(`/${id}/${action}`, "POST", { userId: PLAN_USER_ID, revision }),
    id,
  )
  if (
    result.revision !== revision + 1 ||
    result.status !== (action === "finalize" ? "finalized" : "draft")
  )
    throw new PlanApiError(0, "INVALID_REPLY", true)
  return result
}
export async function fundPlan(id: string, revision: number, requestId: string, date: string) {
  const result = parseSavedPlan(
    await planRequest(`/${id}/fund`, "POST", { userId: PLAN_USER_ID, revision, requestId, date }),
    id,
  )
  if (
    result.status !== "funded" ||
    result.receipt?.requestId !== requestId ||
    result.receipt.revision !== revision ||
    result.receipt.date !== date
  )
    throw new PlanApiError(0, "INVALID_REPLY", true)
  return result
}
