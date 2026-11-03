import { describe, expect, it } from "vitest"

import { exchangeRateInfo } from "@/lib/exchange-rate-info"

describe("exchange rate provenance and date", () => {
  const rate = { compra: 500, venta: 510, fecha: "03/11/2026" }
  it("distinguishes the current quote from an earlier quote", () => {
    expect(exchangeRateInfo(rate, "2026-11-03")).toMatchObject({
      usable: true,
      ageInDays: 0,
      ageLabel: "Cotización del día",
      date: "03/11/2026",
      source: "tipodecambio.paginasweb.cr",
    })
    expect(exchangeRateInfo({ ...rate, fecha: "2026-10-31" }, "2026-11-03")).toMatchObject({
      usable: true,
      ageInDays: 3,
      ageLabel: "Hace 3 días",
    })
  })
  it("does not accept an absent, impossible, future or invalid quote", () => {
    for (const value of [
      null,
      { ...rate, fecha: "31/02/2026" },
      { ...rate, fecha: "04/11/2026" },
      { ...rate, compra: 0 },
      { ...rate, venta: NaN },
    ]) {
      expect(exchangeRateInfo(value, "2026-11-03").usable).toBe(false)
    }
  })
})
