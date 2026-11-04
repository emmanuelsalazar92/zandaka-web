import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import type { TransactionDetail } from "@/lib/transaction-detail"

import { installSyntheticAPI } from "./fixtures"

const description =
  "Pago importado para la reserva familiar.\n" +
  "Descripción extensa con información contable que debe poder consultarse íntegramente. ".repeat(
    5,
  ) +
  "ReferenciaSinEspacios".repeat(12)
const accountName =
  "Cuenta personal para viajes y proyectos de largo plazo " + "IdentificadorMuyLargo".repeat(6)
const envelopeName =
  "Reserva para alojamiento y transporte de la familia " + "DetalleSinEspacios".repeat(6)
function data(id: number, transfer = false): TransactionDetail {
  const line = {
    id: 1,
    accountId: 1,
    accountName,
    accountCurrency: "USD",
    institutionName: "Banco Horizonte",
    envelopeId: 1,
    categoryName: envelopeName,
    envelopeActive: true,
    amount: -1234.56,
  }
  return {
    id,
    userId: 1,
    date: "2026-11-01",
    createdAt: "2026-11-02 01:30:00",
    type: transfer ? "TRANSFER" : "EXPENSE",
    description,
    correction: { available: false, reason: "NO_AUDITED_CORRECTION_FLOW" },
    lines: transfer
      ? [
          line,
          {
            ...line,
            id: 2,
            accountId: 2,
            accountName: "Ahorros de destino",
            envelopeId: 2,
            categoryName: "Reserva de destino",
            amount: 1234.56,
            envelopeActive: false,
          },
        ]
      : [line],
  }
}
type Mode = "success" | "missing" | "forbidden" | "failure" | "malformed" | "slow" | "unknown"
async function fixture(page: Page, transfer = false, mode: Mode = "success") {
  await installSyntheticAPI(page)
  const historyReads: string[] = [],
    detailReads: string[] = []
  let release: () => void = () => {},
    count = 0
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/api/transactions?**", (route) => {
    const url = new URL(route.request().url()),
      current = Number(url.searchParams.get("page")) || 1
    historyReads.push(url.search)
    return route.fulfill({
      json: {
        data: Array.from({ length: 10 }, (_, index) => ({
          ...data((current - 1) * 10 + index + 1, transfer),
          description: index === 0 ? description : `Movimiento de prueba ${index}`,
          lines: [
            {
              accountId: 1,
              envelopeId: 1,
              accountName,
              categoryName: envelopeName,
              accountCurrency: "USD",
              amount: -1234.56,
            },
          ],
        })),
        meta: {
          page: current,
          pageSize: 10,
          totalItems: 20,
          totalPages: 2,
          hasNextPage: current === 1,
          hasPrevPage: current === 2,
        },
      },
    })
  })
  await page.route(/\/api\/transactions\/\d+\?/, async (route) => {
    expect(route.request().method()).toBe("GET")
    const url = new URL(route.request().url()),
      id = Number(url.pathname.split("/").at(-1))
    expect(url.searchParams.get("userId")).toBe("1")
    detailReads.push(url.pathname)
    count++
    if (mode === "slow" && count === 1) await gate
    if (mode === "missing" || mode === "forbidden")
      return route.fulfill({
        status: mode === "missing" ? 404 : 403,
        json: { error: { message: "private server internals" } },
      })
    if (mode === "failure" && count === 1)
      return route.fulfill({
        status: 503,
        json: { error: { message: "private server internals" } },
      })
    if (mode === "malformed")
      return route.fulfill({
        json: { ...data(id), id: 999, description: "Untrusted wrong movement" },
      })
    const detail = data(id, transfer)
    if (mode === "unknown") {
      detail.createdAt = null
      detail.lines[0] = {
        ...detail.lines[0],
        accountName: null,
        accountCurrency: null,
        institutionName: null,
        categoryName: null,
        envelopeActive: null,
      }
    }
    return route.fulfill({ json: detail })
  })
  return { historyReads, detailReads, release }
}
const triggerFor = (page: Page, id = 1) =>
  page.getByRole("button", { name: `Ver detalle del movimiento ${id}`, exact: true })
const dialogFor = (page: Page) =>
  page.getByRole("dialog", { name: "Detalle del movimiento", exact: true })

for (const transfer of [false, true])
  for (const width of [360, 390, 1440])
    for (const theme of ["light", "dark"] as const)
      for (const scale of [100, 200])
        for (const font of width === 360 && scale === 200
          ? ["system", "Arial", "Verdana"]
          : ["system"])
          test(`detail ${transfer ? "transfer" : "expense"} ${width}px ${theme} ${scale}% ${font}`, async ({
            page,
          }, info) => {
            await page.setViewportSize({ width, height: 1000 })
            await page.emulateMedia({ colorScheme: theme })
            const state = await fixture(page, transfer)
            await page.goto("/transactions")
            const trigger = triggerFor(page)
            await trigger.focus()
            await trigger.press(theme === "dark" ? "Space" : "Enter")
            const dialog = dialogFor(page)
            await expect(
              dialog.getByRole("heading", { name: "Detalle del movimiento" }),
            ).toBeFocused()
            await expect(dialog.getByRole("heading", { name: /Desglose completo/ })).toBeVisible()
            await expect(dialog.getByText(description, { exact: true })).toHaveText(description)
            await expect(dialog.getByText(accountName, { exact: true })).toHaveText(accountName)
            await expect(dialog.getByText(envelopeName, { exact: true })).toHaveText(envelopeName)
            await expect(dialog).toContainText("1 de noviembre de 2026")
            await expect(dialog).toContainText("1 nov 2026, 7:30 p. m.")
            if (transfer) {
              await expect(dialog).toContainText("Salida transferida")
              await expect(dialog).toContainText("Entrada transferida")
              await expect(dialog).toContainText("Ahorros de destino")
              await expect(dialog).toContainText("Sobre inactivo · registro conservado")
              await expect(
                dialog.getByRole("region", { name: "Resumen del movimiento" }),
              ).not.toContainText("USD 0,00")
            }
            await page.evaluate(
              ({ scale, font }) => {
                document.documentElement.style.fontSize = `${scale}%`
                if (font !== "system") document.body.style.fontFamily = `"${font}", sans-serif`
              },
              { scale, font },
            )
            const overflow = () =>
              dialog.evaluate((root) => {
                const box = root.getBoundingClientRect(),
                  errors: string[] = []
                for (const element of [
                  root,
                  ...root.querySelectorAll<HTMLElement>("section,p,dt,dd,h2,h3,li,button"),
                ]) {
                  const r = element.getBoundingClientRect()
                  if (
                    r.left < Math.max(0, box.left) - 1 ||
                    r.right > Math.min(innerWidth, box.right) + 1 ||
                    element.scrollWidth > element.clientWidth + 1
                  )
                    errors.push(
                      `${element.tagName}: ${element.textContent?.slice(0, 50)} (${r.left}/${r.right}, ${element.scrollWidth}/${element.clientWidth})`,
                    )
                }
                return errors
              })
            await expect.poll(overflow).toEqual([])
            const results = await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
            expect(
              results.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
            ).toEqual([])
            await dialog.evaluate((element) => {
              element.scrollTop = 0
            })
            await dialog.screenshot({
              path: info.outputPath(
                `detail-${transfer ? "transfer" : "expense"}-${width}-${theme}-${scale}-${font}.png`,
              ),
            })
            const count = state.historyReads.length
            await dialog.getByRole("button", { name: "Volver al historial" }).click()
            await expect(dialog).toHaveCount(0)
            await expect(trigger).toBeFocused()
            expect(state.historyReads).toHaveLength(count)
            expect(state.detailReads).toHaveLength(1)
          })

test("closing with Escape preserves filters, page and scroll and restores the activating card", async ({
  page,
}) => {
  const state = await fixture(page)
  await page.goto("/transactions")
  await page.getByRole("button", { name: "Filtros", exact: true }).click()
  await page.locator("#filter-keyword").fill("reserva familiar")
  await page.getByRole("button", { name: "Buscar", exact: true }).click()
  await page.getByRole("button", { name: "Página siguiente", exact: true }).click()
  const trigger = triggerFor(page, 19)
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  const scroll = await page.evaluate(() => window.scrollY),
    reads = state.historyReads.length
  await expect(dialogFor(page).getByRole("heading", { name: /Desglose completo/ })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(trigger).toBeFocused()
  expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(scroll, 0)
  expect(state.historyReads).toHaveLength(reads)
  expect(state.historyReads.at(-1)).toContain("page=2")
  expect(state.historyReads.at(-1)).toContain("q=reserva+familiar")
  await expect(page.getByText('"reserva familiar"', { exact: true })).toBeVisible()
})

for (const mode of ["missing", "forbidden", "failure", "malformed"] as const)
  test(`detail ${mode}: explicit error without partial success or raw server data`, async ({
    page,
  }) => {
    const state = await fixture(page, false, mode)
    await page.goto("/transactions")
    await triggerFor(page).click()
    const dialog = dialogFor(page)
    await expect(dialog.getByRole("alert")).toContainText("Ficha no disponible")
    await expect(dialog.getByRole("region", { name: "Resumen del movimiento" })).toHaveCount(0)
    await expect(dialog).not.toContainText("private server internals")
    await expect(dialog).not.toContainText("Untrusted wrong movement")
    const retry = dialog.getByRole("button", { name: "Volver a cargar ficha" })
    if (mode === "missing" || mode === "forbidden") await expect(retry).toHaveCount(0)
    if (mode === "failure") {
      await retry.click()
      await expect(dialog.getByRole("heading", { name: /Desglose completo/ })).toBeVisible()
      expect(state.detailReads).toHaveLength(2)
    }
    await page.keyboard.press("Escape")
    await expect(triggerFor(page)).toBeFocused()
  })

test("closing a slow read and opening another movement never displays the stale result", async ({
  page,
}) => {
  const state = await fixture(page, false, "slow")
  await page.goto("/transactions")
  await triggerFor(page).click()
  await expect(dialogFor(page).getByRole("status")).toContainText("Cargando ficha completa")
  await page.keyboard.press("Escape")
  await triggerFor(page, 2).click()
  await expect(dialogFor(page).getByRole("heading", { name: /Desglose completo/ })).toBeVisible()
  state.release()
  await expect(dialogFor(page)).toContainText("Movimiento #2")
  await expect(dialogFor(page)).not.toContainText("Movimiento #1")
})

test("unknown metadata remains explicit and no correction action is offered", async ({ page }) => {
  await fixture(page, false, "unknown")
  await page.goto("/transactions")
  await triggerFor(page).click()
  const dialog = dialogFor(page)
  await expect(dialog).toContainText("Moneda no disponible")
  await expect(dialog).toContainText("Cuenta sin identificar (#1)")
  await expect(dialog).toContainText("Sobre sin identificar (#1)")
  await expect(dialog).toContainText("No disponible")
  await expect(dialog).toContainText("Editar o borrar no está disponible")
  await expect(dialog.getByRole("button", { name: /Editar|Borrar|Eliminar/ })).toHaveCount(0)
  await expect(dialog.getByRole("region", { name: "Resumen del movimiento" })).not.toContainText(
    "CRC",
  )
})

test("focus remains in the detail and the close icon returns it to the card", async ({ page }) => {
  await fixture(page)
  await page.goto("/transactions")
  await triggerFor(page).click()
  const dialog = dialogFor(page)
  await expect(dialog.getByRole("heading", { name: /Desglose completo/ })).toBeVisible()
  for (let index = 0; index < 6; index++) {
    await page.keyboard.press("Tab")
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  }
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click()
  await expect(triggerFor(page)).toBeFocused()
})
