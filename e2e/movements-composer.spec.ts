import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { installSyntheticAPI } from "./fixtures"

type Payload = {
  userId: number
  type: string
  date: string
  description: string
  lines: Array<{ accountId: number; envelopeId: number; amount: number }>
}
async function fixture(
  page: Page,
  mode:
    | "success"
    | "lost"
    | "malformed"
    | "rejected"
    | "envelope-error"
    | "stale-recent"
    | "slow-options"
    | "slow-save" = "success",
) {
  await installSyntheticAPI(page)
  const posts: Payload[] = [],
    reads: string[] = []
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/api/accounts", (route) =>
    route.fulfill({
      json: [
        { id: 1, name: "Diaria", currency: "CRC", institution: "Banco Horizonte", is_active: 1 },
        { id: 2, name: "Viajes", currency: "USD", institution: "Banco Horizonte", is_active: 1 },
        {
          id: 3,
          name: "Sin sobres",
          currency: "CRC",
          institution: "Banco Horizonte",
          is_active: 1,
        },
      ],
    }),
  )
  await page.route("**/api/reports/envelope-balances?**", async (route) => {
    const id = new URL(route.request().url()).searchParams.get("accountId")!
    reads.push(id)
    if (mode === "envelope-error" && reads.length === 1)
      return route.fulfill({ status: 503, json: {} })
    if (mode === "slow-options" && id === "1") await gate
    const rows =
      id === "1"
        ? Array.from({ length: 16 }, (_, i) => ({
            envelopeId: 11 + i,
            categoryId: 11 + i,
            categoryName: i === 0 ? "Alimentos" : `Propósito ${i + 1}`,
            balance: 1000,
          }))
        : id === "2"
          ? [{ envelopeId: 21, categoryId: 21, categoryName: "Alojamiento", balance: 1000 }]
          : []
    await route.fulfill({
      json: mode === "stale-recent" ? rows.filter((r) => r.envelopeId !== 11) : rows,
    })
  })
  await page.route("**/api/transactions?**", (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: 1,
            userId: 1,
            type: "EXPENSE",
            date: "2026-11-02",
            description: "Compra de ejemplo",
            lines: [
              {
                accountId: 1,
                envelopeId: 11,
                accountName: "Diaria",
                categoryName: "Alimentos",
                amount: -0.02,
              },
            ],
          },
        ],
        meta: {
          page: 1,
          pageSize: 10,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      },
    }),
  )
  await page.route("**/api/transactions", async (route) => {
    expect(route.request().method()).toBe("POST")
    const p = route.request().postDataJSON() as Payload
    posts.push(p)
    if (mode === "lost") return route.abort("failed")
    if (mode === "malformed") return route.fulfill({ status: 201, json: {} })
    if (mode === "rejected")
      return route.fulfill({ status: 409, json: { error: { code: "INACTIVE_RESOURCE" } } })
    if (mode === "slow-save") await gate
    await route.fulfill({
      status: 201,
      json: {
        transaction: {
          id: 91,
          user_id: p.userId,
          type: p.type,
          date: p.date,
          description: p.description,
        },
        lines: p.lines.map((l) => ({
          account_id: l.accountId,
          envelope_id: l.envelopeId,
          amount: l.amount,
        })),
      },
    })
  })
  return { posts, reads, release }
}
async function choose(page: Page, number: number, kind: "cuenta" | "sobre", value: string) {
  const label = `${kind === "cuenta" ? "Cuenta" : "Sobre"} ${number}`
  const trigger = page.getByRole("button", { name: label, exact: true })
  await expect(trigger).toBeEnabled()
  await trigger.focus()
  await trigger.press("Enter")
  const search = page.getByRole("combobox", { name: `Buscar ${kind} ${number}`, exact: true })
  await expect(search).toBeFocused()
  await search.fill(value)
  await search.press("ArrowDown")
  await search.press("Enter")
  await expect(trigger).toBeFocused()
}
async function open(page: Page, kind = "EXPENSE") {
  await page.goto("/transactions")
  await page.getByRole("button", { name: "Nuevo movimiento", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Nuevo movimiento", exact: true })
  if (kind === "INCOME") {
    await dialog.getByRole("combobox", { name: "Tipo", exact: true }).click()
    await page.getByRole("option", { name: "Ingreso", exact: true }).click()
  }
  await dialog.getByLabel("Descripción", { exact: true }).fill("Movimiento de ejemplo")
  return dialog
}
async function fill(
  page: Page,
  number = 1,
  account = "Viajes",
  envelope = "Alojamiento",
  amount = "0.02",
) {
  await choose(page, number, "cuenta", account)
  await choose(page, number, "sobre", envelope)
  await page.getByLabel(new RegExp(`^Importe ${number} en`)).fill(amount)
  await page.getByLabel(new RegExp(`^Importe ${number} en`)).press("Tab")
}

for (const kind of ["INCOME", "EXPENSE"])
  for (const width of [360, 390, 1440])
    for (const theme of ["light", "dark"] as const)
      for (const scale of [100, 200])
        for (const font of width === 360 && scale === 200
          ? ["system", "Arial", "Verdana"]
          : ["system"])
          test(`movement ${kind} ${width}px ${theme} ${scale}% ${font}: explicit USD and keyboard`, async ({
            page,
          }, info) => {
            await page.setViewportSize({ width, height: 1000 })
            await page.emulateMedia({ colorScheme: theme })
            const state = await fixture(page),
              dialog = await open(page, kind)
            await fill(page, 1, "Viajes", "Alojamiento", "1234.56")
            await expect(
              dialog.getByRole("button", { name: "Cuenta 1", exact: true }),
            ).toContainText("Viajes · Banco Horizonte · USD")
            await expect(
              dialog.getByRole("region", { name: "Resumen del movimiento" }),
            ).toContainText("USD")
            await page.evaluate(
              ({ scale, font }) => {
                document.documentElement.style.fontSize = `${scale}%`
                if (font !== "system") document.body.style.fontFamily = `"${font}", sans-serif`
              },
              { scale, font },
            )
            const geometry = () =>
              dialog.evaluate((root) => {
                const box = root.getBoundingClientRect(),
                  errors: string[] = []
                for (const el of [
                  root,
                  ...root.querySelectorAll<HTMLElement>("fieldset,section,p,h2,label,button,input"),
                ]) {
                  const r = el.getBoundingClientRect()
                  if (
                    r.left < Math.max(0, box.left) - 1 ||
                    r.right > Math.min(innerWidth, box.right) + 1 ||
                    (!(el instanceof HTMLInputElement && el.type === "text") &&
                      el.scrollWidth > el.clientWidth + 1)
                  )
                    errors.push(
                      `${el.tagName}: ${el.textContent?.slice(0, 60)} (${r.left}/${r.right} ${el.scrollWidth}/${el.clientWidth})`,
                    )
                }
                return errors
              })
            await expect.poll(geometry).toEqual([])
            const results = await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
            expect(
              results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
            ).toEqual([])
            await dialog.screenshot({
              path: info.outputPath(`movement-${kind}-${width}-${theme}-${scale}-${font}.png`),
            })
            await dialog
              .getByRole("region", { name: "Resumen del movimiento" })
              .screenshot({ path: info.outputPath("summary.png") })
            await dialog
              .getByRole("button", {
                name: kind === "INCOME" ? "Guardar ingreso" : "Guardar gasto",
                exact: true,
              })
              .click()
            await expect(dialog).toHaveCount(0)
            expect(state.posts).toHaveLength(1)
            expect(state.posts[0]).toMatchObject({
              type: kind,
              date: "2026-11-03",
              lines: [
                { accountId: 2, envelopeId: 21, amount: kind === "INCOME" ? 1234.56 : -1234.56 },
              ],
            })
          })

test("progressive details retain exact cents, separate currencies and restore focus on removal", async ({
  page,
}) => {
  const state = await fixture(page),
    dialog = await open(page, "INCOME")
  await fill(page, 1, "Diaria", "Alimentos", "0.1")
  await dialog.getByRole("button", { name: "Desglosar en varias líneas" }).click()
  await expect(dialog.getByRole("button", { name: "Cuenta 2", exact: true })).toBeFocused()
  await fill(page, 2, "Diaria", "Alimentos", "0.2")
  await expect(dialog.getByRole("region", { name: "Resumen del movimiento" })).toContainText(/0,30/)
  expect(state.reads).toEqual(["1"])
  await dialog.getByRole("button", { name: "Añadir detalle", exact: true }).click()
  await fill(page, 3, "Viajes", "Alojamiento", "0.02")
  await expect(dialog.getByRole("region", { name: "Resumen del movimiento" })).toContainText(
    "Totales separados por moneda",
  )
  await dialog.getByRole("button", { name: "Quitar detalle 3" }).click()
  await expect(dialog.getByRole("button", { name: "Cuenta 2", exact: true })).toBeFocused()
  await dialog.getByRole("button", { name: "Guardar ingreso", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(state.posts[0].lines).toEqual([
    { accountId: 1, envelopeId: 11, amount: 0.1 },
    { accountId: 1, envelopeId: 11, amount: 0.2 },
  ])
})

test("account changes clear incompatible envelope and currency amount with an explanation", async ({
  page,
}) => {
  const state = await fixture(page),
    dialog = await open(page)
  await fill(page)
  await choose(page, 1, "cuenta", "Diaria")
  await expect(dialog.getByLabel(/^Importe 1/)).toHaveValue("")
  await expect(dialog.getByRole("button", { name: "Sobre 1", exact: true })).toContainText(
    "Elige un sobre",
  )
  await expect(dialog.getByText(/Cambió la moneda/)).toBeVisible()
  await expect(dialog.getByRole("button", { name: "Guardar gasto" })).toBeDisabled()
  expect(state.posts).toHaveLength(0)
})

for (const mode of ["success", "stale-recent"] as const)
  test(`recent ${mode}: explicit proposal is checked against current membership`, async ({
    page,
  }) => {
    const state = await fixture(page, mode),
      dialog = await open(page)
    await expect(dialog.getByRole("button", { name: "Cuenta 1", exact: true })).toContainText(
      "Elige una cuenta",
    )
    const recent = dialog.getByRole("region", { name: "Propuestas recientes" })
    await expect(recent).toContainText("De los movimientos cargados")
    await recent.getByRole("button").click()
    if (mode === "success") {
      await expect(dialog.getByRole("button", { name: "Sobre 1", exact: true })).toContainText(
        "Alimentos",
      )
      await recent.getByRole("button").click() // cached options must still resolve the explicit proposal
      await expect(dialog.getByText(/Propuesta reciente aplicada/)).toBeVisible()
    } else {
      await expect(dialog.getByText(/ya no está disponible/)).toBeVisible()
      await expect(dialog.getByRole("button", { name: "Sobre 1", exact: true })).toContainText(
        "Elige un sobre",
      )
    }
    await expect(dialog.getByLabel(/^Importe 1/)).toHaveValue("")
    expect(state.posts).toHaveLength(0)
  })

test("late envelope responses do not cross accounts", async ({ page }) => {
  const state = await fixture(page, "slow-options"),
    dialog = await open(page)
  await choose(page, 1, "cuenta", "Diaria")
  await choose(page, 1, "cuenta", "Viajes")
  await choose(page, 1, "sobre", "Alojamiento")
  state.release()
  await expect(dialog.getByRole("button", { name: "Sobre 1", exact: true })).toContainText(
    "Alojamiento",
  )
  await choose(page, 1, "cuenta", "Diaria")
  await choose(page, 1, "sobre", "Propósito 16")
  expect(state.reads.sort()).toEqual(["1", "2"])
})

test("failed options wait for explicit retry without clearing the draft", async ({ page }) => {
  const state = await fixture(page, "envelope-error"),
    dialog = await open(page)
  await choose(page, 1, "cuenta", "Viajes")
  await expect(dialog.getByRole("button", { name: "Volver a cargar sobres 1" })).toBeVisible()
  await dialog.getByLabel(/^Importe 1/).fill("0.02")
  await dialog.getByLabel("Descripción", { exact: true }).fill("Texto conservado")
  expect(state.reads).toEqual(["2"])
  await dialog.getByRole("button", { name: "Volver a cargar sobres 1" }).click()
  await choose(page, 1, "sobre", "Alojamiento")
  await expect(dialog.getByLabel(/^Importe 1/)).toHaveValue("-0.02")
  expect(state.reads).toEqual(["2", "2"])
})

for (const mode of ["lost", "malformed"] as const)
  test(`${mode} confirmation does not invite a blind retry`, async ({ page }) => {
    const state = await fixture(page, mode),
      dialog = await open(page)
    await fill(page)
    await dialog.getByRole("button", { name: "Guardar gasto", exact: true }).click()
    await expect(dialog.getByText("Resultado por confirmar")).toBeVisible()
    await expect(dialog.getByRole("button", { name: "Guardar gasto", exact: true })).toBeDisabled()
    await dialog.getByRole("button", { name: "Revisar movimientos", exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(
      page.getByText("Revisa el movimiento por confirmar", { exact: true }),
    ).toBeVisible()
    await expect(page.getByText("Gasto registrado", { exact: true })).toHaveCount(0)
    expect(state.posts).toHaveLength(1)
  })

test("a definitive rejection preserves editable input", async ({ page }) => {
  await fixture(page, "rejected")
  const dialog = await open(page)
  await fill(page)
  await dialog.getByRole("button", { name: "Guardar gasto", exact: true }).click()
  await expect(dialog.getByText(/ya no está activo/)).toBeVisible()
  await expect(dialog.getByLabel(/^Importe 1/)).toHaveValue("-0.02")
  await expect(dialog.getByRole("button", { name: "Guardar gasto", exact: true })).toBeEnabled()
  await expect(dialog.getByRole("button", { name: "Actualizar opciones" })).toBeEnabled()
})

test("an in-flight save blocks dismissal and repeated activation", async ({ page }) => {
  const state = await fixture(page, "slow-save"),
    dialog = await open(page)
  await fill(page)
  await dialog.getByRole("button", { name: "Guardar gasto", exact: true }).click()
  await expect.poll(() => state.posts.length).toBe(1)
  await page.keyboard.press("Escape")
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole("button", { name: "Cerrar", exact: true })).toHaveCount(0)
  await expect(dialog.getByLabel(/^Importe 1/)).toBeDisabled()
  state.release()
  await expect(dialog).toHaveCount(0)
  expect(state.posts).toHaveLength(1)
})
