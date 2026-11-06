import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { installSyntheticAPI } from "./fixtures"

const routes = [
  "/",
  "/transactions",
  "/transactions/import",
  "/accounts",
  "/institutions",
  "/categories",
  "/envelopes",
  "/reconciliation",
  "/budgets",
  "/budgets/7",
  "/reports",
  "/settings",
]

async function installNavigationFixtures(page: Page) {
  await installSyntheticAPI(page)
  await page.route("**/api/budgets/7**", async (route) => {
    expect(route.request().method()).toBe("GET")
    const path = new URL(route.request().url()).pathname
    const data = path.endsWith("/lines")
      ? { items: [] }
      : path.endsWith("/validation")
        ? {
            isValid: true,
            distributedAmount: 0,
            distributedPercentage: 0,
            remainingAmount: 10000,
            remainingPercentage: 100,
            errors: [],
          }
        : {
            id: 7,
            userId: 1,
            month: "2026-11",
            currency: "CRC",
            totalIncome: 10000,
            status: "draft",
            linesCount: 0,
            distributedAmount: 0,
            distributedPercentage: 0,
            remainingAmount: 10000,
            remainingPercentage: 100,
          }
    await route.fulfill({ json: { data } })
  })
}

async function headerGeometry(page: Page) {
  return page.evaluate(() => {
    const failures: string[] = [],
      viewport = document.documentElement.clientWidth
    for (const header of document.querySelectorAll<HTMLElement>(
      '[data-slot="page-header"], header[aria-label="Herramientas de Zandaka"]',
    )) {
      const bounds = header.getBoundingClientRect()
      for (const element of [
        header,
        ...header.querySelectorAll<HTMLElement>("h1, p, button, a, [data-slot=select-trigger]"),
      ]) {
        const rect = element.getBoundingClientRect()
        if (
          rect.left < Math.max(0, bounds.left) - 1 ||
          rect.right > Math.min(viewport, bounds.right) + 1 ||
          element.scrollWidth > element.clientWidth + 1
        )
          failures.push(`${element.tagName}: ${element.textContent?.trim().slice(0, 70)}`)
      }
    }
    return failures
  })
}

for (const width of [360, 390, 1440]) {
  for (const colorScheme of ["light", "dark"] as const) {
    for (const scale of [100, 200]) {
      for (const font of width === 360 && scale === 200
        ? ["system", "Arial", "Verdana"]
        : ["system"]) {
        test(`task headers ${width}px ${colorScheme} text ${scale}% ${font}`, async ({
          page,
        }, info) => {
          await page.setViewportSize({ width, height: 1000 })
          await page.emulateMedia({ colorScheme })
          await installNavigationFixtures(page)
          for (const route of routes) {
            await page.goto(route)
            await expect(page.getByText(/Cargando/)).toHaveCount(0)
            await expect(page.locator("main h1")).toHaveCount(1)
            await expect(page.locator("h1")).toHaveCount(1)
            // These routes keep their title during loading. Wait for their real action area,
            // so geometry and screenshots cannot accidentally audit the loading-only header.
            if (route === "/envelopes")
              await expect(
                page.getByRole("button", { name: "Cuenta de los sobres", exact: true }),
              ).toBeVisible()
            if (route === "/reconciliation")
              await expect(
                page.getByRole("button", { name: "Nueva conciliación", exact: true }),
              ).toBeVisible()
            if (route === "/budgets/7")
              await expect(
                page.getByRole("button", { name: "Finalizar", exact: true }),
              ).toBeVisible()
            if (route === "/settings")
              await expect(
                page
                  .getByRole("navigation", { name: "Secciones de ajustes" })
                  .getByRole("link", { name: "Perfil y preferencias", exact: true }),
              ).toBeVisible()
            await page.evaluate((size) => {
              document.documentElement.style.fontSize = `${size}%`
            }, scale)
            if (font !== "system")
              await page.evaluate((family) => {
                document.body.style.fontFamily = `"${family}", sans-serif`
              }, font)
            await expect.poll(() => headerGeometry(page), { message: route }).toEqual([])
            if (["/envelopes", "/budgets", "/institutions"].includes(route)) {
              await page.screenshot({ path: info.outputPath(`${route.slice(1)}-overview.png`) })
              await page
                .locator('[data-slot="page-header"]')
                .screenshot({ path: info.outputPath(`${route.slice(1)}-header.png`) })
            }
          }
        })
      }
    }
  }
}

for (const width of [360, 390, 1440]) {
  test(`contextual catalogs, active destination and keyboard navigation ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await installNavigationFixtures(page)
    for (const [origin, link, target] of [
      ["/accounts", "Gestionar instituciones", "/institutions"],
      ["/envelopes", "Gestionar categorías", "/categories"],
      ["/budgets", "Gestionar categorías", "/categories"],
    ]) {
      await page.goto(origin)
      const related = page.getByRole("link", { name: link, exact: true })
      await related.focus()
      await expect(related).toBeFocused()
      await related.press("Enter")
      await expect(page).toHaveURL(
        (url) => url.pathname === target && url.searchParams.get("returnTo") === origin,
      )
      await expect(page.locator("#main-content")).toBeFocused()
      const returnLabel =
        origin === "/accounts"
          ? "Volver a Cuentas"
          : origin === "/envelopes"
            ? "Volver a Sobres"
            : "Volver a Presupuestos"
      await page.getByRole("link", { name: returnLabel, exact: true }).click()
      await expect(page).toHaveURL((url) => url.pathname === origin && !url.search)
    }
    await page.goto("/settings")
    if (width < 768)
      await page.getByRole("button", { name: "Abrir navegación", exact: true }).click()
    const sidebar = page.locator('[data-sidebar="sidebar"]').filter({ visible: true })
    await expect(sidebar.getByRole("link")).toHaveCount(8)
    await expect(sidebar.getByRole("link", { name: "Instituciones", exact: true })).toHaveCount(0)
    await expect(sidebar.getByRole("link", { name: "Categorías", exact: true })).toHaveCount(0)
    await expect(sidebar.getByRole("link", { name: "Ajustes", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    )
    if (width < 768) {
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%"
      })
      for (const link of await sidebar.getByRole("link").all()) {
        await link.scrollIntoViewIfNeeded()
        const rect = await link.boundingBox()
        expect(rect!.x).toBeGreaterThanOrEqual(0)
        expect(rect!.x + rect!.width).toBeLessThanOrEqual(width)
        expect(await link.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
      }
      await page.keyboard.press("Escape")
      await expect(
        page.getByRole("button", { name: "Abrir navegación", exact: true }),
      ).toBeFocused()
    }
    await page.goto("/categories")
    if (width < 768)
      await page.getByRole("button", { name: "Abrir navegación", exact: true }).click()
    await expect(
      page
        .locator('[data-sidebar="sidebar"]')
        .filter({ visible: true })
        .getByRole("link", { name: "Ajustes", exact: true }),
    ).toHaveAttribute("aria-current", "location")
  })
}

for (const state of ["empty", "error", "loading"] as const) {
  test(`secondary catalog access survives ${state} data`, async ({ page }) => {
    await installNavigationFixtures(page)
    await page.route("**/api/reports/account-balances**", async (route) => {
      if (state === "loading") return // Deliberately pending, isolated transport; no real API.
      await route.fulfill(
        state === "empty"
          ? { json: [] }
          : { status: 503, json: { error: { code: "UNAVAILABLE" } } },
      )
    })
    await page.goto("/envelopes")
    await expect(
      page.getByText(
        state === "empty"
          ? "Primero, una cuenta"
          : state === "error"
            ? "Cuentas por confirmar"
            : "Cargando cuentas…",
        { exact: true },
      ),
    ).toBeVisible()
    await expect(page.getByRole("heading", { level: 1, name: "Sobres" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Gestionar categorías" })).toBeVisible()
    await page.getByRole("link", { name: "Gestionar categorías" }).click()
    await expect(page).toHaveURL(
      (url) => url.pathname === "/categories" && url.searchParams.get("returnTo") === "/envelopes",
    )
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
    expect(axe.violations.map((v) => v.id)).toEqual([])
  })
}
