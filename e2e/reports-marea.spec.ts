import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { installSyntheticAPI } from "./fixtures"
const snapshot = {
  id: 1,
  user_id: 1,
  report_month: "2026-11",
  generated_at: "2026-11-01T18:00:00Z",
  base_currency: "CRC",
  ccss_rule_set_id: 5,
  income_tax_rule_set_id: 6,
  total_crc: 1000,
  total_usd: 2,
  consolidated_amount: 2000,
  exchange_rate_used: 500,
  version: 2,
  is_latest: 1,
  status: "FINALIZED",
  notes: "Versión histórica de prueba",
  created_at: "2026-11-01",
  updated_at: "2026-11-01",
}
async function fixture(page: Page, fail = false, metadataFail = false) {
  await installSyntheticAPI(page)
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname
    expect(request.method()).toBe("GET")
    if (path === "/api/reports")
      return route.fulfill({
        json: [
          snapshot,
          {
            ...snapshot,
            id: 2,
            version: 1,
            is_latest: 0,
            total_crc: 3000,
            consolidated_amount: 4000,
          },
        ],
      })
    if (metadataFail && path === "/api/exchange-rate")
      return route.fulfill({ status: 503, json: {} })
    if (/\/reports\/\d+\/html$/.test(path))
      return route.fulfill(
        fail
          ? { status: 503, json: {} }
          : {
              contentType: "text/html",
              body: '<!DOCTYPE html><html lang="es"><head><meta name="color-scheme" content="light"><style>body { color: #172b46; background: white; padding: 20px; }</style><title>Reporte sintético</title></head><body><main><h1>Detalle conservado</h1><p>₡1 000,00 · $2,00</p><script>parent.document.body.dataset.reportScript="executed"</script></main></body></html>',
            },
      )
    return route.fallback()
  })
}
test("version selection and comparison are read-only and preserve the stored values", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 1000 })
  await fixture(page)
  await page.goto("/reports")
  await expect(page.getByRole("region", { name: "Versión histórica seleccionada" })).toContainText(
    "Versión 2",
  )
  await page.getByLabel("Comparar con otra versión del mismo mes").selectOption("2")
  await expect(page.getByRole("region", { name: "Comparación de versiones" })).toContainText(
    "Versión 1",
  )
  await page.getByLabel("Versión a consultar", { exact: true }).selectOption("2")
  const panel = page.getByRole("region", { name: "Versión histórica seleccionada" })
  await expect(panel).toContainText("Versión anterior")
  await expect(panel).toContainText("CRC 4 000,00")
  await expect(panel.getByRole("link", { name: "Descargar PDF" })).toHaveAttribute(
    "href",
    "/api/reports/2/pdf?disposition=attachment",
  )
  await expect(
    page.frameLocator("iframe").getByRole("heading", { name: "Detalle conservado" }),
  ).toBeVisible()
  expect(await page.locator("body").getAttribute("data-report-script")).toBeNull()
  await panel.getByText("Trazabilidad y notas", { exact: true }).click()
  await expect(panel).toContainText("#5")
  await expect(panel).toContainText("#6")
})
test("failed document keeps essential information and download available", async ({ page }) => {
  await fixture(page, true)
  await page.goto("/reports")
  await expect(page.getByText("Vista del documento no disponible", { exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Descargar PDF" })).toBeVisible()
  await expect(page.getByText("Saldo original · CRC", { exact: true })).toBeVisible()
  await expect(page.locator("iframe")).toHaveCount(0)
})
test("generation metadata outage leaves the historical archive usable", async ({ page }) => {
  await fixture(page, false, true)
  await page.goto("/reports")
  await expect(page.getByRole("button", { name: "Generar reporte", exact: true })).toBeDisabled()
  await expect(page.getByRole("region", { name: "Versión histórica seleccionada" })).toBeVisible()
})
for (const width of [390, 1440])
  for (const colorScheme of ["light", "dark"] as const)
    for (const scale of [100, 200])
      test(`reports ${width} ${colorScheme} ${scale}%: responsive accessible archive`, async ({
        page,
      }, info) => {
        await page.setViewportSize({ width, height: 1000 })
        await page.emulateMedia({ colorScheme })
        await fixture(page)
        await page.goto("/reports")
        await expect(
          page.getByRole("region", { name: "Versión histórica seleccionada" }),
        ).toBeVisible()
        await expect(
          page.frameLocator("iframe").getByRole("heading", { name: "Detalle conservado" }),
        ).toBeVisible()
        await page.addStyleTag({ content: `html {font-size:${scale}% !important;}` })
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width + 1,
        )
        const axe = await new AxeBuilder({ page })
          .exclude("iframe")
          .setLegacyMode()
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
        expect(
          axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
        ).toEqual([])
        if (scale === 100)
          await page.screenshot({ path: info.outputPath("reports-marea.png"), fullPage: true })
      })
