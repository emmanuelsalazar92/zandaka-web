import { z } from "zod"

import { readPublicError } from "@/lib/public-error"

const id = z.number().int().positive().safe()
const active = z.union([z.boolean(), z.literal(0), z.literal(1)])
const owner = { user_id: id.optional() }
const category = z.object({
  id,
  name: z.string(),
  parent_id: id.nullable(),
  is_active: active,
  ...owner,
})
const institution = z.object({
  id,
  name: z.string(),
  type: z.enum(["BANK", "CASH", "VIRTUAL"]),
  is_active: active,
  ...owner,
})
export type CatalogCategory = { id: number; name: string; parentId: number | null }
export type CatalogInstitution = {
  id: number
  name: string
  type: "BANK" | "CASH" | "VIRTUAL"
  active: boolean
}
const own = (row: { user_id?: number }) => row.user_id === undefined || row.user_id === 1
const unique = <T extends { id: number }>(rows: T[]) => {
  if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error("Catálogo duplicado")
  return rows
}
export function parseCatalogCategories(value: unknown): CatalogCategory[] {
  return unique(z.array(category).parse(value))
    .filter((row) => own(row) && !!row.is_active)
    .map((row) => ({ id: row.id, name: row.name, parentId: row.parent_id }))
}
export function parseCatalogInstitutions(value: unknown): CatalogInstitution[] {
  return unique(z.array(institution).parse(value))
    .filter(own)
    .map((row) => ({ id: row.id, name: row.name, type: row.type, active: !!row.is_active }))
}
export function parseInstitutionCounts(value: unknown): Record<number, number> {
  const rows = unique(
    z.array(z.object({ id, institution_id: id, is_active: active, ...owner })).parse(value),
  )
  const counts: Record<number, number> = {}
  for (const row of rows.filter(own))
    if (row.is_active) counts[row.institution_id] = (counts[row.institution_id] ?? 0) + 1
  return counts
}
export const catalogSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim()

/** Keeps orphan/cyclic historical rows visible without rewriting their relationships. */
export function categoryPaths(rows: CatalogCategory[]) {
  const byId = new Map(rows.map((row) => [row.id, row]))
  return rows
    .map((row) => {
      const seen = new Set([row.id]),
        ancestors: CatalogCategory[] = []
      let next = row.parentId,
        unresolved = false
      while (next !== null) {
        const parent = byId.get(next)
        if (!parent || seen.has(next)) {
          unresolved = true
          break
        }
        seen.add(next)
        ancestors.unshift(parent)
        next = parent.parentId
      }
      return {
        ...row,
        ancestors,
        unresolved,
        path: [...ancestors, row].map((item) => item.name).join(" / "),
      }
    })
    .sort((a, b) => a.path.localeCompare(b.path, "es") || a.id - b.id)
}
export function categoryParentOptions(rows: CatalogCategory[], editingId?: number) {
  return categoryPaths(rows).filter(
    (row) =>
      !row.unresolved &&
      row.id !== editingId &&
      !row.ancestors.some((ancestor) => ancestor.id === editingId),
  )
}
const returnTargets: Record<string, string> = {
  "/settings": "Ajustes",
  "/accounts": "Cuentas",
  "/envelopes": "Sobres",
  "/budgets": "Presupuestos",
}
export function catalogReturn(value: string | null) {
  return value && Object.hasOwn(returnTargets, value)
    ? { href: value, label: `Volver a ${returnTargets[value]}` }
    : { href: "/settings", label: "Volver a Ajustes" }
}
export function catalogLink(href: "/institutions" | "/categories", returnTo: string) {
  return `${href}?${new URLSearchParams({ returnTo: catalogReturn(returnTo).href })}`
}
/** Only list-level NOT_FOUND means an empty legacy catalog, never an arbitrary failed read. */
export async function readCatalog(
  path: "/institutions" | "/categories?activeOnly=true",
  signal: AbortSignal,
) {
  const response = await fetch(`/api${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
  })
  if (response.status === 404) {
    const payload = await response
      .clone()
      .json()
      .catch(() => null)
    if (payload?.error?.code === "NOT_FOUND") return []
  }
  if (!response.ok)
    throw new Error(await readPublicError(response, "No pudimos cargar el catálogo."))
  return response.json() as Promise<unknown>
}
