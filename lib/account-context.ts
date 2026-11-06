import { z } from "zod"

import type { AccountUi, InstitutionUi } from "@/components/accounts/types/accounts.types"
import { assertMoney, percentageFromAmount, sumMoney } from "@/lib/money"
import { readPublicError } from "@/lib/public-error"

const id = z.number().int().positive().safe()
const active = z
  .union([z.boolean(), z.literal(0), z.literal(1)])
  .transform((value) => value === true || value === 1)
const balance = z.number().finite().nullable().optional()
const account = z.object({
  id,
  user_id: id.optional(),
  name: z.string(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  is_active: active,
  institution_id: id.nullable().optional(),
  institution: z.string().nullable().optional(),
  balance,
  has_active_envelopes: active.nullable().optional(),
  active_envelopes_count: z.number().int().nonnegative().nullable().optional(),
  allow_overdraft: active,
  type: z.string().nullable().optional(),
})
const envelope = z.object({
  envelopeId: id,
  categoryId: id,
  categoryName: z.string(),
  currency: z.string(),
  balance,
})
const institution = z.object({
  id,
  name: z.string(),
  type: z.enum(["BANK", "CASH", "VIRTUAL"]),
  is_active: active,
  user_id: id.optional(),
})
const category = z.object({
  id,
  name: z.string(),
  parent_id: id.nullable().optional(),
  parentId: id.nullable().optional(),
  active: active.optional(),
  is_active: active.optional(),
  user_id: id.optional(),
})
export type ContextEnvelope = {
  id: number
  accountId: number
  categoryId: number
  name: string
  currency: string
  balance: number | null
}
export type ContextCategory = { id: number; name: string; parentId: number | null }
function unique<T>(rows: T[], key: (row: T) => number) {
  if (new Set(rows.map(key)).size !== rows.length) throw new Error("Información duplicada")
  return rows
}
export function parseContextAccounts(value: unknown): AccountUi[] {
  return unique(z.array(account).parse(value), (row) => row.id)
    .filter((row) => row.is_active && (row.user_id === undefined || row.user_id === 1))
    .map((row) => ({
      id: row.id,
      name: row.name,
      currency: row.currency,
      active: row.is_active,
      institutionId: row.institution_id ?? null,
      institution: row.institution ?? "Institución por confirmar",
      type: row.type ?? null,
      balance: row.balance == null ? null : assertMoney(row.balance, row.currency),
      hasActiveEnvelopes: row.has_active_envelopes ?? null,
      activeEnvelopesCount: row.active_envelopes_count ?? null,
      allowOverdraft: row.allow_overdraft,
    }))
}
export function parseContextEnvelopes(
  value: unknown,
  account: Pick<AccountUi, "id" | "currency">,
): ContextEnvelope[] {
  return unique(z.array(envelope).parse(value), (row) => row.envelopeId).map((row) => {
    if (row.currency !== account.currency) throw new Error("Moneda fuera de contexto")
    return {
      id: row.envelopeId,
      accountId: account.id,
      categoryId: row.categoryId,
      name: row.categoryName,
      currency: row.currency,
      balance: row.balance == null ? null : assertMoney(row.balance, row.currency),
    }
  })
}
export function parseContextInstitutions(value: unknown): InstitutionUi[] {
  return unique(z.array(institution).parse(value), (row) => row.id)
    .filter((row) => row.user_id === undefined || row.user_id === 1)
    .map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.is_active ? "Active" : "Inactive",
    }))
}
export function parseContextCategories(value: unknown): ContextCategory[] {
  return unique(z.array(category).parse(value), (row) => row.id)
    .filter(
      (row) =>
        (row.user_id === undefined || row.user_id === 1) && (row.active ?? row.is_active ?? true),
    )
    .map((row) => ({ id: row.id, name: row.name, parentId: row.parentId ?? row.parent_id ?? null }))
}
export function contextTotals(accounts: AccountUi[]) {
  const codes = [...new Set(accounts.map((row) => row.currency))].sort()
  return codes.map((currency) => {
    const rows = accounts.filter((row) => row.currency === currency)
    let total: number | null = null
    try {
      if (rows.every((row) => row.balance !== null))
        total = sumMoney(rows.map((row) => row.balance!))
    } catch {
      /* Keep unrepresentable totals unconfirmed. */
    }
    return { currency, total, count: rows.length }
  })
}
export function contextDistribution(rows: ContextEnvelope[]) {
  const known = rows.every((row) => row.balance !== null)
  const negative = rows.filter((row) => row.balance !== null && row.balance < 0)
  try {
    if (new Set(rows.map((row) => row.currency)).size > 1) throw new Error("Monedas diferentes")
    const total = known ? sumMoney(rows.map((row) => row.balance!)) : null
    const positive = known
      ? sumMoney(rows.filter((row) => row.balance! > 0).map((row) => row.balance!))
      : null
    return {
      total,
      positive,
      negative,
      share: (row: ContextEnvelope) =>
        positive !== null && positive > 0 && row.balance !== null && row.balance > 0
          ? percentageFromAmount(row.balance, positive)
          : null,
    }
  } catch {
    return {
      total: null,
      positive: null,
      negative,
      share: (_row: ContextEnvelope): number | null => null,
    }
  }
}
export function contextActivityLink(accountId: number, categoryId?: number) {
  return `/transactions?${new URLSearchParams({ source: "account-context", accountId: String(accountId), ...(categoryId ? { categoryId: String(categoryId) } : {}) })}`
}
export function canDeactivateContextAccount(account: AccountUi) {
  return (
    account.active && account.hasActiveEnvelopes === false && account.activeEnvelopesCount === 0
  )
}
export function selectContextRows<T extends { name: string; balance: number | null }>(
  rows: T[],
  query: string,
  order: string,
) {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es")
  const search = normalize(query.trim())
  return rows
    .filter((row) => normalize(row.name).includes(search))
    .sort((a, b) => {
      if (order === "name") return a.name.localeCompare(b.name, "es")
      if ("currency" in a && "currency" in b && a.currency !== b.currency)
        return String(a.currency).localeCompare(String(b.currency))
      if (a.balance === null || b.balance === null)
        return Number(a.balance === null) - Number(b.balance === null)
      return (
        (order === "asc" ? a.balance - b.balance : b.balance - a.balance) ||
        a.name.localeCompare(b.name, "es")
      )
    })
}
export async function contextRead(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(`/api${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
      : AbortSignal.timeout(15_000),
  })
  if (!response.ok)
    throw new Error(
      await readPublicError(response, "No pudimos consultar esta información. Vuelve a intentar."),
    )
  return response.json()
}
export class ContextWriteError extends Error {
  constructor(
    message: string,
    readonly uncertain: boolean,
  ) {
    super(message)
  }
}
export async function contextWrite(
  path: string,
  method: "POST" | "PATCH",
  body?: unknown,
): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new ContextWriteError(
      "El resultado está por confirmar. Actualiza el listado antes de volver a enviar; no repetimos la operación automáticamente.",
      true,
    )
  }
  if (!response.ok)
    throw new ContextWriteError(
      response.status >= 500
        ? "El resultado está por confirmar. Revisa el listado antes de repetir la operación."
        : await readPublicError(response, "No pudimos completar la operación. Revisa los datos."),
      response.status >= 500,
    )
  if (response.status === 204) {
    if (method === "POST" && /^\/(accounts|envelopes)\/[1-9]\d*\/deactivate$/.test(path))
      return null
    throw new ContextWriteError(
      "No pudimos verificar el identificador creado. Revisa el listado antes de repetir la operación.",
      true,
    )
  }
  try {
    const value: unknown = await response.json()
    z.object({ id }).parse(value)
    return value
  } catch {
    throw new ContextWriteError(
      "No pudimos verificar la confirmación. Revisa el listado antes de repetir la operación.",
      true,
    )
  }
}
