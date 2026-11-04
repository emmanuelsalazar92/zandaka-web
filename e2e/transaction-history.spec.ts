import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { installSyntheticAPI } from "./fixtures"

const description = "Lote de revisión familiar · " + "ReferenciaExtensaSinEspacios".repeat(7)
function movement(id: number) {
  const type = (["INCOME", "EXPENSE", "TRANSFER", "ADJUSTMENT"] as const)[(id - 1) % 4]
  const line = {
    id: id * 10,
    accountId: 1,
    accountName: "Cuenta de viajes de largo plazo",
    accountCurrency: "USD",
    institutionName: "Banco Horizonte",
    envelopeId: 1,
    categoryName: "Reserva familiar y proyectos de largo plazo",
    envelopeActive: true,
    amount: type === "INCOME" ? 1234.56 : -1234.56,
  }
  return {
    id,
    userId: 1,
    date: `2026-11-${String(6 - Math.floor((id - 1) / 10)).padStart(2, "0")}`,
    createdAt: "2026-11-07 01:00:00",
    type,
    description: `${description} · #${id}`,
    correction: { available: false, reason: "NO_AUDITED_CORRECTION_FLOW" },
    lines:
      type === "TRANSFER"
        ? [
            line,
            {
              ...line,
              id: id * 10 + 1,
              accountId: 2,
              accountName: "Ahorros",
              envelopeId: 2,
              categoryName: "Reserva",
              amount: 1234.56,
            },
          ]
        : type === "ADJUSTMENT"
          ? [line, { ...line, id: id * 10 + 1, accountId: 3, accountCurrency: "CRC", amount: 200 }]
          : [line],
  }
}
async function fixture(
  page: Page,
  mode:
    | "success"
    | "error"
    | "slow"
    | "malformed"
    | "unknown"
    | "envelope-error"
    | "shrinking" = "success",
) {
  await installSyntheticAPI(page)
  const reads: string[] = [],
    details: number[] = []
  let release: () => void = () => {},
    envelopeReads = 0
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/api/accounts", (route) =>
    route.fulfill({
      json: [
        {
          id: 1,
          name: "Cuenta de viajes de largo plazo",
          currency: "USD",
          is_active: 1,
          institution_name: "Banco Horizonte",
        },
        { id: 2, name: "Ahorros", currency: "USD", is_active: 1 },
        { id: 3, name: "Diaria", currency: "CRC", is_active: 1 },
      ],
    }),
  )
  await page.route("**/api/reports/envelope-balances?**", (route) => {
    envelopeReads++
    return mode === "envelope-error" && envelopeReads === 1
      ? route.fulfill({ status: 503, json: {} })
      : route.fulfill({
          json: [{ envelopeId: 1, categoryId: 1, categoryName: "Reserva", balance: 100 }],
        })
  })
  await page.route("**/api/transactions?**", async (route) => {
    expect(route.request().method()).toBe("GET")
    const url = new URL(route.request().url()),
      query = url.searchParams,
      current = Number(query.get("page")),
      size = Number(query.get("pageSize"))
    reads.push(url.search)
    if (mode === "error" && reads.length === 1)
      return route.fulfill({ status: 503, json: { error: { message: "Private backend detail" } } })
    if (mode === "malformed") return route.fulfill({ json: { data: [], meta: { totalItems: 0 } } })
    if (mode === "slow" && current === 2) await gate
    let rows = Array.from({ length: 60 }, (_, i) => movement(i + 1))
    if (mode === "shrinking" && reads.length > 1) rows = rows.slice(0, 5)
    if (query.get("q") === "nadie") rows = []
    if (query.get("type")) rows = rows.filter((row) => row.type === query.get("type"))
    const data = rows.slice((current - 1) * size, current * size)
    if (mode === "unknown")
      for (const row of data)
        row.lines = [
          {
            ...row.lines[0],
            accountId: 999,
            accountCurrency: "",
            accountName: "Cuenta sin identificar",
          },
        ]
    return route.fulfill({
      json: {
        data,
        meta: {
          page: current,
          pageSize: size,
          totalItems: rows.length,
          totalPages: Math.ceil(rows.length / size),
          hasNextPage: current * size < rows.length,
          hasPrevPage: current > 1,
        },
      },
    })
  })
  await page.route(/\/api\/transactions\/\d+\?/, (route) => {
    const id = Number(new URL(route.request().url()).pathname.split("/").at(-1))
    details.push(id)
    return route.fulfill({ json: movement(id) })
  })
  return {
    reads,
    details,
    release,
    get envelopeReads() {
      return envelopeReads
    },
  }
}
async function choose(page: Page, name: string, value: string) {
  await page.getByRole("combobox", { name, exact: true }).click()
  await page.getByRole("option", { name: value, exact: true }).click()
}
const rows = (page: Page) => page.getByTestId("history-row")
const status = (page: Page) => page.getByTestId("history-status")

for (const width of [360, 390, 1440])
  for (const theme of ["light", "dark"] as const)
    for (const scale of [100, 200])
      for (const font of width === 360 && scale === 200
        ? ["system", "Arial", "Verdana"]
        : ["system"])
        for (const density of ["Compacta", "Cómoda"])
          test(`history ${width}px ${theme} ${scale}% ${font} ${density}`, async ({
            page,
          }, info) => {
            await page.setViewportSize({ width, height: 1000 })
            await page.emulateMedia({ colorScheme: theme })
            await fixture(page)
            await page.goto("/transactions")
            await expect(rows(page)).toHaveCount(10)
            await page.getByRole("button", { name: density, exact: true }).click()
            await expect(page.getByRole("button", { name: density, exact: true })).toHaveAttribute(
              "aria-pressed",
              "true",
            )
            await page.getByRole("button", { name: "Filtros", exact: true }).click()
            await page.locator("#filter-keyword").fill("lote")
            await page.getByRole("button", { name: "Buscar", exact: true }).click()
            await expect(status(page)).toContainText("1–10 de 60")
            await page.getByRole("button", { name: "Filtros", exact: true }).click()
            await page.evaluate(
              ({ scale, font }) => {
                document.documentElement.style.fontSize = `${scale}%`
                if (font !== "system") document.body.style.fontFamily = `"${font}",sans-serif`
              },
              { scale, font },
            )
            const main = page.locator("main#main-content")
            const geometry = () =>
              main.evaluate((root) => {
                const box = root.getBoundingClientRect(),
                  errors: string[] = []
                for (const el of root.querySelectorAll<HTMLElement>(
                  "section,article,button,a,input,h1,h2,h3,label,p,nav",
                )) {
                  const rect = el.getBoundingClientRect(),
                    style = getComputedStyle(el)
                  const preview =
                    style.textOverflow === "ellipsis" || Number(style.webkitLineClamp) > 0
                  if (
                    rect.width &&
                    (rect.left < Math.max(0, box.left) - 1 ||
                      rect.right > Math.min(innerWidth, box.right) + 1 ||
                      (!preview && el.scrollWidth > el.clientWidth + 1))
                  )
                    errors.push(
                      `${el.tagName}:${el.textContent?.slice(0, 35)} ${rect.left}/${rect.right} ${el.scrollWidth}/${el.clientWidth}`,
                    )
                }
                return errors
              })
            await expect.poll(geometry).toEqual([])
            await page.getByRole("button", { name: "Filtros", exact: true }).click()
            await expect(page.locator("#filter-keyword")).toBeVisible()
            await expect.poll(geometry).toEqual([])
            await page.getByRole("button", { name: "Filtros", exact: true }).click()
            const transfer = rows(page).filter({
              has: page.getByRole("button", { name: "Ver detalle del movimiento 3", exact: true }),
            })
            const mixed = rows(page).filter({
              has: page.getByRole("button", { name: "Ver detalle del movimiento 4", exact: true }),
            })
            await expect(transfer).toContainText("Transferencia")
            await expect(transfer).toContainText("Salida")
            await expect(transfer).toContainText("Entrada")
            await expect(transfer).not.toContainText("USD 0,00")
            await expect(mixed).toContainText("CRC")
            await expect(mixed).toContainText("USD")
            const axe = await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
            expect(
              axe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
            ).toEqual([])
            await page.evaluate(() => window.scrollTo(0, 0))
            await page.screenshot({
              path: info.outputPath(`history-${width}-${theme}-${scale}-${font}-${density}.png`),
            })
          })

test("a batch of 50 preserves applied filters, density, page and scroll when opening full detail", async ({
  page,
}) => {
  const state = await fixture(page)
  await page.goto("/transactions")
  await expect(rows(page)).toHaveCount(10)
  await page.getByRole("button", { name: "Filtros", exact: true }).click()
  await page.locator("#filter-keyword").fill("lote")
  await page.getByRole("button", { name: "Buscar", exact: true }).click()
  await expect(status(page)).toContainText("1–10 de 60")
  await page.getByRole("button", { name: "Filtros", exact: true }).click()
  await choose(page, "Movimientos por página", "50")
  await expect(rows(page)).toHaveCount(50)
  await expect(status(page)).toHaveAttribute("aria-live", "polite")
  await expect(status(page)).toContainText("1–50 de 60")
  const trigger = page.getByRole("button", { name: "Ver detalle del movimiento 50", exact: true })
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  const scroll = await page.evaluate(() => window.scrollY),
    reads = state.reads.length
  const dialog = page.getByRole("dialog", { name: "Detalle del movimiento", exact: true })
  await expect(dialog.getByText(`${description} · #50`, { exact: true })).toHaveText(
    `${description} · #50`,
  )
  await page.keyboard.press("Escape")
  await expect(trigger).toBeFocused()
  expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(scroll, 0)
  expect(state.reads).toHaveLength(reads)
  await expect(page.getByRole("region", { name: "Filtros aplicados" })).toContainText('"lote"')
  await page.getByRole("button", { name: "Página siguiente", exact: true }).click()
  await expect(status(page)).toContainText("51–60 de 60")
  await expect(rows(page)).toHaveCount(10)
  expect(state.reads.at(-1)).toContain("q=lote")
  expect(state.reads.at(-1)).toContain("page=2")
  expect(state.reads.at(-1)).toContain("pageSize=50")
  await choose(page, "Movimientos por página", "25")
  await expect(status(page)).toContainText("1–25 de 60")
  await expect(rows(page)).toHaveCount(25)
  expect(state.reads.at(-1)).toContain("page=1")
})

test("applied filters use Spanish labels and can be removed independently", async ({ page }) => {
  await fixture(page)
  await page.goto("/transactions")
  await expect(rows(page)).toHaveCount(10)
  await page.getByRole("button", { name: "Filtros", exact: true }).click()
  await choose(page, "Tipo", "Gasto")
  await page.getByRole("button", { name: "Buscar", exact: true }).click()
  await expect(page.getByRole("region", { name: "Filtros aplicados" })).toContainText("Tipo: Gasto")
  await expect(page.getByRole("region", { name: "Filtros aplicados" })).not.toContainText("EXPENSE")
  await page.getByRole("button", { name: "Quitar filtro Tipo: Gasto", exact: true }).click()
  await expect(status(page)).toContainText("de 60 movimientos")
  await expect(page.getByRole("region", { name: "Filtros aplicados" })).toHaveCount(0)
})

test("confirmed empty results have one useful exit and clear the applied search", async ({
  page,
}) => {
  await fixture(page)
  await page.goto("/transactions")
  await expect(rows(page)).toHaveCount(10)
  await page.getByRole("button", { name: "Filtros", exact: true }).click()
  await page.locator("#filter-keyword").fill("nadie")
  await page.getByRole("button", { name: "Buscar", exact: true }).click()
  await expect(
    page.getByText("Ningún movimiento coincide con los filtros", { exact: true }),
  ).toHaveCount(1)
  await expect(rows(page)).toHaveCount(0)
  await expect(status(page)).toContainText("Sin movimientos")
  await page.getByRole("button", { name: "Quitar filtros", exact: true }).first().click()
  await expect(rows(page)).toHaveCount(10)
})

for (const mode of ["error", "malformed"] as const)
  test(`history ${mode}: no stale or fictitious zero result`, async ({ page }) => {
    const state = await fixture(page, mode)
    await page.goto("/transactions")
    await expect(page.getByRole("region", { name: "Contexto del historial" })).toContainText(
      "Sin confirmar",
    )
    await expect(rows(page)).toHaveCount(0)
    await expect(
      page.getByText("Ningún movimiento coincide con los filtros", { exact: true }),
    ).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Volver a intentar", exact: true })).toBeVisible()
    if (mode === "error") {
      await page.getByRole("button", { name: "Volver a intentar", exact: true }).click()
      await expect(rows(page)).toHaveCount(10)
      expect(state.reads).toHaveLength(2)
    }
  })

test("late responses cannot replace a newer filter result", async ({ page }) => {
  const state = await fixture(page, "slow")
  await page.goto("/transactions")
  await expect(rows(page)).toHaveCount(10)
  await page.getByRole("button", { name: "Página siguiente", exact: true }).click()
  await expect(status(page)).toContainText("Cargando página 2")
  await expect(rows(page)).toHaveCount(0)
  await page.getByRole("button", { name: "Filtros", exact: true }).click()
  await page.locator("#filter-keyword").fill("nadie")
  await page.getByRole("button", { name: "Buscar", exact: true }).click()
  await expect(status(page)).toContainText("Sin movimientos")
  state.release()
  await expect(rows(page)).toHaveCount(0)
  await expect(page.getByRole("region", { name: "Filtros aplicados" })).toContainText('"nadie"')
})

test("invalid ranges stay editable and never request misleading results", async ({ page }) => {
  const state = await fixture(page)
  await page.goto("/transactions")
  await expect(rows(page)).toHaveCount(10)
  await page.getByRole("button", { name: "Filtros", exact: true }).click()
  await page.locator("#filter-date-from").fill("2026-11-03")
  await page.locator("#filter-date-to").fill("2026-11-01")
  const reads = state.reads.length
  await page.getByRole("button", { name: "Buscar", exact: true }).click()
  await expect(page.locator("#history-filter-error")).toContainText("La fecha Desde")
  await expect(page.locator("#filter-date-from")).toBeFocused()
  expect(state.reads).toHaveLength(reads)
  await page.locator("#filter-date-from").fill("")
  await page.locator("#filter-date-to").fill("")
  await page.locator("#filter-amount-min").fill("-1")
  await page.locator("#filter-amount-max").fill("-10")
  await page.getByRole("button", { name: "Buscar", exact: true }).click()
  await expect(page.locator("#history-filter-error")).toContainText("El importe mínimo")
  expect(state.reads).toHaveLength(reads)
})

test("missing account currency stays unknown rather than becoming CRC", async ({ page }) => {
  await fixture(page, "unknown")
  await page.goto("/transactions")
  await expect(rows(page)).toHaveCount(10)
  await expect(rows(page).first()).toContainText("Importe por confirmar")
  await expect(rows(page).first()).not.toContainText("CRC")
})

test("failed envelope filters retry only on request and preserve the draft", async ({ page }) => {
  const state = await fixture(page, "envelope-error")
  await page.goto("/transactions")
  await expect(rows(page)).toHaveCount(10)
  await page.getByRole("button", { name: "Filtros", exact: true }).click()
  await choose(page, "Cuenta", "Cuenta de viajes de largo plazo")
  await expect(
    page.getByRole("button", { name: "Volver a cargar sobres", exact: true }),
  ).toBeVisible()
  await page.locator("#filter-keyword").fill("borrador conservado")
  expect(state.envelopeReads).toBe(1)
  await page.getByRole("button", { name: "Volver a cargar sobres", exact: true }).click()
  await choose(page, "Sobre", "Reserva")
  expect(state.envelopeReads).toBe(2)
  await expect(page.locator("#filter-keyword")).toHaveValue("borrador conservado")
})

test("comfortable desktop rows provide more space without changing data or requesting it again", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const state = await fixture(page)
  await page.goto("/transactions")
  await expect(rows(page)).toHaveCount(10)
  const height = (await rows(page).first().boundingBox())!.height,
    reads = state.reads.length
  await page.getByRole("button", { name: "Cómoda", exact: true }).click()
  expect((await rows(page).first().boundingBox())!.height).toBeGreaterThan(height)
  expect(state.reads).toHaveLength(reads)
  await expect(rows(page)).toHaveCount(10)
})

test("a page removed from the result set recovers to the last available page", async ({ page }) => {
  const state = await fixture(page, "shrinking")
  await page.goto("/transactions")
  await expect(rows(page)).toHaveCount(10)
  await page.getByRole("button", { name: "Página siguiente", exact: true }).click()
  await expect(status(page)).toContainText("Mostrando 1–5 de 5 movimientos. Página 1 de 1.")
  await expect(rows(page)).toHaveCount(5)
  expect(state.reads.at(-1)).toContain("page=1")
})

test("keyboard paging retains an accessible focus target in pagination", async ({ page }) => {
  await fixture(page)
  await page.goto("/transactions")
  await expect(rows(page)).toHaveCount(10)
  const pagination = page.getByRole("navigation", { name: "Paginación de movimientos" })
  const next = pagination.getByRole("button", { name: "Página siguiente", exact: true })
  await next.focus()
  await next.press("Enter")
  await expect(status(page)).toContainText("11–20 de 60")
  expect(await pagination.evaluate((element) => element.contains(document.activeElement))).toBe(
    true,
  )
  await choose(page, "Movimientos por página", "50")
  await expect(status(page)).toContainText("1–50 de 60")
  expect(await pagination.evaluate((element) => element.contains(document.activeElement))).toBe(
    true,
  )
  await pagination.getByRole("button", { name: "Última página", exact: true }).click()
  await expect(status(page)).toContainText("51–60 de 60")
  expect(await pagination.evaluate((element) => element.contains(document.activeElement))).toBe(
    true,
  )
  await pagination.getByRole("button", { name: "Primera página", exact: true }).click()
  await expect(status(page)).toContainText("1–50 de 60")
  expect(await pagination.evaluate((element) => element.contains(document.activeElement))).toBe(
    true,
  )
})
