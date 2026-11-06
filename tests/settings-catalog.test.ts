import { afterEach, describe, expect, it, vi } from "vitest"

import { contextWrite } from "@/lib/account-context"
import { fetchAutoAssignmentRules, testAutoAssignmentRule } from "@/lib/settings-api"
import {
  catalogLink,
  catalogReturn,
  catalogSearch,
  categoryParentOptions,
  categoryPaths,
  parseCatalogCategories,
  parseCatalogInstitutions,
  parseInstitutionCounts,
  readCatalog,
} from "@/lib/settings-catalog"
import { rulePriority } from "@/lib/settings-presentation"

afterEach(() => vi.unstubAllGlobals())

describe("settings catalog contracts and relationships", () => {
  const rows = [
    { id: 1, name: "Necesidades", parentId: null },
    { id: 2, name: "Casa", parentId: 1 },
    { id: 3, name: "Teléfono", parentId: 2 },
    { id: 4, name: "Ocio", parentId: null },
  ]
  it("preserves complete paths and finds accented descendants without opening the tree", () => {
    const result = categoryPaths(rows)
    expect(result.find((row) => row.id === 3)?.path).toBe("Necesidades / Casa / Teléfono")
    expect(
      result.filter((row) => catalogSearch(row.path).includes("telefono")).map((row) => row.id),
    ).toEqual([3])
    expect(rows[2].parentId).toBe(2)
  })
  it("keeps malformed historical relationships visible and terminates cycles", () => {
    const result = categoryPaths([
      { id: 1, name: "Ciclo A", parentId: 2 },
      { id: 2, name: "Ciclo B", parentId: 1 },
      { id: 3, name: "Huérfana", parentId: 99 },
    ])
    expect(result).toHaveLength(3)
    expect(result.every((row) => row.unresolved)).toBe(true)
    expect(categoryParentOptions(result)).toEqual([])
  })
  it("excludes self and descendants from reparenting without dropping valid branches", () => {
    expect(categoryParentOptions(rows, 1).map((row) => row.id)).toEqual([4])
    expect(categoryParentOptions(rows, 2).map((row) => row.id)).toEqual([1, 4])
  })
  it("rejects corrupt/duplicate catalogs instead of inventing IDs or an empty state", () => {
    expect(() => parseCatalogCategories({ items: [] })).toThrow()
    expect(() =>
      parseCatalogCategories([{ id: "1", name: "Uno", parent_id: null, is_active: 1 }]),
    ).toThrow()
    const row = { id: 1, name: "Uno", type: "BANK", is_active: 1 }
    expect(() => parseCatalogInstitutions([row, row])).toThrow()
    expect(() => parseCatalogInstitutions([{ ...row, type: "UNKNOWN" }])).toThrow()
  })
  it("filters declared foreign ownership and inactive categories while retaining inactive institutions", () => {
    const base = { name: "Uno", parent_id: null, is_active: 1 }
    expect(
      parseCatalogCategories([
        { ...base, id: 1 },
        { ...base, id: 2, user_id: 2 },
        { ...base, id: 3, is_active: 0 },
      ]),
    ).toEqual([{ id: 1, name: "Uno", parentId: null }])
    expect(
      parseCatalogInstitutions([{ id: 1, name: "Archivado", type: "CASH", is_active: 0 }])[0]
        .active,
    ).toBe(false)
  })
  it("counts active owned accounts only and never treats a malformed dependency read as zero", () => {
    expect(
      parseInstitutionCounts([
        { id: 1, institution_id: 2, is_active: 1 },
        { id: 2, institution_id: 2, is_active: 0 },
        { id: 3, institution_id: 2, is_active: 1, user_id: 2 },
      ]),
    ).toEqual({ 2: 1 })
    expect(() => parseInstitutionCounts([{ id: 1, institution_id: 2 }])).toThrow()
  })
  it.each([
    "https://evil.test",
    "//evil.test",
    "/accounts?redirect=external",
    "javascript:alert(1)",
    "/api/categories",
    "/%2fexternal",
  ])("rejects unsafe return target %s", (target) => {
    expect(catalogReturn(target).href).toBe("/settings")
  })
  it("carries a whitelisted return workflow without changing legacy routes", () => {
    expect(catalogReturn("/accounts").label).toBe("Volver a Cuentas")
    expect(catalogLink("/categories", "/envelopes")).toBe("/categories?returnTo=%2Fenvelopes")
  })
  it("recognizes only a list-level NOT_FOUND as an empty legacy catalog", async () => {
    const fetch = vi.fn(async () =>
      Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 }),
    )
    vi.stubGlobal("fetch", fetch)
    await expect(readCatalog("/institutions", new AbortController().signal)).resolves.toEqual([])
    fetch.mockImplementation(async () =>
      Response.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 }),
    )
    await expect(readCatalog("/institutions", new AbortController().signal)).rejects.toThrow()
  })
  it("accepts 204 only for documented deactivations and does not retry uncertain writes", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetch)
    await expect(contextWrite("/institutions/1/deactivate", "POST")).resolves.toBeNull()
    await expect(contextWrite("/categories/1/deactivate", "POST")).resolves.toBeNull()
    await expect(contextWrite("/categories", "POST", {})).rejects.toMatchObject({ uncertain: true })
    await expect(contextWrite("/institutions/1/deactivate", "PATCH")).rejects.toMatchObject({
      uncertain: true,
    })
    expect(fetch).toHaveBeenCalledTimes(4)
  })
  it("does not silently truncate fractional, exponential or unsafe priorities", () => {
    expect(rulePriority("100")).toBe(100)
    expect(rulePriority("-2")).toBe(-2)
    for (const invalid of ["1.5", "1e2", "", "0x10", "2x", "9007199254740992"])
      expect(rulePriority(invalid)).toBeNull()
  })
  it("withholds a rule list on corrupt data instead of showing an empty or invented priority", async () => {
    const fetch = vi.fn(async () => Response.json({ items: [] }))
    vi.stubGlobal("fetch", fetch)
    await expect(fetchAutoAssignmentRules()).rejects.toThrow()
    fetch.mockImplementation(async () =>
      Response.json([
        { id: 1, user_id: 1, pattern: "Netflix", match_type: "CONTAINS", is_active: 1 },
      ]),
    )
    await expect(fetchAutoAssignmentRules()).rejects.toThrow()
  })
  it("rejects inconsistent tester confirmations and uses only the read-only test endpoint", async () => {
    const fetch = vi.fn(async () =>
      Response.json({ description: "Prueba", matched: true, matchedRule: null, matches: [] }),
    )
    vi.stubGlobal("fetch", fetch)
    await expect(testAutoAssignmentRule("Prueba")).rejects.toThrow()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0]).toEqual([
      "/api/auto-assignment-rules/test",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ userId: 1, description: "Prueba" }),
      }),
    ])
  })
})
