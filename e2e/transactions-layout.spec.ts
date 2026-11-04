import { expect, test } from "@playwright/test"

import type { Page } from "@playwright/test"

const transactions = Array.from({ length: 10 }, (_, index) => ({
  id: index + 1,
  date: "2026-11-02",
  type: "EXPENSE",
  description: `Movimiento sintético ${index + 1}`,
  lines: [
    {
      account_id: 1,
      envelope_id: 1,
      account_name: "Cuenta de prueba",
      category_name: "Personal",
      amount: -1000,
    },
  ],
}))

test.beforeEach(async ({ page }) => {
  await page.route("**/*", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin !== "http://127.0.0.1:3212") return route.abort("blockedbyclient")
    if (url.pathname.startsWith("/_vercel/")) return route.fulfill({ status: 204 })
    if (!url.pathname.startsWith("/api/")) return route.continue()
    // Every API request is intercepted; these tests cannot mutate an actual database.
    expect(request.method(), "The layout check must remain read-only").toBe("GET")
    if (url.pathname === "/api/accounts") {
      return route.fulfill({
        json: [{ id: 1, name: "Cuenta de prueba", currency: "CRC", is_active: 1 }],
      })
    }
    if (url.pathname === "/api/transactions") {
      return route.fulfill({
        json: {
          data: transactions,
          meta: {
            page: 1,
            pageSize: 10,
            totalItems: 25,
            totalPages: 3,
            hasNextPage: true,
            hasPrevPage: false,
          },
        },
      })
    }
    if (url.pathname === "/api/reports/envelope-balances") {
      return route.fulfill({
        json: [{ envelopeId: 1, categoryId: 1, categoryName: "Personal", balance: 10000 }],
      })
    }
    if (url.pathname === "/api/auto-assignment-rules") {
      return route.fulfill({ json: [] })
    }
    throw new Error(`Unexpected API request in isolated fixture: ${url.pathname}`)
  })
})

async function measureHeader(page: Page) {
  return page.getByTestId("transactions-header").evaluate((header) => {
    const viewportWidth = document.documentElement.clientWidth
    const headerRect = header.getBoundingClientRect()
    const controls = Array.from(header.querySelectorAll<HTMLElement>("h1, h2, p, button, a"))
    const failures: string[] = []
    if (headerRect.left < -1 || headerRect.right > viewportWidth + 1)
      failures.push("header exceeds viewport")
    for (const control of controls) {
      const rect = control.getBoundingClientRect()
      const label = control.textContent?.trim() ?? "unnamed control"
      if (
        rect.left < Math.max(0, headerRect.left) - 1 ||
        rect.right > Math.min(viewportWidth, headerRect.right) + 1
      )
        failures.push(`${label}: outside usable width`)
      if (
        control.scrollWidth > control.clientWidth + 1 ||
        (control.matches("button, a") && control.scrollHeight > control.clientHeight + 1)
      )
        failures.push(`${label}: clipped content`)
      for (let ancestor = control.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor)
        if (["hidden", "clip"].includes(style.overflowX)) {
          const bounds = ancestor.getBoundingClientRect()
          if (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)
            failures.push(`${label}: hidden by ancestor`)
        }
      }
    }
    return {
      viewportWidth,
      controls: controls.map((control) => ({
        label: control.textContent?.trim(),
        left: control.getBoundingClientRect().left,
        right: control.getBoundingClientRect().right,
      })),
      failures,
    }
  })
}

for (const width of [360, 390, 768, 1440]) {
  for (const textScale of [100, 200]) {
    for (const colorScheme of ["light", "dark"] as const) {
      test(`${width}px, text ${textScale}%, ${colorScheme}: actions fit and work`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 960 })
        await page.emulateMedia({ colorScheme })
        await page.goto("/transactions")
        await expect(page.getByText("Movimiento sintético 1", { exact: true })).toBeVisible()
        await page.addStyleTag({ content: `html { font-size: ${textScale}%; }` })
        await expect(page.locator("html")).toHaveCSS(
          "font-size",
          textScale === 200 ? "32px" : "16px",
        )
        const header = page.getByTestId("transactions-header")
        await expect.poll(async () => (await measureHeader(page)).failures).toEqual([])
        const layout = await measureHeader(page)
        await testInfo.attach("header-geometry", {
          body: JSON.stringify(layout, null, 2),
          contentType: "application/json",
        })
        const screenshotPath = testInfo.outputPath("header.png")
        await header.screenshot({ path: screenshotPath })
        await testInfo.attach("header", { path: screenshotPath, contentType: "image/png" })
        // The normal-size layout must also keep the populated timeline/pagination within the page.
        if (textScale === 100) {
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(layout.viewportWidth + 1)
        }
        await header.getByRole("button", { name: "Filtros", exact: true }).click()
        await expect(page.getByLabel("Desde", { exact: true })).toBeVisible()
        await header.getByRole("button", { name: "Filtros", exact: true }).click()
        await header.getByRole("button", { name: "Nuevo movimiento", exact: true }).click()
        await expect(page.getByRole("dialog")).toBeVisible()
        await page.keyboard.press("Escape")
        await expect(page.getByRole("dialog")).toBeHidden()
        await header.getByRole("link", { name: "Importar", exact: true }).click()
        await expect(page).toHaveURL(/\/transactions\/import$/)
      })
    }
  }
}

test("the geometry guard detects the original non-wrapping mobile regression", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 960 })
  await page.goto("/transactions")
  await expect(page.getByText("Movimiento sintético 1", { exact: true })).toBeVisible()
  await expect.poll(async () => (await measureHeader(page)).failures).toEqual([])
  // Negative control: reproduce the original one-row header. No product code is modified.
  await page.getByTestId("transactions-header").evaluate((header) => {
    header.style.flexDirection = "row"
    header.style.flexWrap = "nowrap"
    const title = header.firstElementChild as HTMLElement
    title.style.flex = "0 0 auto"
    title.style.width = "max-content"
    const actions = header.querySelector<HTMLElement>('[role="group"]')!
    actions.style.flexWrap = "nowrap"
    actions.style.flex = "0 0 auto"
    actions.style.maxWidth = "none"
    actions.style.width = "max-content"
    for (const child of actions.querySelectorAll<HTMLElement>("div, button, a")) {
      child.style.flexWrap = "nowrap"
      child.style.whiteSpace = "nowrap"
      child.style.maxWidth = "none"
    }
  })
  expect((await measureHeader(page)).failures).toContain("Nuevo movimiento: outside usable width")
})
