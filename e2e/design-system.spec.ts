import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

import { installSyntheticAPI } from "./fixtures"

for (const width of [360, 1440]) {
  for (const colorScheme of ["light", "dark"] as const) {
    for (const textScale of [100, 200]) {
      for (const font of width === 360 && textScale === 200 ? ["system", "Arial"] : ["system"]) {
        test(`gallery ${width}px ${colorScheme} ${textScale}% ${font}: readable states and contained layout`, async ({
          page,
        }, info) => {
          await page.setViewportSize({ width, height: 1000 })
          await page.emulateMedia({ colorScheme })
          await installSyntheticAPI(page)
          await page.goto("/design-system")
          await expect(page.getByRole("heading", { level: 1 })).toContainText("Atlántico")
          await page.evaluate((scale) => {
            document.documentElement.style.fontSize = `${scale}%`
          }, textScale)
          if (font === "Arial")
            await page.evaluate(() => {
              document.body.style.fontFamily = "Arial, sans-serif"
            })
          const overflow = await page.evaluate(() => ({
            width: document.documentElement.scrollWidth,
            viewport: window.innerWidth,
            elements: [...document.querySelectorAll("body *")]
              .filter((el) => {
                const b = el.getBoundingClientRect()
                return (
                  b.right > window.innerWidth + 1 && !el.closest('[data-slot="table-container"]')
                )
              })
              .map((el) => ({
                tag: el.tagName,
                slot: el.getAttribute("data-slot"),
                text: el.textContent?.slice(0, 60),
                right: el.getBoundingClientRect().right,
              }))
              .slice(-20),
          }))
          expect(overflow.width, JSON.stringify(overflow)).toBeLessThanOrEqual(width + 1)
          // A wide data table scrolls within its keyboard-focusable region, never the document.
          for (const control of await page
            .locator(
              "main button:visible, main input:visible:not([aria-hidden=true]), main textarea:visible",
            )
            .all()) {
            const box = await control.boundingBox()
            expect(box).not.toBeNull()
            expect(box!.x, await control.evaluate((el) => el.outerHTML)).toBeGreaterThanOrEqual(0)
            expect(
              box!.x + box!.width,
              await control.evaluate((el) => el.outerHTML),
            ).toBeLessThanOrEqual(width + 1)
          }
          const axe = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
          await info.attach("accessibility", {
            body: JSON.stringify(axe.violations, null, 2),
            contentType: "application/json",
          })
          expect(
            axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
          ).toEqual([])
          await page.screenshot({
            path: info.outputPath(`overview-${width}-${colorScheme}-${textScale}.png`),
          })
          await page.screenshot({
            path: info.outputPath(`gallery-${width}-${colorScheme}-${textScale}.png`),
            fullPage: true,
          })
        })
      }
    }
  }
}

for (const width of [360, 1440]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`gallery ${width}px ${colorScheme}: search, validation, notifications and overlay focus by keyboard`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 })
      await page.emulateMedia({ colorScheme })
      await installSyntheticAPI(page)
      await page.goto("/design-system")
      const primary = page.getByRole("button", { name: "Crear ejemplo", exact: true })
      const normal = await primary.evaluate((element) => getComputedStyle(element).backgroundColor)
      await primary.hover()
      await expect
        .poll(() => primary.evaluate((element) => getComputedStyle(element).backgroundColor))
        .not.toBe(normal)
      await primary.focus()
      expect(await primary.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe(
        "none",
      )
      await expect(
        page.getByRole("button", { name: "Guardando ejemplo", exact: true }),
      ).toBeDisabled()
      await expect(page.getByRole("button", { name: "No disponible", exact: true })).toBeDisabled()
      const account = page.getByRole("button", { name: "Cuenta de ejemplo", exact: true })
      await account.focus()
      await page.keyboard.press("ArrowDown")
      const search = page.getByRole("combobox", { name: "Buscar cuenta de ejemplo" })
      await expect(search).toBeFocused()
      await search.fill("no-existe")
      await expect(page.getByText("No encontramos coincidencias.")).toBeVisible()
      await search.fill("archivada")
      await expect(page.getByRole("option", { name: "Cuenta archivada · CRC" })).toHaveAttribute(
        "aria-disabled",
        "true",
      )
      await search.fill("viajar")
      await page.keyboard.press("ArrowDown")
      await page.keyboard.press("Enter")
      await expect(account).toContainText("Ahorro para viajar · USD")
      await expect(account).toBeFocused()
      await account.press("Enter")
      await page.keyboard.press("Escape")
      await expect(account).toBeFocused()

      await page.getByRole("button", { name: "Validar ejemplo", exact: true }).click()
      const concept = page.getByRole("textbox", { name: "Concepto de ejemplo" })
      await expect(concept).toBeFocused()
      await expect(concept).toHaveAttribute("aria-invalid", "true")
      const errorId = await concept.getAttribute("aria-describedby")
      expect(errorId).toBeTruthy()
      await expect(page.locator(`[id="${errorId}"]`)).toHaveText(
        "Escribe un concepto para continuar.",
      )
      await concept.fill("Viaje de ejemplo")
      await expect(concept).not.toHaveAttribute("aria-invalid", "true")
      await page.getByRole("button", { name: "Validar ejemplo", exact: true }).click()
      await expect(page.getByText("Ejemplo validado", { exact: true })).toBeVisible()

      for (const [trigger, title] of [
        ["Abrir diálogo", "Un momento de claridad"],
        ["Abrir panel lateral", "El detalle, a tu alcance"],
        ["Abrir panel inferior", "Una tarea a la vez"],
      ]) {
        const button = page.getByRole("button", { name: trigger, exact: true })
        await button.focus()
        await button.press("Enter")
        const dialog = page.getByRole("dialog", { name: title })
        await expect(dialog).toBeVisible()
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
        expect(axe.violations.map((v) => v.id)).toEqual([])
        // Cycling forward and backward cannot escape a modal.
        for (let step = 0; step < 6; step++) {
          await page.keyboard.press("Tab")
          expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(
            true,
          )
        }
        await page.keyboard.press("Shift+Tab")
        expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(
          true,
        )
        await page.keyboard.press("Escape")
        await expect(dialog).toHaveCount(0)
        await expect(button).toBeFocused()
      }
      await page.getByRole("button", { name: "Mostrar notificación", exact: true }).click()
      await expect(page.getByText("Vista de ejemplo guardada", { exact: true })).toBeVisible()
      await page.getByRole("button", { name: "Cerrar notificación", exact: true }).click()
      await expect(page.getByText("Vista de ejemplo guardada", { exact: true })).toHaveCount(0)
    })
  }
}
