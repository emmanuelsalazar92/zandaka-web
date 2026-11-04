import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { installSyntheticAPI } from "./fixtures"

type Intent = {
  requestId: string
  userId: number
  date: string
  description: string
  amount: number
  from: { accountId: number; envelopeId: number }
  to: { accountId: number; envelopeId: number }
}
async function fixtures(
  page: Page,
  mode: "success" | "lost" | "malformed" | "timeout" | "delayed" | "rejected" = "success",
) {
  await installSyntheticAPI(page)
  const requests: Intent[] = [],
    receipts = new Map<string, object>(),
    envelopeReads: string[] = []
  let releaseFirst: () => void = () => {}
  const firstResponse = new Promise<void>((resolve) => {
    releaseFirst = resolve
  })
  await page.route("**/api/accounts", (route) =>
    route.fulfill({
      json: [
        { id: 1, name: "Cuenta principal", currency: "CRC", is_active: 1 },
        { id: 2, name: "Ahorros", currency: "CRC", is_active: 1 },
        { id: 3, name: "Cuenta en dólares", currency: "USD", is_active: 1 },
        { id: 4, name: "Cuenta sin sobres", currency: "CRC", is_active: 1 },
      ],
    }),
  )
  await page.route("**/api/reports/envelope-balances?**", (route) => {
    const account = new URL(route.request().url()).searchParams.get("accountId")!
    envelopeReads.push(account)
    const entries =
      account === "1"
        ? [
            [11, "Diario"],
            [12, "Reserva"],
          ]
        : account === "2"
          ? [[21, "Metas"]]
          : account === "3"
            ? [[31, "Dólares"]]
            : []
    return route.fulfill({
      json: entries.map(([id, name]) => ({
        envelopeId: id,
        categoryId: id,
        categoryName: name,
        balance: 1000,
      })),
    })
  })
  await page.route("**/api/transfers", async (route) => {
    expect(route.request().method()).toBe("POST")
    const p = route.request().postDataJSON() as Intent
    requests.push(p)
    if (mode === "rejected" && requests.length === 1)
      return route.fulfill({ status: 409, json: { error: { code: "INACTIVE_RESOURCE" } } })
    if (!receipts.has(p.requestId))
      receipts.set(p.requestId, {
        transaction: {
          id: 90,
          user_id: p.userId,
          date: p.date,
          description: p.description,
          type: "TRANSFER",
        },
        lines: [
          { account_id: p.from.accountId, envelope_id: p.from.envelopeId, amount: -p.amount },
          { account_id: p.to.accountId, envelope_id: p.to.envelopeId, amount: p.amount },
        ],
      })
    if (requests.length === 1 && mode === "lost") return route.abort("failed")
    if (requests.length === 1 && mode === "malformed")
      return route.fulfill({ status: 201, json: { transaction: { id: 90 }, lines: [] } })
    if (requests.length === 1 && mode === "timeout")
      return route.fulfill({ status: 408, json: { error: { code: "REQUEST_TIMEOUT" } } })
    if (requests.length === 1 && mode === "delayed") await firstResponse
    await route.fulfill({ status: 201, json: receipts.get(p.requestId) })
  })
  return { requests, receipts, envelopeReads, releaseFirst }
}
async function choose(page: Page, field: string, searchLabel: string, option: string) {
  const trigger = page.getByRole("button", { name: field, exact: true })
  await expect(trigger).toBeEnabled()
  await trigger.focus()
  await trigger.press("Enter")
  const search = page.getByRole("combobox", { name: searchLabel, exact: true })
  await expect(search).toBeFocused()
  await search.fill(option)
  await search.press("ArrowDown")
  await search.press("Enter")
  await expect(trigger).toContainText(option)
  await expect(trigger).toBeFocused()
}
async function open(page: Page) {
  await page.goto("/transactions")
  await page.getByRole("button", { name: "Nuevo movimiento", exact: true }).first().click()
  await page.getByRole("combobox", { name: "Tipo", exact: true }).click()
  await page.getByRole("option", { name: "Transferencia", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Transferencia", exact: true })).toBeVisible()
  await page.getByRole("textbox", { name: "Descripción", exact: true }).fill("Ahorro de ejemplo")
}
async function fill(page: Page, destination = "Cuenta principal · CRC", envelope = "Reserva") {
  await choose(page, "Cuenta de origen", "Buscar cuenta de origen", "Cuenta principal · CRC")
  await choose(page, "Sobre de origen", "Buscar sobre de origen", "Diario")
  await choose(page, "Cuenta de destino", "Buscar cuenta de destino", destination)
  await choose(page, "Sobre de destino", "Buscar sobre de destino", envelope)
  await page.getByRole("textbox", { name: "Importe en CRC", exact: true }).fill("1234.56")
}

for (const width of [360, 390, 1440])
  for (const colorScheme of ["light", "dark"] as const)
    for (const scale of [100, 200]) {
      for (const font of width === 360 && scale === 200
        ? ["system", "Arial", "Verdana"]
        : ["system"]) {
        test(`transfer ${width}px ${colorScheme} text ${scale}% ${font}: keyboard intent and readable summary`, async ({
          page,
        }, info) => {
          await page.setViewportSize({ width, height: 1000 })
          await page.emulateMedia({ colorScheme })
          const state = await fixtures(page)
          await open(page)
          await fill(page)
          const dialog = page.getByRole("dialog", { name: "Transferencia", exact: true })
          await expect(dialog.getByRole("button", { name: "Añadir detalle" })).toHaveCount(0)
          await expect(
            dialog.getByRole("region", { name: "Resumen de transferencia" }),
          ).toContainText("El saldo total de esta cuenta no cambia")
          expect(state.envelopeReads.filter((id) => id === "1")).toHaveLength(1)
          await page.evaluate((value) => {
            document.documentElement.style.fontSize = `${value}%`
          }, scale)
          if (font !== "system")
            await page.evaluate((family) => {
              document.body.style.fontFamily = `"${family}", sans-serif`
            }, font)
          // Single-line text inputs scroll their editable value by design; their boxes
          // must fit, while prose, controls and the complete summary must not clip.
          const measureGeometry = () =>
            dialog.evaluate((element) => {
              const bounds = element.getBoundingClientRect(),
                width = window.innerWidth,
                errors: string[] = []
              for (const node of [
                element,
                ...element.querySelectorAll<HTMLElement>(
                  "input,button,fieldset,section,p,h2,legend",
                ),
              ]) {
                const rect = node.getBoundingClientRect()
                if (
                  rect.left < Math.max(0, bounds.left) - 1 ||
                  rect.right > Math.min(width, bounds.right) + 1 ||
                  (!(node instanceof HTMLInputElement && node.type === "text") &&
                    node.scrollWidth > node.clientWidth + 1)
                )
                  errors.push(
                    `${node.tagName}#${node.id}: ${node.textContent?.slice(0, 55)} bounds=${rect.left}/${rect.right} scroll=${node.scrollWidth}/${node.clientWidth}`,
                  )
              }
              for (const value of element.querySelectorAll("[data-transfer-value]")) {
                const range = document.createRange()
                range.selectNodeContents(value)
                // React renders the sign and formatted value as separate text nodes;
                // their fragments must share a baseline, not a single DOM rectangle.
                const rows = new Set(
                  [...range.getClientRects()].map((rect) => Math.round(rect.top)),
                )
                if (rows.size !== 1) errors.push("Transfer amount wraps digits")
              }
              return errors
            })
          await expect.poll(measureGeometry).toEqual([])
          const axe = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
          expect(
            axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
          ).toEqual([])
          await dialog
            .getByRole("region", { name: "Resumen de transferencia" })
            .screenshot({ path: info.outputPath("summary.png") })
          await dialog.getByRole("button", { name: "Guardar transferencia", exact: true }).click()
          await expect(dialog).toHaveCount(0)
          expect(state.requests).toHaveLength(1)
          expect(state.requests[0]).toMatchObject({
            amount: 1234.56,
            from: { accountId: 1, envelopeId: 11 },
            to: { accountId: 1, envelopeId: 12 },
            date: "2026-11-03",
          })
          expect(state.requests[0]).not.toHaveProperty("lines")
          expect(state.receipts.size).toBe(1)
        })
      }
    }

test("invalid input, identical endpoints and cross-currency choices are explained before posting", async ({
  page,
}) => {
  const state = await fixtures(page)
  await open(page)
  await fill(page)
  const amount = page.getByRole("textbox", { name: "Importe en CRC", exact: true }),
    save = page.getByRole("button", { name: "Guardar transferencia", exact: true })
  for (const invalid of ["-10", "0", "1e-2", "1,000", "0.001"]) {
    await amount.fill(invalid)
    await expect(amount).toHaveAttribute("aria-invalid", "true")
    await expect(save).toBeDisabled()
  }
  await amount.fill("0.02")
  await choose(page, "Sobre de destino", "Buscar sobre de destino", "Diario")
  await expect(page.getByText("Elige un sobre de destino diferente al de origen.")).toBeVisible()
  await expect(save).toBeDisabled()
  await choose(page, "Cuenta de destino", "Buscar cuenta de destino", "Cuenta en dólares · USD")
  await expect(page.getByText(/las transferencias todavía no convierten monedas/)).toBeVisible()
  await expect(save).toBeDisabled()
  const dest = page.getByRole("button", { name: "Cuenta de destino", exact: true })
  await expect(dest).toHaveAttribute("aria-invalid", "true")
  expect(await dest.getAttribute("aria-describedby")).toBeTruthy()
  expect(state.requests).toHaveLength(0)
  await choose(page, "Cuenta de destino", "Buscar cuenta de destino", "Ahorros · CRC")
  await choose(page, "Sobre de destino", "Buscar sobre de destino", "Metas")
  await expect(save).toBeEnabled()
  await save.click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  expect(state.requests[0].to).toEqual({ accountId: 2, envelopeId: 21 })
})

for (const mode of ["lost", "malformed", "timeout"] as const)
  test(`a ${mode} confirmation survives reload and replays the exact intent`, async ({ page }) => {
    const state = await fixtures(page, mode)
    await open(page)
    await fill(page)
    await page.getByRole("button", { name: "Guardar transferencia", exact: true }).click()
    await expect(
      page.getByRole("button", { name: "Reintentar transferencia", exact: true }),
    ).toBeEnabled()
    await expect(page.getByRole("textbox", { name: "Importe en CRC", exact: true })).toHaveCount(0)
    expect(state.receipts.size).toBe(1)
    await page.reload()
    await page.getByRole("button", { name: "Revisar transferencia", exact: true }).click()
    await expect(page.getByRole("region", { name: "Resumen de transferencia" })).toContainText(
      "Cuenta principal · Diario",
    )
    await page.getByRole("button", { name: "Reintentar transferencia", exact: true }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    expect(state.requests).toHaveLength(2)
    expect(state.requests[1]).toEqual(state.requests[0])
    expect(state.receipts.size).toBe(1)
    expect(await page.evaluate(() => sessionStorage.length)).toBe(0)
  })

test("an authoritative rejection keeps editable input; storage failure never sends money", async ({
  page,
}) => {
  const state = await fixtures(page, "rejected")
  await open(page)
  await fill(page)
  await page.getByRole("button", { name: "Guardar transferencia", exact: true }).click()
  await expect(page.getByRole("textbox", { name: "Importe en CRC", exact: true })).toHaveValue(
    "1234.56",
  )
  await expect(page.getByText(/ya no está activo/)).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0)
  await expect(
    page.getByRole("button", { name: "Guardar transferencia", exact: true }),
  ).toBeEnabled()
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("zandaka.transfer.pending")) throw Error("Synthetic quota")
      return original.call(this, key, value)
    }
  })
  await page.getByRole("button", { name: "Guardar transferencia", exact: true }).click()
  await expect(page.getByText(/La operación no se envió/)).toBeVisible()
  expect(state.requests).toHaveLength(1)
})

test("closing during a save preserves recovery when the response arrives after unmount", async ({
  page,
}) => {
  const state = await fixtures(page, "delayed")
  await open(page)
  await fill(page)
  await page.getByRole("button", { name: "Guardar transferencia", exact: true }).click()
  await expect.poll(() => state.requests.length).toBe(1)
  await page.getByRole("button", { name: "Cerrar", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  const response = page.waitForResponse((r) => r.url().endsWith("/api/transfers"))
  state.releaseFirst()
  await response
  await page.getByRole("button", { name: "Revisar transferencia", exact: true }).click()
  await page.getByRole("button", { name: "Reintentar transferencia", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  expect(state.requests).toHaveLength(2)
  expect(state.requests[1]).toEqual(state.requests[0])
  expect(state.receipts.size).toBe(1)
})
