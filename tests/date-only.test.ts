import { describe, expect, it } from "vitest"

import { formatIsoDateOnly, getAccountingDate } from "@/lib/date-only"

describe("date-only helpers", () => {
  it("keeps the Costa Rica business day after UTC midnight", () => {
    expect(getAccountingDate(new Date("2026-11-03T00:30:00Z"))).toBe("2026-11-02")
    expect(getAccountingDate(new Date("2026-11-03T05:59:59Z"))).toBe("2026-11-02")
    expect(getAccountingDate(new Date("2026-11-03T06:00:00Z"))).toBe("2026-11-03")
  })

  it("does not depend on the timezone encoded in an input timestamp", () => {
    expect(getAccountingDate(new Date("2026-11-02T18:30:00-06:00"))).toBe("2026-11-02")
  })
  it("formats ISO date-only values without using timezone conversion", () => {
    expect(formatIsoDateOnly("2026-03-02")).toBe("02/03/2026")
  })

  it("returns non ISO date-only input unchanged", () => {
    expect(formatIsoDateOnly("2026-03-02T00:00:00.000Z")).toBe("2026-03-02T00:00:00.000Z")
    expect(formatIsoDateOnly("")).toBe("")
  })
})
