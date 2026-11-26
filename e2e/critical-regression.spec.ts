import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

import { installSyntheticAPI } from "./fixtures"

// Cross-module coverage complements the populated, flow-specific fixtures in the other suites.
// Requests stay intercepted; this matrix never needs a backend or an existing database.
const routes = [
  "/",
  "/transactions",
  "/transactions/import",
  "/accounts",
  "/envelopes",
  "/reconciliation",
  "/budgets",
  "/reports",
  "/settings",
  "/institutions",
  "/categories",
]

for (const width of [360, 390, 768, 1440]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`critical matrix ${width}px ${colorScheme}: reflow, primary actions and semantics`, async ({
      page,
    }, info) => {
      test.setTimeout(120_000)
      await page.setViewportSize({ width, height: 1000 })
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" })
      await installSyntheticAPI(page)
      const runtimeErrors: string[] = []
      page.on("pageerror", (error) => runtimeErrors.push(error.message))
      page.on("console", (message) => {
        if (
          /^(error|warning)$/.test(message.type()) &&
          /hydrat|react error #(?:418|423|425)/i.test(message.text())
        )
          runtimeErrors.push(message.text())
      })
      const evidence: unknown[] = []
      for (const route of routes) {
        await page.goto(route)
        await expect(page.locator("main h1")).toHaveCount(1)
        await expect(page.getByText(/Cargando|Loading/)).toHaveCount(0)
        for (const textScale of [100, 200]) {
          // Text enlargement tests reflow; it is deliberately not described as native browser zoom.
          await page.evaluate((scale) => {
            document.documentElement.style.fontSize = `${scale}%`
          }, textScale)
          const geometry = await page.locator("main").evaluate((main) => {
            const viewport = document.documentElement.clientWidth
            const failures: { text: string; reason: string }[] = []
            for (const node of main.querySelectorAll<HTMLElement>(
              'button,a,input,select,textarea,[role="combobox"]',
            )) {
              const rect = node.getBoundingClientRect()
              if (!rect.width || !rect.height || getComputedStyle(node).visibility === "hidden")
                continue
              // Detailed tables may scroll in their own region; page-level task controls may not.
              let inScrollRegion = false
              for (
                let parent = node.parentElement;
                parent && parent !== main;
                parent = parent.parentElement
              ) {
                if (
                  ["auto", "scroll"].includes(getComputedStyle(parent).overflowX) &&
                  parent.scrollWidth > parent.clientWidth + 1
                )
                  inScrollRegion = true
              }
              const text = (node.getAttribute("aria-label") || node.textContent || node.tagName)
                .trim()
                .slice(0, 100)
              if (!inScrollRegion && (rect.left < -1 || rect.right > viewport + 1))
                failures.push({ text, reason: "task control outside viewport" })
              if (
                node.matches("button") &&
                !inScrollRegion &&
                node.scrollWidth > node.clientWidth + 1
              )
                failures.push({ text, reason: "button label clipped horizontally" })
            }
            return { viewport, documentWidth: document.documentElement.scrollWidth, failures }
          })
          evidence.push({ route, textScale, geometry })
          expect
            .soft(geometry.documentWidth, `${route} ${textScale}%: document overflow`)
            .toBeLessThanOrEqual(width + 1)
          expect.soft(geometry.failures, `${route} ${textScale}%: task controls`).toEqual([])
          if (width === 768 && textScale === 200) {
            const audit = await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
            evidence.push({ route, textScale, violations: audit.violations })
            expect
              .soft(
                audit.violations.map(({ id, nodes }) => ({
                  id,
                  targets: nodes.map((n) => n.target),
                })),
                route,
              )
              .toEqual([])
          }
          if (
            textScale === 200 &&
            ((width === 360 && route === "/transactions/import") ||
              (width === 768 && ["/", "/accounts", "/categories"].includes(route)) ||
              (width === 1440 && route === "/categories"))
          )
            await page.screenshot({
              path: info.outputPath(`reflow-${route.replaceAll("/", "_") || "summary"}.png`),
              fullPage: true,
            })
        }
        // Keyboard reaches the skip link and then the main landmark, including legacy catalog routes.
        await page.evaluate(() => {
          document.documentElement.style.fontSize = "100%"
        })
        await page.keyboard.press("Control+Home")
        await page.locator('a[href="#main-content"]').focus()
        await page.keyboard.press("Enter")
        await expect(page.locator("#main-content"), route).toBeFocused()
        if (width === 768 && route === "/accounts")
          await page.screenshot({
            path: info.outputPath(`tablet-${colorScheme}.png`),
            fullPage: true,
          })
      }
      expect(runtimeErrors, "client runtime and hydration").toEqual([])
      await info.attach("cross-module-reflow", {
        body: JSON.stringify(evidence, null, 2),
        contentType: "application/json",
      })
    })
  }
}
