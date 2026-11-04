import { describe, expect, it } from "vitest"

import { navigationContext, navigationCurrent } from "@/lib/navigation"

describe("task navigation and existing deep links", () => {
  it.each([
    ["/", "/", undefined],
    ["/transactions", "/transactions", undefined],
    ["/transactions/import", "/transactions", "/transactions"],
    ["/accounts", "/accounts", undefined],
    ["/envelopes", "/envelopes", undefined],
    ["/reconciliation", "/reconciliation", undefined],
    ["/budgets/7", "/budgets", "/budgets"],
    ["/reports", "/reports", undefined],
    ["/settings", "/settings", undefined],
    ["/institutions", "/settings", "/settings"],
    ["/categories", "/settings", "/settings"],
  ])("%s keeps its destination and parent", (path, active, parent) => {
    expect(navigationContext(path)).toMatchObject({ activeHref: active })
    expect(navigationContext(path).parent?.href).toBe(parent)
    expect(navigationCurrent(path, active)).toBe(path === active ? "page" : "location")
  })

  it.each([
    "/accounts-extra",
    "/settings-extra",
    "/categories-extra",
    "/design-system",
    "/unknown",
  ])("%s never activates a similar prefix or falls back to Resumen", (path) => {
    expect(navigationContext(path)).toEqual({ activeHref: undefined, parent: undefined })
    expect(navigationCurrent(path, "/")).toBeUndefined()
  })
})
