import { describe, expect, it } from "vitest"

import {
  buildEnvelopeInsights,
  calculateEnvelopePercentage,
  getEnvelopeBarPercentage,
  getEnvelopeVisualStatus,
  summarizeEnvelopeInsights,
} from "@/lib/envelope-insights"

describe("envelope insights", () => {
  it("calculates percentages and bar widths safely", () => {
    expect(calculateEnvelopePercentage(500, 2000)).toBe(0.25)
    expect(calculateEnvelopePercentage(500, 0)).toBe(0)
    expect(getEnvelopeBarPercentage(0.25)).toBe(25)
    expect(getEnvelopeBarPercentage(2.4)).toBe(100)
  })

  it("assigns visual states consistently", () => {
    expect(getEnvelopeVisualStatus(1000, 10000)).toBe("healthy")
    expect(getEnvelopeVisualStatus(100, 10000)).toBe("low")
    expect(getEnvelopeVisualStatus(0, 10000)).toBe("empty")
    expect(getEnvelopeVisualStatus(-25, 10000)).toBe("critical")
  })

  it("builds insights and summary metrics", () => {
    const envelopes = [
      {
        id: 1,
        accountId: 2,
        categoryId: 3,
        category: "Ahorro",
        balance: 5000,
        currency: "CRC",
        active: true,
      },
      {
        id: 2,
        accountId: 2,
        categoryId: 4,
        category: "Ropa",
        balance: 500,
        currency: "CRC",
        active: true,
      },
      {
        id: 3,
        accountId: 2,
        categoryId: 5,
        category: "Viaje",
        balance: -25,
        currency: "CRC",
        active: true,
      },
      {
        id: 4,
        accountId: 2,
        categoryId: 6,
        category: "Salud",
        balance: 0,
        currency: "CRC",
        active: true,
      },
    ]

    const insights = buildEnvelopeInsights(envelopes, 5475)
    expect(insights[0].statusVisual).toBe("healthy")
    expect(insights[1].statusVisual).toBe("healthy")
    expect(insights[2].statusVisual).toBe("critical")
    expect(insights[3].statusVisual).toBe("empty")

    const summary = summarizeEnvelopeInsights(envelopes, 5475)
    expect(summary.activeEnvelopesCount).toBe(4)
    expect(summary.negativeEnvelopesCount).toBe(1)
    expect(summary.largestEnvelope?.category).toBe("Ahorro")
    expect(summary.smallestPositiveEnvelope?.category).toBe("Ropa")
    expect(summary.availableDelta).toBe(0)
  })
})
