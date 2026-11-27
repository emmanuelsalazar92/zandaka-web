import { expect, test } from "@playwright/test"

import { installSyntheticAPI } from "./fixtures"

test("project cost has exact tables, keyboard drill-down, and updates after closing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" })
  await page.addInitScript(() => localStorage.setItem("theme", "system"))
  await installSyntheticAPI(page)
  const id = "00000000-0000-4000-8000-000000000117"
  const now = "2026-11-26T18:00:00.000Z"
  const project = {
    id,
    title: "Construcción del lote",
    revision: 4,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    finalizedAt: now,
  }
  const crc = {
    currency: "CRC",
    expenses: "150",
    refunds: "20",
    net: "130",
    series: [
      { date: "2026-11-12", net: "150" },
      { date: "2026-11-14", net: "130" },
    ],
    categories: [
      { categoryId: 1, categoryName: "Materiales", expenses: "100", refunds: "20", net: "80" },
      { categoryId: 2, categoryName: "Permisos", expenses: "50", refunds: "0", net: "50" },
    ],
  }
  const usd = {
    currency: "USD",
    expenses: "10",
    refunds: "0",
    net: "10",
    series: [{ date: "2026-11-13", net: "10" }],
    categories: [
      { categoryId: 2, categoryName: "Permisos", expenses: "10", refunds: "0", net: "10" },
    ],
  }
  const first = {
    lineId: 1,
    transactionId: 100,
    date: "2026-11-12",
    description: "Compra de materiales",
    accountId: 1,
    accountName: "Lote CRC",
    categoryId: 1,
    categoryName: "Materiales",
    currency: "CRC",
    amount: "-100",
    kind: "expense",
    eligible: true,
  }
  const lines = [
    first,
    { ...first, lineId: 2, categoryId: 2, categoryName: "Permisos", amount: "-50" },
    {
      ...first,
      lineId: 3,
      transactionId: 101,
      accountId: 2,
      currency: "USD",
      amount: "-10",
      categoryId: 2,
    },
    {
      ...first,
      lineId: 4,
      transactionId: 102,
      description: "Devolución",
      amount: "20",
      kind: "refund",
    },
  ]
  let response: "error" | "regular" | "corrected" | "empty" = "error"
  await page.route(new RegExp(`/api/projects/${id}(?:/[^?]*)?(?:\\?.*)?$`), async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith("/analysis")) {
      if (response === "error") {
        response = "regular"
        return route.fulfill({ status: 500, json: {} })
      }
      const corrected = response === "corrected"
      return route.fulfill({
        json: {
          project,
          calculatedAt: corrected ? "2026-11-26T19:00:00.000Z" : now,
          latestLedgerUpdateAt: corrected ? "2026-11-26T18:30:00.000Z" : null,
          excludedLineCount: 0,
          currencies:
            response === "empty"
              ? []
              : [
                  corrected
                    ? {
                        ...crc,
                        refunds: "180",
                        net: "-30",
                        series: [{ ...crc.series[0] }, { ...crc.series[1], net: "-30" }],
                        categories: [
                          { ...crc.categories[0], refunds: "180", net: "-80" },
                          crc.categories[1],
                        ],
                      }
                    : crc,
                  usd,
                ],
        },
      })
    }
    if (url.pathname.endsWith("/movements/100")) {
      expect(url.searchParams.has("userId")).toBe(false)
      return route.fulfill({
        json: {
          id: 100,
          userId: 1,
          date: first.date,
          type: "EXPENSE",
          createdAt: now,
          description: first.description,
          correction: { available: false, reason: "NO_AUDITED_CORRECTION_FLOW" },
          lines: lines.slice(0, 2).map((line) => ({
            id: line.lineId,
            accountId: 1,
            accountName: line.accountName,
            accountCurrency: "CRC",
            institutionName: "Banco sintético",
            envelopeId: line.lineId,
            categoryName: line.categoryName,
            envelopeActive: true,
            amount: Number(line.amount),
          })),
        },
      })
    }
    if (url.pathname.endsWith("/movements")) {
      const categoryId = url.searchParams.get("categoryId")
      const items = categoryId
        ? lines.filter(
            (line) =>
              String(line.categoryId) === categoryId &&
              line.currency === url.searchParams.get("currency"),
          )
        : lines
      return route.fulfill({ json: { project, items, total: items.length, page: 1, pageSize: 20 } })
    }
    return route.fulfill({ json: project })
  })

  await page.goto(`/projects/${id}`)
  await expect(page.locator("html")).toHaveClass(/light/)
  await expect(page.getByText("No pudimos calcular el costo")).toBeVisible()
  await page.getByRole("button", { name: "Reintentar cálculo" }).click()
  const chart = page.getByRole("application", { name: "Costo acumulado en CRC" })
  await expect(chart).toBeVisible()
  await chart.focus()
  await page.keyboard.press("ArrowRight")
  await expect(page.locator(".recharts-tooltip-wrapper")).toContainText(/CRC\s+(150|130),00/)
  await expect(
    page.getByRole("table", { name: "Costo por moneda" }).getByRole("row", { name: /CRC.*130,00/ }),
  ).toBeVisible()
  await page.getByText("Ver tabla de evolución").focus()
  await page.keyboard.press("Enter")
  await expect(
    page
      .getByRole("table", { name: "Costo acumulado por día en CRC" })
      .getByRole("row", { name: /14\/11\/2026.*130,00/ }),
  ).toBeVisible()

  const category = page.getByRole("button", { name: "Materiales", exact: true })
  await category.focus()
  await page.keyboard.press("Enter")
  const links = page.getByRole("region", { name: "Movimientos vinculados" })
  await expect(links.getByRole("heading")).toBeFocused()
  await expect(links.getByText("Desglose · Materiales · CRC")).toBeVisible()
  await expect(links.getByText("2 líneas vinculadas")).toBeVisible()
  await expect(links.getByRole("button", { name: "Ver movimiento #100, línea #2" })).toHaveCount(0)
  const detailTrigger = links.getByRole("button", { name: "Ver movimiento #100, línea #1" })
  await detailTrigger.click()
  await expect(
    page.getByRole("dialog").getByText("Compra de materiales", { exact: true }),
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(detailTrigger).toBeFocused()

  await page.getByRole("button", { name: "USD", exact: true }).click()
  await expect(page.getByRole("application", { name: "Costo acumulado en USD" })).toBeVisible()
  await expect(links.getByText("4 líneas vinculadas")).toBeVisible()
  await page.emulateMedia({ colorScheme: "dark" })
  await expect(page.locator("html")).toHaveClass(/dark/)
  await expect(page.getByRole("application", { name: "Costo acumulado en USD" })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)

  response = "corrected"
  await page.getByRole("button", { name: "Actualizar costo" }).click()
  await expect(page.getByText("Las cifras cambiaron desde la consulta anterior")).toBeVisible()
  await expect(page.getByText("Hay movimientos actualizados después del cierre")).toBeVisible()
  await expect(
    page
      .getByRole("table", { name: "Costo por moneda" })
      .getByRole("cell", { name: /^[-−]CRC\s+30,00$/ }),
  ).toBeVisible()
  response = "empty"
  await page.getByRole("button", { name: "Actualizar costo" }).click()
  await expect(page.getByRole("table", { name: "Costo por moneda" })).toContainText(
    "Sin movimientos que computen",
  )
  await expect(page.getByRole("application", { name: /Costo acumulado/ })).toHaveCount(0)
})
