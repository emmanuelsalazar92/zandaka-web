import { expect } from "@playwright/test"

import type { Page } from "@playwright/test"

export const syntheticAccounts = [
  {
    id: 1,
    name: "Cuenta de prueba",
    currency: "CRC",
    is_active: 1,
    institution_id: 1,
    institution_name: "Banco de prueba",
    balance: 10000,
  },
]

/** Local-only, read-only transport fixture. No API server, financial data or outbound analytics. */
export async function installSyntheticAPI(
  page: Page,
  rate: "current" | "previous" | "missing" = "current",
) {
  await page.clock.setFixedTime(new Date("2026-11-03T18:00:00-06:00"))
  await page.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url())
    if (url.origin !== "http://127.0.0.1:3212") return route.abort("blockedbyclient")
    if (url.pathname.startsWith("/_vercel/")) return route.fulfill({ status: 204 })
    if (!url.pathname.startsWith("/api/")) return route.continue()
    expect(request.method(), "Financial writes are forbidden in accessibility fixtures").toBe("GET")
    const path = url.pathname.slice(4)
    let json: unknown
    if (path === "/accounts") json = syntheticAccounts
    else if (path === "/users/1")
      json = {
        id: 1,
        name: "Perfil de prueba",
        base_currency: "CRC",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-11-03T18:00:00Z",
      }
    else if (path === "/institutions")
      json = [{ id: 1, name: "Banco de prueba", type: "BANK", is_active: 1, user_id: 1 }]
    else if (path === "/categories")
      json = [
        { id: 1, name: "Personal", parent_id: null, is_active: 1 },
        { id: 2, name: "Alimentación", parent_id: 1, is_active: 1 },
      ]
    else if (path === "/reports/account-balances")
      json = [
        {
          ...syntheticAccounts[0],
          user_id: 1,
          institution: "Banco de prueba",
          type: "BANK",
          allow_overdraft: 0,
          has_active_envelopes: true,
          active_envelopes_count: 3,
        },
      ]
    else if (path === "/reports/envelope-balances")
      json = [
        {
          envelopeId: 1,
          categoryId: 2,
          categoryName: "Alimentación",
          balance: 10000,
          currency: "CRC",
        },
        {
          envelopeId: 2,
          categoryId: 3,
          categoryName: "Pendiente de revisar",
          balance: -100,
          currency: "CRC",
        },
        {
          envelopeId: 3,
          categoryId: 4,
          categoryName: "Reserva sin saldo",
          balance: 0,
          currency: "CRC",
        },
      ]
    else if (path === "/reports/envelope-total")
      json = {
        total: url.searchParams.get("currency") === "CRC" ? 10000 : 2,
        currency: url.searchParams.get("currency"),
      }
    else if (path === "/reports/monthly-expenses")
      json = [{ categoryId: 2, categoryName: "Alimentación", total: 500, currency: "CRC" }]
    else if (path === "/reports/negative-envelopes")
      json = [
        {
          envelopeId: 1,
          accountId: 1,
          accountName: "Cuenta de prueba",
          categoryName: "Alimentación",
          balance: -100,
          currency: "CRC",
        },
      ]
    else if (path === "/reports/active-inconsistencies") json = []
    else if (path === "/transactions")
      json = {
        data: [
          {
            id: 1,
            date: "2026-11-03",
            type: "EXPENSE",
            description: "Compra de prueba",
            lines: [
              {
                account_id: 1,
                account_name: "Cuenta de prueba",
                account_currency: "CRC",
                envelope_id: 1,
                category_name: "Alimentación",
                amount: -500,
              },
            ],
          },
        ],
        meta: {
          page: 1,
          pageSize: 10,
          totalItems: 11,
          totalPages: 2,
          hasNextPage: true,
          hasPrevPage: false,
        },
      }
    else if (/^\/exchange-rate\/\d/.test(path)) {
      if (rate === "missing")
        return route.fulfill({
          status: 503,
          json: { error: { code: "INTERNAL_ERROR", message: "upstream exception" } },
        })
      json = { compra: 500, venta: 510, fecha: rate === "previous" ? "31/10/2026" : "03/11/2026" }
    } else if (
      path === "/exchange-rate" ||
      path === "/auto-assignment-rules" ||
      path === "/reports" ||
      path === "/budgets"
    )
      json = []
    else if (path === "/settings/cash-denominations" || path === "/payroll-rules/history")
      json = { items: [] }
    else if (path === "/payroll-rules/active") json = null
    else if (path === "/reconciliations")
      json = [
        {
          id: 1,
          account_id: 1,
          accountId: 1,
          date: "2026-11-03",
          reconciliation_date: "2026-11-03",
          status: "OPEN",
          count_method: "MANUAL_TOTAL",
          counted_total: 9900,
          expected_total: 10000,
          difference: -100,
          currency: "CRC",
        },
      ]
    else if (path.startsWith("/reconciliations/"))
      json = {
        expectedTotal: 10000,
        expected_total: 10000,
        currency: "CRC",
        count_method: "MANUAL_TOTAL",
        denominations: [],
      }
    else throw new Error(`Unmocked read in synthetic UI: ${path}`)
    return route.fulfill({ json })
  })
}
