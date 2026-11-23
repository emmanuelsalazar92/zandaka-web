import { afterEach, describe, expect, it, vi } from "vitest"

import {
  fetchReportSnapshot,
  fetchReportSnapshots,
  generateReportSnapshot,
} from "@/lib/reports-api"

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
  it("does not present a failed catalog contract as an empty archive", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ items: [] })),
    )
    await expect(fetchReportSnapshots()).rejects.toThrow()
  })
  it("rejects a snapshot with missing totals rather than inventing zero balances", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json([
          { id: 1, user_id: 1, report_month: "2026-11", version: 1, base_currency: "CRC" },
        ]),
      ),
    )
    await expect(fetchReportSnapshots()).rejects.toThrow()
  })

  const legacy = {
    id: 13,
    user_id: 1,
    report_month: "2026-07",
    version: 1,
    base_currency: "CRC",
    total_crc: 1234.5600000001,
    total_usd: 12.340000000001,
    consolidated_amount: 7404.56012345,
    exchange_rate_used: 500.1234,
  }
  it("reads legacy totals and stored conversion precision unchanged in archive and detail", async () => {
    const before = structuredClone(legacy)
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => Response.json(url.includes("/reports/13") ? legacy : [legacy])),
    )
    const [archive] = await fetchReportSnapshots()
    const detail = await fetchReportSnapshot(13)
    for (const result of [archive, detail]) {
      expect(result.totalCrc).toBe(legacy.total_crc)
      expect(result.totalUsd).toBe(legacy.total_usd)
      expect(result.consolidatedAmount).toBe(legacy.consolidated_amount)
      expect(result.exchangeRateUsed).toBe(legacy.exchange_rate_used)
    }
    expect(legacy).toEqual(before)
  })
  it.each([NaN, Infinity, "invalid", null, undefined, Number.MAX_SAFE_INTEGER])(
    "rejects invalid or unsafe historical totals without exposing technical validation: %s",
    async (total) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json([{ ...legacy, total_crc: total }])),
      )
      await expect(fetchReportSnapshots()).rejects.toThrow(
        "No pudimos leer esta versión del reporte. Actualiza la consulta para verificar sus datos.",
      )
    },
  )
})
