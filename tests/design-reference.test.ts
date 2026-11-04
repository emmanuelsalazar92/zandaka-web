import { describe, expect, it } from "vitest"

import { referenceContext, referenceEnvelopes, referenceShare } from "@/lib/design-reference"

describe("fictional composition reference financial meaning", () => {
  it("includes the negative envelope in the account total, but not in the positive distribution", () => {
    const result = referenceContext(1, "complete")
    expect(result.balance).toBe(897500)
    expect(result.positive).toBe(906500)
    expect(result.negative.map((r) => r.balance)).toEqual([-9000])
    expect(referenceShare(-9000, result.positive)).toBeNull()
    expect(referenceShare(0, result.positive)).toBeNull()
    expect(referenceShare(600000, result.positive)).toBe(66.19)
  })
  it("changes account and currency without consolidating CRC and USD", () => {
    const result = referenceContext(2, "complete")
    expect(result.account.currency).toBe("USD")
    expect(result.balance).toBe(5151)
    expect(result.rows.map((r) => r.id)).toEqual([21, 22])
  })
  it("never turns pending, failed or loading information into zero or a complete subtotal", () => {
    for (const scenario of ["pending", "error", "loading"] as const) {
      const result = referenceContext(1, scenario)
      expect(result.balance).toBeNull()
      expect(result.positive).toBeNull()
      expect(referenceShare(85000, result.positive)).toBeNull()
    }
    expect(referenceContext(1, "pending").negative).toHaveLength(1)
    expect(referenceEnvelopes[1][0].balance).toBe(600000)
  })
  it("distinguishes a confirmed empty account from unavailable information", () => {
    expect(referenceContext(1, "empty")).toMatchObject({ balance: 0, positive: 0, rows: [] })
    expect(referenceShare(null, 906500)).toBeNull()
  })
})
