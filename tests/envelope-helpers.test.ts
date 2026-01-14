import { describe, expect, it } from "vitest"

import { getEnvelopeStatus, getEnvelopesByAccount } from "@/lib/envelope-helpers"

describe("envelope helpers", () => {
  it("filters envelopes by account", () => {
    const envelopes = [
      { id: 1, accountId: 1, categoryId: 1, balance: 100, active: true },
      { id: 2, accountId: 2, categoryId: 2, balance: -50, active: true },
      { id: 3, accountId: 1, categoryId: 3, balance: 0, active: false },
    ]

    expect(getEnvelopesByAccount(envelopes, 1)).toHaveLength(2)
    expect(getEnvelopesByAccount(envelopes, 2)).toHaveLength(1)
  })

  it("returns the correct envelope status", () => {
    expect(getEnvelopeStatus(10)).toBe("positive")
    expect(getEnvelopeStatus(-1)).toBe("negative")
    expect(getEnvelopeStatus(0)).toBe("empty")
  })
})
