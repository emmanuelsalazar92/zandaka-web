import { describe, expect, it } from "vitest"

import { formatCurrency, formatSignedCurrency } from "@/lib/currency-formatter"
import { formatAccountingTimestamp, formatIsoDateOnly } from "@/lib/date-only"
import { publicErrorMessage, readPublicError } from "@/lib/public-error"

describe("Costa Rica product conventions", () => {
  it("keeps CRC and USD explicit with the same decimal convention and a negative sign", () => {
    for (const currency of ["CRC", "USD"]) {
      expect(formatCurrency(1234.56, currency)).toContain(currency)
      expect(formatCurrency(1234.56, currency)).toContain(",56")
      expect(formatSignedCurrency(-0.01, currency)).toMatch(new RegExp("^-" + currency))
    }
  })
  it("keeps accounting dates separate from UTC capture timestamps", () => {
    expect(formatIsoDateOnly("2026-11-03")).toBe("03/11/2026")
    expect(formatAccountingTimestamp("2026-11-03 00:30:00")).toBe(
      formatAccountingTimestamp("2026-11-02T18:30:00-06:00"),
    )
    expect(formatAccountingTimestamp("2026-11-03")).toBe("03/11/2026")
  })
  it("replaces internal server messages with actionable Spanish copy while preserving code semantics", () => {
    expect(
      publicErrorMessage(
        { error: { code: "VALIDATION_ERROR", message: "SQL constraint failed" } },
        "Vuelve a intentar.",
      ),
    ).toBe("Revisa los campos indicados y vuelve a intentar.")
    expect(publicErrorMessage({ message: "stack trace" }, "Vuelve a intentar.")).toBe(
      "Vuelve a intentar.",
    )
  })
  it("does not expose malformed or HTML server responses", async () => {
    const response = new Response("<html>Internal exception and SQL detail</html>", { status: 500 })
    expect(await readPublicError(response, "Vuelve a intentar.")).toBe("Vuelve a intentar.")
  })
})
