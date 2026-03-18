import { describe, expect, it } from "vitest"

import { formatIsoDateOnly } from "@/lib/date-only"

describe("date-only helpers", () => {
  it("formats ISO date-only values without using timezone conversion", () => {
    expect(formatIsoDateOnly("2026-03-02")).toBe("02/03/2026")
  })

  it("returns non ISO date-only input unchanged", () => {
    expect(formatIsoDateOnly("2026-03-02T00:00:00.000Z")).toBe("2026-03-02T00:00:00.000Z")
    expect(formatIsoDateOnly("")).toBe("")
  })
})
