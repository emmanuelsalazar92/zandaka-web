import { writeFile } from "node:fs/promises"

import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { referenceContext } from "../lib/design-reference"

import { installSyntheticAPI } from "./fixtures"

function colorContrast(a: string, b: string) {
  const luminance = (value: string) =>
    value
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map(Number)
      .map((n) => n / 255)
      .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
      .reduce((total, n, i) => total + n * [0.2126, 0.7152, 0.0722][i], 0)
  return (
    (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05)
  )
}

async function openStudy(page: Page, variant: "marea" | "faro") {
  await installSyntheticAPI(page)
  const apiCalls: string[] = []
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) apiCalls.push(request.url())
  })
  await page.goto("/design-reference")
  await page.getByLabel("Composición", { exact: true }).selectOption(variant)
  await expect(page.getByRole("article")).toBeVisible()
  return apiCalls
}

for (const variant of ["marea", "faro"] as const)
  for (const width of [360, 390, 1440])
    for (const theme of ["light", "dark"] as const)
      for (const scale of [100, 200])
        for (const font of width === 360 && scale === 200
          ? ["system", "Arial", "Verdana"]
          : ["system"])
          test(`reference ${variant} ${width}px ${theme} ${scale}% ${font}`, async ({
            page,
          }, info) => {
            await page.setViewportSize({ width, height: 1000 })
            await page.emulateMedia({ colorScheme: theme })
            const calls = await openStudy(page, variant)
            await page.evaluate(
              ({ scale, font }) => {
                document.documentElement.style.fontSize = `${scale}%`
                if (font !== "system") document.body.style.fontFamily = `"${font}", sans-serif`
              },
              { scale, font },
            )
            const canvas = page.getByRole("article")
            await expect(
              canvas.getByRole("region", { name: "Saldo de la cuenta seleccionada" }),
            ).toContainText(/897\s*500,00/)
            await expect(canvas.locator("[data-envelope-id]")).toHaveCount(7)
            await expect(
              canvas.getByRole("complementary", { name: "Necesidades de atención" }),
            ).toContainText(/-\s*9\s*000,00/)
            const geometry = () =>
              page.locator("[data-study-root]").evaluate((root) => {
                const errors: string[] = []
                for (const el of [
                  root,
                  ...root.querySelectorAll<HTMLElement>(
                    "section,aside,li,p,h1,h2,h3,button,select,[data-reference-money]",
                  ),
                ]) {
                  const rect = el.getBoundingClientRect()
                  if (
                    rect.right > innerWidth + 1 ||
                    rect.left < -1 ||
                    (!(el instanceof HTMLSelectElement) && el.scrollWidth > el.clientWidth + 1)
                  )
                    errors.push(
                      `${el.tagName}: ${el.textContent?.slice(0, 60)} (${rect.left}/${rect.right}; ${el.scrollWidth}/${el.clientWidth})`,
                    )
                }
                return errors
              })
            await expect.poll(geometry).toEqual([])
            const axe = await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
            expect(
              axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
            ).toEqual([])
            await canvas.screenshot({
              path: info.outputPath(`reference-${variant}-${width}-${theme}-${scale}-${font}.png`),
            })
            await page.screenshot({ path: info.outputPath("viewport.png") })
            expect(calls).toEqual([])
          })

for (const variant of ["marea", "faro"] as const)
  for (const theme of ["light", "dark"] as const) {
    test(`reference ${variant} ${theme}: unknown, empty, loading, error and another currency stay explicit`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 1000 })
      await page.emulateMedia({ colorScheme: theme })
      const calls = await openStudy(page, variant)
      const canvas = page.getByRole("article"),
        scenario = page.getByLabel("Escenario", { exact: true })
      const colors = await canvas.evaluate((root) => {
        const bar = root.querySelector("i")!,
          select = root.querySelector("select")!
        return [
          [
            getComputedStyle(bar).backgroundColor,
            getComputedStyle(bar.parentElement!).backgroundColor,
          ],
          [getComputedStyle(select).borderTopColor, getComputedStyle(select).backgroundColor],
        ]
      })
      for (const [foreground, background] of colors)
        expect(colorContrast(foreground, background)).toBeGreaterThanOrEqual(3)
      await scenario.selectOption("pending")
      await expect(
        canvas.getByRole("region", { name: "Saldo de la cuenta seleccionada" }),
      ).toContainText("Por confirmar")
      await expect(
        canvas.getByRole("region", { name: "Distribución de saldos positivos" }),
      ).toContainText("cuando se confirmen todos")
      await expect(canvas.getByRole("complementary")).toContainText(/-\s*9\s*000,00/)
      await expect(canvas.getByRole("button", { name: "Mover dinero" })).toBeDisabled()
      await scenario.selectOption("empty")
      await expect(canvas.getByText("Un propósito empieza con un sobre.")).toBeVisible()
      await expect(canvas.getByRole("button", { name: "Vincular categoría" })).toBeEnabled()
      await scenario.selectOption("loading")
      await expect(canvas.getByRole("status")).toContainText("Cargando tus sobres")
      await expect(
        canvas.getByRole("region", { name: "Saldo de la cuenta seleccionada" }),
      ).toContainText("Por confirmar")
      await scenario.selectOption("error")
      await expect(canvas.getByRole("alert")).toContainText("No pudimos cargar")
      await canvas.getByRole("button", { name: "Volver a cargar el ejemplo" }).click()
      await expect(scenario).toHaveValue("complete")
      await page.getByLabel("Cuenta que estás organizando").selectOption("2")
      await expect(
        canvas.getByRole("region", { name: "Saldo de la cuenta seleccionada" }),
      ).toContainText(/5\s*151,00/)
      await expect(canvas.getByRole("region", { name: "Tus sobres" })).toContainText("USD")
      await expect(canvas.getByRole("region", { name: "Tus sobres" })).not.toContainText("CRC")
      expect(calls).toEqual([])
    })

    test(`reference ${variant} ${theme}: keyboard dialog focus and reduced motion`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" })
      const calls = await openStudy(page, variant)
      const action = page.getByRole("button", { name: "Mover dinero", exact: true })
      await action.focus()
      expect(await action.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid")
      await action.press("Enter")
      const dialog = page.getByRole("dialog", { name: "Mover dinero entre sobres" })
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole("button", { name: "Cerrar ejemplo" })).toBeFocused()
      await page.keyboard.press("Tab")
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
      await page.keyboard.press("Escape")
      await expect(action).toBeFocused()
      await page.getByRole("button", { name: "Ver sobre Suscripciones" }).click()
      await expect(page.getByRole("dialog", { name: "Suscripciones" })).toContainText(
        "Saldo negativo",
      )
      await page.keyboard.press("Escape")
      expect(
        await page
          .locator("[data-study-root] button")
          .first()
          .evaluate((el) => getComputedStyle(el).transitionDuration),
      ).toBe("0s")
      expect(calls).toEqual([])
    })
  }

// Actual pre-ZA-111 route, not a reconstruction. Transport uses the very same fixture
// as both proposals; this captures the before state without accessing the real API.
for (const width of [360, 390, 1440])
  for (const theme of ["light", "dark"] as const)
    test(`before reference ${width}px ${theme}: actual Sobres with identical data`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 1000 })
      await page.emulateMedia({ colorScheme: theme })
      await installSyntheticAPI(page)
      const context = referenceContext(1, "complete")
      await page.route("**/api/reports/account-balances?**", (route) =>
        route.fulfill({
          json: [
            {
              id: 1,
              name: context.account.name,
              institution: context.account.institution,
              currency: context.account.currency,
              type: "BANK",
              balance: context.balance,
              is_active: 1,
            },
          ],
        }),
      )
      await page.route("**/api/reports/envelope-balances?**", (route) =>
        route.fulfill({
          json: context.rows.map((row) => ({
            envelopeId: row.id,
            categoryId: row.id,
            categoryName: row.name,
            balance: row.balance,
            currency: context.account.currency,
          })),
        }),
      )
      await page.goto("/envelopes")
      await expect(page.getByText("Reserva de tranquilidad", { exact: true }).first()).toBeVisible()
      await expect(page.getByText("Un nuevo propósito", { exact: true })).toBeVisible()
      await page.screenshot({
        path: info.outputPath(`before-${width}-${theme}.png`),
        fullPage: true,
      })
      await info.attach("same-fictional-fixture", {
        body: JSON.stringify(context),
        contentType: "application/json",
      })
    })

for (const theme of ["light", "dark"] as const)
  test(`reference marea ${theme}: gradient copy and decorative strokes meet contrast`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ colorScheme: theme })
    await openStudy(page, "marea")
    const ratios = await page
      .getByRole("region", { name: "Saldo de la cuenta seleccionada" })
      .evaluate((panel) => {
        const parse = (value: string) => {
          const components = value.match(/[\d.]+/g)!.map(Number)
          return { rgb: components.slice(0, 3), alpha: components[3] ?? 1 }
        }
        const lum = (rgb: number[]) =>
          rgb
            .map((v) => v / 255)
            .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
            .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0)
        const contrast = (a: number[], b: number[]) =>
          (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
        const backgrounds = (getComputedStyle(panel).backgroundImage.match(/rgba?\([^)]+\)/g) ?? [])
          .map(parse)
          .filter((c) => c.alpha > 0)
        const wave = parse(getComputedStyle(panel.querySelector("[data-reference-tide]")!).color)
        const foregrounds = [panel, ...panel.querySelectorAll("p,a,h3,[data-reference-money]")].map(
          (el) => parse(getComputedStyle(el).color).rgb,
        )
        // All gradient colors are convex mixtures of these opaque stops. Bound the
        // brightest possible background, including the translucent white SVG stroke.
        return backgrounds.flatMap((bg) => {
          const withStroke = bg.rgb.map((v, i) => v * (1 - wave.alpha) + wave.rgb[i] * wave.alpha)
          return foregrounds.flatMap((fg) => [contrast(fg, bg.rgb), contrast(fg, withStroke)])
        })
      })
    expect(ratios.length).toBeGreaterThan(0)
    expect(Math.min(...ratios)).toBeGreaterThanOrEqual(4.5)
    await writeFile(
      info.outputPath(`gradient-contrast-${theme}.json`),
      JSON.stringify({ minimum: Math.min(...ratios), ratios }, null, 2),
    )
    await info.attach("gradient-contrast-bounds", {
      body: JSON.stringify({ minimum: Math.min(...ratios), ratios }),
      contentType: "application/json",
    })
  })
