import { expect, test, type Page } from "@playwright/test"

import { exampleSavedPlan, planId, planOptions } from "../tests/fixtures/budget-plan"

import { installSyntheticAPI } from "./fixtures"

const projectId = "00000000-0000-4000-8000-000000000144"
const now = "2026-11-26T18:00:00.000Z"
const project = {
  id: projectId,
  title: "Construcción del lote",
  revision: 1,
  createdAt: now,
  updatedAt: now,
  archivedAt: null,
  finalizedAt: null,
}

async function installHeaderFixtures(page: Page) {
  await installSyntheticAPI(page)
  await page.route("**/api/transactions?**", (route) => {
    expect(route.request().method()).toBe("GET")
    const pageSize = Number(new URL(route.request().url()).searchParams.get("pageSize"))
    return route.fulfill({
      json: {
        data: Array.from({ length: pageSize }, (_, index) => ({
          id: index + 1,
          date: "2026-11-03",
          type: "EXPENSE",
          description: `Compra sintética ${index + 1}`,
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
        })),
        meta: {
          page: 1,
          pageSize,
          totalItems: pageSize,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      },
    })
  })
  await page.route(`**/api/projects/${projectId}**`, (route) => {
    expect(route.request().method()).toBe("GET")
    const { pathname } = new URL(route.request().url())
    if (pathname.endsWith("/analysis"))
      return route.fulfill({
        json: {
          project,
          calculatedAt: now,
          latestLedgerUpdateAt: null,
          excludedLineCount: 0,
          currencies: [
            {
              currency: "CRC",
              expenses: "150",
              refunds: "0",
              net: "150",
              series: [{ date: "2026-11-26", net: "150" }],
              categories: [
                {
                  categoryId: 1,
                  categoryName: "Materiales",
                  expenses: "150",
                  refunds: "0",
                  net: "150",
                },
              ],
            },
          ],
        },
      })
    if (pathname.endsWith("/movements"))
      return route.fulfill({ json: { project, items: [], total: 0, page: 1, pageSize: 20 } })
    expect(pathname).toBe(`/api/projects/${projectId}`)
    return route.fulfill({ json: project })
  })
  await page.route("**/api/budgets/7**", (route) => {
    expect(route.request().method()).toBe("GET")
    const { pathname } = new URL(route.request().url())
    const data = pathname.endsWith("/lines")
      ? {
          items: Array.from({ length: 20 }, (_, index) => ({
            id: index + 1,
            categoryId: index + 1,
            categoryName: `Categoría de prueba ${index + 1}`,
            amount: 100,
            percentage: 1,
          })),
        }
      : pathname.endsWith("/validation")
        ? {
            isValid: true,
            distributedAmount: 2000,
            distributedPercentage: 20,
            remainingAmount: 8000,
            remainingPercentage: 80,
            errors: [],
          }
        : {
            id: 7,
            userId: 1,
            month: "2026-11",
            currency: "CRC",
            totalIncome: 10000,
            status: "draft",
          }
    return route.fulfill({ json: { data } })
  })
  await page.route("**/api/budget-plans/**", (route) => {
    expect(route.request().method()).toBe("GET")
    const { pathname } = new URL(route.request().url())
    if (pathname.endsWith("/options")) return route.fulfill({ json: planOptions })
    expect(pathname).toBe(`/api/budget-plans/${planId}`)
    return route.fulfill({ json: exampleSavedPlan() })
  })
}

const appHeader = (page: Page) => page.getByRole("banner", { name: "Herramientas de Zandaka" })

async function scrollPage(page: Page, ratio: number) {
  const target = await page.evaluate((fraction) => {
    const range = document.documentElement.scrollHeight - innerHeight
    window.scrollTo(0, Math.trunc(range * fraction))
    return { range, target: Math.trunc(range * fraction) }
  }, ratio)
  expect(target.range, "the route must have actual scrolling content").toBeGreaterThan(150)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(target.target)
}

const scrollRoutes = [
  { path: "/transactions", ready: "Compra sintética 1" },
  { path: `/projects/${projectId}`, ready: "Costo neto · CRC", parent: "Proyectos" },
  { path: "/budgets/7", ready: "Categoría de prueba 20", parent: "Presupuestos" },
  { path: `/budgets/plans/${planId}`, ready: "Desde 01/11/2026", parent: "Presupuestos" },
]

for (const { width, theme, scale } of [
  { width: 360, theme: "light", scale: 100 },
  { width: 360, theme: "dark", scale: 200 },
  { width: 390, theme: "light", scale: 200 },
  { width: 390, theme: "dark", scale: 100 },
  { width: 1440, theme: "light", scale: 100 },
  { width: 1440, theme: "dark", scale: 200 },
] as const) {
  test(`app bar remains usable through scroll at ${width}px ${theme} text ${scale}%`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 720 })
    await page.emulateMedia({ colorScheme: theme })
    await installHeaderFixtures(page)
    const header = appHeader(page)

    for (const { path, ready, parent } of scrollRoutes) {
      await page.goto(path)
      await expect(page.getByText(ready, { exact: true }).filter({ visible: true })).toBeVisible()
      if (scale > 100)
        await page.evaluate(() => {
          document.documentElement.style.fontSize = "200%"
        })

      const trigger = header.getByRole("button", { name: /navegación/ })
      const appearance = header.getByRole("button", { name: "Cambiar apariencia" })
      const back = parent ? header.getByRole("link", { name: `Volver a ${parent}` }) : null
      const budgetPanel =
        path === "/budgets/7"
          ? page.getByRole("tabpanel", { name: "Planificación" }).locator(":scope > :first-child")
          : path.startsWith("/budgets/plans/")
            ? page.getByRole("complementary", { name: "Revisión del mes" })
            : null
      if (back && width < 768) {
        expect((await back.boundingBox())!.y).toBeGreaterThan((await trigger.boundingBox())!.y)
      }

      for (const ratio of [0, 0.5, 1]) {
        await scrollPage(page, ratio)
        await expect.poll(async () => (await header.boundingBox())?.y, { message: path }).toBe(0)
        for (const control of back ? [trigger, appearance, back] : [trigger, appearance]) {
          await expect(control).toBeInViewport({ ratio: 1 })
          await control.click({ trial: true })
        }
        if (
          ratio === 0.5 &&
          budgetPanel &&
          (await budgetPanel.evaluate((element) => getComputedStyle(element).position)) === "sticky"
        ) {
          expect((await budgetPanel.boundingBox())!.y).toBeGreaterThanOrEqual(
            (await header.boundingBox())!.height,
          )
        }
      }

      if (width === 1440) {
        await trigger.click()
        await expect(trigger).toHaveAttribute("aria-expanded", "false")
        await scrollPage(page, 0.5)
        await expect.poll(async () => (await header.boundingBox())?.y).toBe(0)
        await trigger.click()
        await expect(trigger).toHaveAttribute("aria-expanded", "true")
      }
    }
  })
}

test("skip link, focus, dialogs and mobile navigation work with the sticky app bar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 720 })
  await page.emulateMedia({ colorScheme: "light" })
  await installHeaderFixtures(page)
  await page.goto(`/projects/${projectId}`)
  await expect(page.getByText("Costo neto · CRC", { exact: true })).toBeVisible()
  const header = appHeader(page)
  const trigger = header.getByRole("button", { name: "Abrir navegación" })
  const main = page.getByRole("main")
  const more = main.getByRole("button", { name: "Más acciones" })
  const updateCost = main.getByRole("button", { name: "Actualizar costo" })

  await scrollPage(page, 0.5)
  await expect(page.locator("html")).toHaveClass(/\blight\b/)
  await header.getByRole("button", { name: "Cambiar apariencia" }).click()
  await expect(page.locator("html")).toHaveClass(/\bdark\b/)
  await trigger.click()
  await expect(page.getByRole("dialog", { name: "Navegación" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(trigger).toBeFocused()
  await expect(page.getByRole("dialog")).toHaveCount(0)

  await more.focus()
  const bar = (await header.boundingBox())!
  const next = (await updateCost.boundingBox())!
  await page.evaluate((offset) => window.scrollBy(0, offset), next.y - bar.height / 2)
  expect((await updateCost.boundingBox())!.y).toBeLessThan(bar.height)
  await page.keyboard.press("Tab")
  await expect(updateCost).toBeFocused()
  await expect
    .poll(async () => (await updateCost.boundingBox())!.y)
    .toBeGreaterThanOrEqual(bar.height)
  await more.focus()
  await page.keyboard.press("Enter")
  await page.getByRole("menuitem", { name: "Finalizar proyecto" }).click()
  await expect(page.getByRole("dialog", { name: "Finalizar proyecto" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(more).toBeFocused()

  const skip = page.getByRole("link", { name: "Saltar al contenido" })
  await skip.focus()
  await page.keyboard.press("Enter")
  await expect(main).toBeFocused()
  await expect.poll(async () => (await main.boundingBox())!.y).toBeGreaterThanOrEqual(bar.height)
})
