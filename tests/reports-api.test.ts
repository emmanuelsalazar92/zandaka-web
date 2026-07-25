import { afterEach, describe, expect, it, vi } from "vitest"

import { generateReportSnapshot } from "@/lib/reports-api"

describe("reports api", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("includes rate_mode when generating a report with automatic month-end rate", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: () => "application/json",
      },
      json: async () => ({
        data: {
          id: 1,
          user_id: 1,
          report_month: "2026-03",
          generated_at: "2026-04-15T00:00:00.000Z",
          base_currency: "CRC",
          total_crc: 100,
          total_usd: 1,
          exchange_rate_used: 500,
          exchange_rate_id: 9,
          consolidated_amount: 100,
          version: 1,
          is_latest: true,
          status: "FINALIZED",
          created_at: "2026-04-15T00:00:00.000Z",
          updated_at: "2026-04-15T00:00:00.000Z",
        },
      }),
    })

    vi.stubGlobal("fetch", fetchMock)

    await generateReportSnapshot({
      reportMonth: "2026-03",
      baseCurrency: "CRC",
      rateMode: "auto",
      notes: "month end",
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(options.method).toBe("POST")
    expect(options.body).toBe(
      JSON.stringify({
        user_id: 1,
        report_month: "2026-03",
        base_currency: "CRC",
        rate_mode: "auto",
        notes: "month end",
      }),
    )
  })

  it("includes exchange_rate_id when generating a report with a stored rate", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: () => "application/json",
      },
      json: async () => ({
        data: {
          id: 1,
          user_id: 1,
          report_month: "2026-03",
          generated_at: "2026-04-15T00:00:00.000Z",
          base_currency: "CRC",
          total_crc: 100,
          total_usd: 1,
          exchange_rate_used: 500,
          exchange_rate_id: 9,
          consolidated_amount: 100,
          version: 1,
          is_latest: true,
          status: "FINALIZED",
          created_at: "2026-04-15T00:00:00.000Z",
          updated_at: "2026-04-15T00:00:00.000Z",
        },
      }),
    })

    vi.stubGlobal("fetch", fetchMock)

    await generateReportSnapshot({
      reportMonth: "2026-03",
      baseCurrency: "CRC",
      rateMode: "stored",
      exchangeRateId: 9,
    })

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(options.body).toBe(
      JSON.stringify({
        user_id: 1,
        report_month: "2026-03",
        base_currency: "CRC",
        rate_mode: "stored",
        exchange_rate_id: 9,
      }),
    )
  })
})
