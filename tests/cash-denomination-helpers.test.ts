import { describe, expect, it } from "vitest"

import {
  buildDenominationPayloadLines,
  calculateDenominationCountedTotal,
} from "@/lib/cash-denomination-helpers"

describe("cash denomination helpers", () => {
  it("builds the reconciliation payload sorted by sort order and filters zero quantities", () => {
    const denominations = [
      { id: 2, value: 1000, sortOrder: 2 },
      { id: 1, value: 2000, sortOrder: 1 },
      { id: 3, value: 100, sortOrder: 3 },
    ]

    const quantities = {
      1: "4",
      2: "3",
      3: "",
    }

    expect(buildDenominationPayloadLines(denominations, quantities)).toEqual([
      { denominationId: 1, quantity: 4 },
      { denominationId: 2, quantity: 3 },
    ])
  })

  it("calculates counted total from denomination quantities", () => {
    const denominations = [
      { id: 1, value: 2000, sortOrder: 1 },
      { id: 2, value: 1000, sortOrder: 2 },
      { id: 3, value: 100, sortOrder: 3 },
    ]

    const quantities = {
      1: "4",
      2: "3",
      3: "11",
    }

    expect(calculateDenominationCountedTotal(denominations, quantities)).toBe(12100)
  })
})
