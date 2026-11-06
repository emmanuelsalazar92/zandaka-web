import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { installSyntheticAPI } from "./fixtures"

async function fixture(page: Page, mode: "ready" | "partial" | "empty" = "ready") {
  await installSyntheticAPI(page)
  const reads: URL[] = []
  let expenseFailed = mode === "partial"
  const movement = (month: string) => ({
    id: 11,
    userId: 1,
    date: `${month}-03`,
    description: `Movimiento ${month} · referencia de prueba`,
    type: "TRANSFER",
    lines: [
      {
        id: 21,
        accountId: 1,
        envelopeId: 1,
        accountName: "Reserva familiar",
        categoryName: "Proyectos a largo plazo",
        accountCurrency: "USD",
        amount: -25.5,
        institutionName: "Banco sintético",
        envelopeActive: true,
      },
      {
        id: 22,
        accountId: 2,
        envelopeId: 2,
        accountName: "Tarjeta",
        categoryName: "Personal",
        accountCurrency: "USD",
        amount: 25.5,
        institutionName: "Banco sintético",
        envelopeActive: true,
      },
    ],
  })
  await page.route("**/api/transactions?**", (route) => {
    const url = new URL(route.request().url())
    reads.push(url)
    const month = url.searchParams.get("from")?.slice(0, 7) ?? "2026-11"
    const data = mode === "empty" ? [] : [movement(month)]
    return route.fulfill({
      json: {
        data,
        meta: {
          page: 1,
          pageSize: 10,
          totalItems: data.length,
          totalPages: data.length ? 1 : 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      },
    })
  })
  await page.route("**/api/transactions/11?**", (route) =>
    route.fulfill({
      json: {
        ...movement("2026-11"),
        createdAt: "2026-11-03 18:00:00",
        correction: { available: false, reason: "NO_AUDITED_CORRECTION_FLOW" },
      },
    }),
  )
  await page.route("**/api/reports/monthly-expenses?**", (route) => {
    const url = new URL(route.request().url())
    reads.push(url)
    if (expenseFailed) {
      expenseFailed = false
      return route.fulfill({ status: 503, json: {} })
    }
    return route.fulfill({
      json:
        mode === "empty"
          ? []
          : [
              {
                categoryId: 1,
                categoryName: `Casa ${url.searchParams.get("month")}`,
                currency: "CRC",
                total: -425000,
              },
              { categoryId: 2, categoryName: "Personal", currency: "CRC", total: -75000 },
              { categoryId: 3, categoryName: "Suscripciones", currency: "USD", total: -16.94 },
            ],
    })
  })
  await page.route("**/api/reports/active-inconsistencies", (route) =>
    route.fulfill({
      json: [
        {
          accountId: 2,
          accountName: "Cuenta para revisión",
          currency: "CRC",
          reconciliationDate: "2026-10-31",
          realBalance: 200,
          calculatedBalance: 300,
          difference: -100,
        },
      ],
    }),
  )
  return reads
}

for (const width of [390, 1440])
  for (const theme of ["light", "dark"] as const)
    for (const scale of [100, 200]) {
      for (const font of width === 390 && scale === 200
        ? ["system", "Arial", "Verdana"]
        : ["system"])
        test(`Marea summary ${width}px ${theme} ${scale}% ${font}: hierarchy, currency and accessibility`, async ({
          page,
        }, info) => {
          await page.setViewportSize({ width, height: 1000 })
          await page.emulateMedia({ colorScheme: theme })
          await fixture(page)
          await page.goto("/")
          await expect(page.getByText("Casa 2026-11", { exact: true })).toBeVisible()
          await page.addStyleTag({
            content: `html { font-size: ${scale}%; } ${font === "system" ? "" : `body { font-family: ${font}, sans-serif !important; }`}`,
          })
          const hero = page.getByRole("region", { name: "Saldo consolidado" })
          const activity = page.getByRole("region", { name: "Actividad del período" })
          const spending = page.getByRole("region", { name: "En qué gastaste" })
          const bounds = await page.evaluate(() => ({
            doc: document.documentElement.scrollWidth,
            viewport: document.documentElement.clientWidth,
            overflow: Array.from(document.querySelectorAll<HTMLElement>("main *"))
              .filter(
                (node) =>
                  node.getBoundingClientRect().right > document.documentElement.clientWidth + 1,
              )
              .map((node) => ({
                tag: node.tagName,
                text: node.textContent?.slice(0, 90),
                className: node.className,
                right: node.getBoundingClientRect().right,
              })),
          }))
          expect(bounds.doc, JSON.stringify(bounds.overflow)).toBeLessThanOrEqual(
            bounds.viewport + 1,
          )
          expect((await hero.boundingBox())!.y).toBeLessThan((await activity.boundingBox())!.y)
          if (width === 390)
            expect((await activity.boundingBox())!.y).toBeLessThan(
              (await spending.boundingBox())!.y,
            )
          await expect(hero.getByText(/No es el saldo bancario/)).toBeVisible()
          await expect(spending.getByText("Gastos en CRC", { exact: true })).toBeVisible()
          await expect(spending.getByText("Gastos en USD", { exact: true })).toBeVisible()
          await expect(activity.getByText("Salida", { exact: true })).toBeVisible()
          await expect(activity.getByText("Entrada", { exact: true })).toBeVisible()
          const axe = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
          expect(
            axe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
          ).toEqual([])
          await page.locator("#main-content").screenshot({ path: info.outputPath("summary.png") })
        })
    }

test("period changes update only its two reads, keep registered balance and open filtered history", async ({
  page,
}) => {
  const reads = await fixture(page)
  const summaryReads: string[] = []
  page.on("request", (request) => {
    if (/envelope-total|active-inconsistencies|negative-envelopes/.test(request.url()))
      summaryReads.push(request.url())
  })
  await page.goto("/")
  await expect(page.getByText("Casa 2026-11", { exact: true })).toBeVisible()
  const previous = summaryReads.length
  const hero = await page.getByRole("region", { name: "Saldo consolidado" }).innerText()
  await page.getByLabel("Período de gastos y actividad").fill("2026-10")
  await expect(page.getByText("Casa 2026-10", { exact: true })).toBeVisible()
  await expect(
    page.getByText("Movimiento 2026-10 · referencia de prueba", { exact: true }),
  ).toBeVisible()
  expect(summaryReads).toHaveLength(previous)
  expect(await page.getByRole("region", { name: "Saldo consolidado" }).innerText()).toBe(hero)
  await page.getByRole("link", { name: "Ver gastos del período", exact: true }).click()
  await expect
    .poll(() =>
      reads.some(
        (url) =>
          url.pathname === "/api/transactions" &&
          url.searchParams.get("from") === "2026-10-01" &&
          url.searchParams.get("to") === "2026-10-31" &&
          url.searchParams.get("type") === "EXPENSE",
      ),
    )
    .toBe(true)
})

test("stale month responses never replace the selected period", async ({ page }) => {
  const reads = await fixture(page)
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/api/reports/monthly-expenses?month=2026-10&**", async (route) => {
    reads.push(new URL(route.request().url()))
    await gate
    await route
      .fulfill({
        json: [{ categoryId: 1, categoryName: "Old result", currency: "CRC", total: -1 }],
      })
      .catch(() => {})
  })
  await page.goto("/")
  await expect(page.getByText("Casa 2026-11", { exact: true })).toBeVisible()
  await page.getByLabel("Período de gastos y actividad").fill("2026-10")
  await expect
    .poll(() => reads.some((url) => url.searchParams.get("month") === "2026-10"))
    .toBe(true)
  await expect(page.getByText("Casa 2026-11", { exact: true })).toHaveCount(0)
  await page.getByLabel("Período de gastos y actividad").fill("2026-09")
  await expect(page.getByText("Casa 2026-09", { exact: true })).toBeVisible()
  release()
  await expect(page.getByText("Old result", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Mes actual", exact: true }).click()
  await expect(page.getByText("Casa 2026-11", { exact: true })).toBeVisible()
})

test("partial data has a useful retry without hiding known activity", async ({ page }) => {
  await fixture(page, "partial")
  await page.goto("/")
  await expect(page.getByText("Gastos por confirmar", { exact: true })).toBeVisible()
  await expect(
    page.getByText("Movimiento 2026-11 · referencia de prueba", { exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Reintentar período", exact: true }).click()
  await expect(page.getByText("Casa 2026-11", { exact: true })).toBeVisible()
})

test("empty periods and unavailable quote do not become a fake consolidated zero", async ({
  page,
}) => {
  await fixture(page, "empty")
  await page.route("**/api/exchange-rate/**", (route) => route.fulfill({ status: 503, json: {} }))
  await page.goto("/")
  await expect(
    page
      .getByRole("region", { name: "Saldo consolidado" })
      .getByText("Por confirmar", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText("Este período aún no tiene movimientos.", { exact: true }),
  ).toBeVisible()
  await expect(page.getByText(/No hay gastos registrados en este mes/)).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Registrar un movimiento", exact: true }),
  ).toHaveAttribute("href", "/transactions?new=1")
})

test("activity opens the full detail and Escape restores keyboard focus", async ({ page }) => {
  await fixture(page)
  await page.goto("/")
  const trigger = page.getByRole("button", { name: "Ver detalle del movimiento 11", exact: true })
  await trigger.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.getByRole("dialog").getByText("Ficha por confirmar")).toHaveCount(0)
  await page.keyboard.press("Escape")
  await expect(trigger).toBeFocused()
})

test("negative envelopes navigate to their exact account/category over all history", async ({
  page,
}) => {
  const reads = await fixture(page)
  await page.goto("/")
  await page
    .locator("#dashboard-attention")
    .getByRole("link", { name: /Ver movimientos del sobre/ })
    .click()
  await expect
    .poll(() =>
      reads.some(
        (url) =>
          url.pathname === "/api/transactions" &&
          url.searchParams.get("accountId") === "1" &&
          url.searchParams.get("categoryId") === "2" &&
          !url.searchParams.has("from") &&
          !url.searchParams.has("to"),
      ),
    )
    .toBe(true)
})

test("new movement and import start directly from the summary", async ({ page }) => {
  await fixture(page)
  await page.goto("/")
  await page.getByRole("link", { name: "Nuevo movimiento", exact: true }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.keyboard.press("Escape")
  await page.goto("/")
  await page.getByRole("link", { name: "Importar", exact: true }).click()
  await expect(page).toHaveURL(/\/transactions\/import$/)
})

test("an open difference selects the matching account instead of the first account", async ({
  page,
}) => {
  await fixture(page)
  await page.route("**/api/accounts", (route) =>
    route.fulfill({
      json: [
        { id: 1, name: "Primera cuenta", currency: "CRC", is_active: 1 },
        { id: 2, name: "Cuenta para revisión", currency: "CRC", is_active: 1 },
      ],
    }),
  )
  const reads: URL[] = []
  await page.route("**/api/reconciliations?**", (route) => {
    reads.push(new URL(route.request().url()))
    return route.fulfill({ json: [] })
  })
  await page.goto("/")
  await page
    .locator("#dashboard-attention")
    .getByRole("link", { name: /Revisar conciliación/ })
    .click()
  await expect
    .poll(() => reads.some((url) => url.searchParams.get("account_id") === "2"))
    .toBe(true)
  await expect(page.getByRole("button", { name: "Cuenta a conciliar", exact: true })).toContainText(
    "Cuenta para revisión",
  )
})

test("a missing attention account does not silently display another account", async ({ page }) => {
  await fixture(page)
  await page.goto("/reconciliation?source=dashboard&accountId=999")
  await expect(
    page.getByText("La cuenta del enlace no está disponible", { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole("region", { name: "Resumen de conciliación" })).toHaveCount(0)
  await page.getByRole("button", { name: "Elegir otra cuenta", exact: true }).click()
  await expect(page.getByRole("region", { name: "Resumen de conciliación" })).toBeVisible()
})
