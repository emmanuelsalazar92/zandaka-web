import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

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
  "/reports",
  "/settings",
]

for (const colorScheme of ["light", "dark"] as const) {
  for (const path of routes) {
    test(`${colorScheme} ${path}: names, landmarks and financial contrast`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width: 1440, height: 1000 })
      await page.emulateMedia({ colorScheme })
      await installSyntheticAPI(page)
      await page.goto(path)
      await expect(page.locator("main#main-content")).toBeVisible()
      // Wait for real API-driven controls, not an empty loading skeleton.
      await expect(page.getByText(/Cargando|Loading/)).toHaveCount(0)
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
      await info.attach("accessibility", {
        body: JSON.stringify(results.violations, null, 2),
        contentType: "application/json",
      })
      expect(
        results.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
      ).toEqual([])
    })
  }
}

test("mobile Escape restores trigger; navigation focuses content and preserves desktop preference", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await installSyntheticAPI(page)
  await page.goto("/transactions")
  const trigger = page.getByRole("button", { name: "Abrir navegación", exact: true })
  await trigger.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("dialog", { name: "Navegación" })).toBeVisible()
  await expect(
    page.locator('button[aria-label="Cerrar navegación"][aria-expanded]'),
  ).toHaveAttribute("aria-expanded", "true")
  await page.keyboard.press("Escape")
  await expect(trigger).toBeFocused()
  await expect(trigger).toHaveAttribute("aria-expanded", "false")
  for (const destination of [
    { name: "Cuentas", href: "/accounts" },
    { name: "Sobres", href: "/envelopes" },
    { name: "Ajustes", href: "/settings" },
  ]) {
    await trigger.click()
    await page
      .getByRole("dialog")
      .getByRole("link", { name: destination.name, exact: true })
      .click()
    await expect(page).toHaveURL(new RegExp(destination.href + "$"))
    await expect(page.getByRole("dialog", { name: "Navegación" })).toHaveCount(0)
    await expect(page.locator("#main-content")).toBeFocused()
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole("button", { name: "Cerrar navegación", exact: true }).click()
  await expect(page.getByRole("button", { name: "Abrir navegación", exact: true })).toHaveAttribute(
    "aria-expanded",
    "false",
  )
  await page.reload()
  await expect(page.getByRole("button", { name: "Abrir navegación", exact: true })).toHaveAttribute(
    "aria-expanded",
    "false",
  )
})

for (const rate of ["current", "previous", "missing"] as const) {
  test(`dashboard uses dated ${rate} exchange rate honestly`, async ({ page }, info) => {
    await installSyntheticAPI(page, rate)
    await page.goto("/")
    const hero = page.getByRole("region", { name: "Saldo consolidado" })
    if (rate === "missing") {
      await expect(hero.getByText("Por confirmar", { exact: true })).toBeVisible()
      await expect(hero.getByText("Cotización no disponible.")).toBeVisible()
      await expect(hero.getByText(/CRC/).first()).toBeVisible()
    } else {
      await expect(hero.getByText(/Fuente: tipodecambio.paginasweb.cr/)).toBeVisible()
      await expect(hero.getByText(/Conversión con tasa de compra/)).toBeVisible()
      await expect(
        hero.getByText(rate === "current" ? /Cotización del día/ : /Hace 3 días/),
      ).toBeVisible()
    }
    const screenshotPath = info.outputPath("quote.png")
    await hero.screenshot({ path: screenshotPath })
    await info.attach("dated-quote", { path: screenshotPath, contentType: "image/png" })
  })
}

for (const colorScheme of ["light", "dark"] as const) {
  for (const form of [
    { path: "/transactions", name: "Nuevo movimiento" },
    { path: "/accounts", name: "Añadir cuenta" },
    { path: "/institutions", name: "Añadir institución" },
    { path: "/categories", name: "Añadir categoría" },
    { path: "/reconciliation", name: "Nueva conciliación" },
    { path: "/reports", name: "Generar reporte" },
  ]) {
    test(`${colorScheme} ${form.path}: dialog labels and states`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 1100 })
      await page.emulateMedia({ colorScheme })
      await installSyntheticAPI(page)
      await page.goto(form.path)
      await page.getByRole("button", { name: form.name, exact: true }).click()
      await expect(page.getByRole("dialog")).toBeVisible()
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
      expect(
        results.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
      ).toEqual([])
      await page.keyboard.press("Escape")
      await expect(page.getByRole("dialog")).toHaveCount(0)
    })
  }
}

test("Spanish movement fields announce an invalid amount and recover through keyboard", async ({
  page,
}, info) => {
  await installSyntheticAPI(page)
  await page.goto("/transactions")
  await page.getByRole("button", { name: "Nuevo movimiento", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "Cuenta 1", exact: true }).click()
  await page.getByRole("option", { name: /Cuenta de prueba/ }).click()
  const amount = dialog.getByLabel(/^Importe/)
  await amount.fill("1e-2")
  await amount.press("Tab")
  await expect(amount).toHaveAttribute("aria-invalid", "true")
  await expect(amount).toHaveAttribute("aria-describedby", /.+/)
  await expect(dialog.getByRole("alert").last()).toBeVisible()
  await info.attach("accessible-form", {
    body: await dialog.ariaSnapshot(),
    contentType: "text/plain",
  })
  await amount.fill("0.02")
  await amount.press("Tab")
  await expect(amount).not.toHaveAttribute("aria-invalid", "true")
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()
  expect(results.violations).toEqual([])
})

for (const section of [
  { tab: "Efectivo", action: "Nueva" },
  { tab: "Reglas automáticas", action: "Nueva regla" },
]) {
  test(`settings ${section.tab}: inline editor labels and states`, async ({ page }) => {
    await installSyntheticAPI(page)
    await page.goto("/settings")
    await page.getByRole("tab", { name: section.tab, exact: true }).click()
    await page.getByRole("button", { name: section.action, exact: true }).click()
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze()
    expect(
      results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([])
  })
}
