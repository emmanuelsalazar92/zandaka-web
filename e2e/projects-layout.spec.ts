import { expect, test } from "@playwright/test"

import { installSyntheticAPI } from "./fixtures"

const now = "2026-11-26T18:00:00.000Z"
const project = {
  id: "00000000-0000-4000-8000-000000000140",
  title: "Construcción del lote",
  revision: 1,
  createdAt: now,
  updatedAt: now,
  archivedAt: null,
  finalizedAt: null,
}

for (const { width, expanded } of [
  { width: 390, expanded: false },
  { width: 1280, expanded: true },
  { width: 1280, expanded: false },
  { width: 1920, expanded: true },
  { width: 1920, expanded: false },
]) {
  for (const colorScheme of ["light", "dark"] as const) {
    const sidebar = expanded ? "expanded" : "collapsed"
    test(`Proyectos panel matches Conciliación at ${width}px ${sidebar} ${colorScheme}`, async ({
      context,
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ colorScheme })
      await context.addCookies([
        {
          name: "sidebar_state",
          value: String(expanded),
          domain: "127.0.0.1",
          path: "/",
        },
      ])
      await installSyntheticAPI(page)
      await page.route(/\/api\/projects(?:\/[^?]*)?(?:\?.*)?$/, async (route) => {
        expect(route.request().method()).toBe("GET")
        const { pathname } = new URL(route.request().url())
        if (pathname === "/api/projects")
          return route.fulfill({ json: { items: [project], total: 1, page: 1, pageSize: 20 } })
        if (pathname.endsWith("/movements"))
          return route.fulfill({ json: { project, items: [], total: 0, page: 1, pageSize: 20 } })
        if (pathname.endsWith("/analysis"))
          return route.fulfill({
            json: {
              project,
              calculatedAt: now,
              latestLedgerUpdateAt: null,
              excludedLineCount: 0,
              currencies: [],
            },
          })
        expect(pathname).toBe(`/api/projects/${project.id}`)
        return route.fulfill({ json: project })
      })

      const panel = page.getByRole("main").locator(".marea-surface").first()
      const measurePanel = async (capture: string) => {
        await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${colorScheme}\\b`))
        await expect(
          page.getByRole("button", { name: expanded ? "Cerrar navegación" : "Abrir navegación" }),
        ).toBeVisible()
        await expect(panel).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
        const edges = await panel.evaluate((element) => {
          const { left, right } = element.getBoundingClientRect()
          return { left, right }
        })
        if (width === 1920 && expanded) {
          const path = testInfo.outputPath(`${capture}.png`)
          await page.screenshot({ path, animations: "disabled" })
          await testInfo.attach(capture, { path, contentType: "image/png" })
        }
        return edges
      }

      await page.goto("/reconciliation")
      await expect(page.getByRole("heading", { name: "Conciliación", exact: true })).toBeVisible()
      const reference = await measurePanel("conciliacion")

      await page.goto("/projects")
      const row = page.getByRole("link", { name: /Construcción del lote/ })
      await expect(row).toBeVisible()
      const list = await measurePanel("proyectos-lista")

      await row.click()
      await expect(page.getByRole("heading", { name: project.title, exact: true })).toBeVisible()
      await expect(page.getByText("Sin movimientos que computen")).toBeVisible()
      const detail = await measurePanel("proyectos-ficha")

      expect.soft(list, "Project list outer edges").toEqual(reference)
      expect(detail, "Project detail outer edges").toEqual(reference)
    })
  }
}
