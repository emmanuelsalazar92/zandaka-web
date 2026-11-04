import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import type { ReconciliationRecord } from "@/lib/reconciliation-api"

import { installSyntheticAPI } from "./fixtures"

const note =
  "Comprobación guardada de la cuenta familiar.\n" + "ReferenciaContableSinEspacios".repeat(10)
function record(
  accountId: number,
  id = accountId * 10 + 1,
  status: ReconciliationRecord["status"] = "BALANCED",
): ReconciliationRecord {
  const countedTotal = accountId === 2 ? 40.3 : 99.3,
    expectedTotal = accountId === 2 ? 41.3 : 100.3
  return {
    id,
    accountId,
    currency: "USD",
    date: "2026-11-01",
    countMethod: accountId === 2 ? "DENOMINATION_COUNT" : "MANUAL_TOTAL",
    countedTotal,
    expectedTotal,
    realBalance: countedTotal,
    calculatedBalance: expectedTotal,
    difference: -1,
    status,
    isActive: status === "OPEN" ? 1 : 0,
    note,
    notes: note,
    createdAt: "2026-11-01 18:00:00",
    updatedAt: "2026-11-03 01:00:00",
    closedAt: status === "OPEN" ? null : "2026-11-03 01:00:00",
    lines:
      accountId === 2
        ? [
            {
              id: id * 10,
              reconciliationId: id,
              denominationId: null,
              denominationValue: 20,
              denominationType: "BILL",
              denominationLabel: "Billete original conservado",
              quantity: 2,
              lineTotal: 40,
              sortOrder: 1,
              createdAt: null,
              updatedAt: null,
            },
            {
              id: id * 10 + 1,
              reconciliationId: id,
              denominationId: 2,
              denominationValue: 0.1,
              denominationType: "COIN",
              denominationLabel: "Moneda original",
              quantity: 3,
              lineTotal: 0.3,
              sortOrder: 2,
              createdAt: null,
              updatedAt: null,
            },
          ]
        : [],
  }
}
type Mode =
  | "success"
  | "open"
  | "lost"
  | "malformed"
  | "rejected"
  | "slow-save"
  | "preview-error"
  | "malformed-preview"
  | "slow-date"
  | "slow-history"
  | "slow-detail"
  | "catalog-error"
  | "slow-ignore"
async function fixture(page: Page, mode: Mode = "success") {
  await installSyntheticAPI(page)
  const creates: Record<string, unknown>[] = [],
    ignores: number[] = [],
    historyQueries: string[] = [],
    previewDates: string[] = []
  let release: () => void = () => {},
    catalogCalls = 0
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const records: Record<number, ReconciliationRecord[]> = {
    1: [record(1), { ...record(1, 12, "IGNORED"), date: "2026-10-30" }],
    2: [record(2), { ...record(2, 22, "IGNORED"), date: "2026-10-30" }],
  }
  if (mode === "open" || mode === "slow-ignore")
    for (const id of [1, 2])
      records[id].unshift({ ...record(id, id * 10 + 3, "OPEN"), date: "2026-11-03" })
  const denominations = [
    {
      id: 1,
      userId: 1,
      currency: "USD",
      value: 20,
      type: "BILL",
      label: "Billete de veinte",
      sortOrder: 1,
      isActive: true,
    },
    {
      id: 2,
      userId: 1,
      currency: "USD",
      value: 0.1,
      type: "COIN",
      label: "Moneda de diez centavos",
      sortOrder: 2,
      isActive: true,
    },
  ]
  await page.route("**/api/accounts", (route) =>
    route.fulfill({
      json: [
        {
          id: 1,
          name: "Banco familiar para proyectos de largo plazo",
          currency: "USD",
          is_active: 1,
          type: "BANK",
          institution: "Banco Horizonte",
        },
        {
          id: 2,
          name: "Caja familiar de efectivo",
          currency: "USD",
          is_active: 1,
          type: "CASH",
          institution: "Efectivo",
        },
      ],
    }),
  )
  await page.route(/\/api\/accounts\/\d+\/reconciliations\/active$/, (route) => {
    const id = Number(new URL(route.request().url()).pathname.split("/")[3]),
      active = records[id].find((row) => row.isActive === 1)
    return active
      ? route.fulfill({ json: active })
      : route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND" } } })
  })
  await page.route("**/api/reconciliations?**", async (route) => {
    const id = Number(new URL(route.request().url()).searchParams.get("account_id"))
    if (mode === "slow-history" && id === 2) await gate
    return route.fulfill({ json: records[id] })
  })
  await page.route(/\/api\/reconciliations\/accounts\/\d+\/expected-total\?/, async (route) => {
    const url = new URL(route.request().url()),
      id = Number(url.pathname.split("/")[4]),
      date = url.searchParams.get("date")!
    previewDates.push(date)
    if (mode === "preview-error" && previewDates.length === 1)
      return route.fulfill({
        status: 503,
        json: { error: { message: "private database internals" } },
      })
    if (mode === "slow-date" && date === "2026-11-01") await gate
    return route.fulfill({
      json: {
        accountId: mode === "malformed-preview" ? 999 : id,
        currency: "USD",
        date,
        expectedTotal: mode === "slow-date" && date === "2026-11-02" ? 777 : 100.3,
      },
    })
  })
  await page.route(/\/api\/reconciliations\/accounts\/\d+\/denominations$/, (route) => {
    catalogCalls++
    if (mode === "catalog-error" && catalogCalls === 1)
      return route.fulfill({ status: 503, json: {} })
    const accountId = Number(new URL(route.request().url()).pathname.split("/")[4])
    return route.fulfill({
      json: { accountId, currency: "USD", countMethod: "DENOMINATION_COUNT", denominations },
    })
  })
  await page.route(/\/api\/reconciliations\/\d+$/, async (route) => {
    const id = Number(new URL(route.request().url()).pathname.split("/").at(-1))
    if (mode === "slow-detail" && id === 11) await gate
    const saved = Object.values(records)
      .flat()
      .find((row) => row.id === id)
    return saved
      ? route.fulfill({ json: saved })
      : route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND" } } })
  })
  await page.route("**/api/reconciliations", async (route) => {
    expect(route.request().method()).toBe("POST")
    const body = route.request().postDataJSON() as {
      accountId: number
      date: string
      countMethod: "MANUAL_TOTAL" | "DENOMINATION_COUNT"
      realBalance?: number
      lines?: Array<{ denominationId: number; quantity: number }>
      note?: string
      notes?: string
    }
    creates.push(body)
    if (mode === "rejected")
      return route.fulfill({
        status: 409,
        json: { error: { code: "CONFLICT", message: "private state" } },
      })
    const countedTotal = body.countMethod === "DENOMINATION_COUNT" ? 100.3 : body.realBalance!,
      difference = countedTotal === 100.3 ? 0 : 0.01
    const saved: ReconciliationRecord = {
      ...record(body.accountId, 900),
      date: body.date,
      countMethod: body.countMethod,
      countedTotal,
      realBalance: countedTotal,
      expectedTotal: 100.3,
      calculatedBalance: 100.3,
      difference,
      status: difference === 0 ? "BALANCED" : "OPEN",
      isActive: difference === 0 ? 0 : 1,
      closedAt: difference === 0 ? "2026-11-04 01:00:00" : null,
      note: body.note ?? body.notes ?? null,
      lines:
        body.countMethod === "DENOMINATION_COUNT"
          ? (body.lines ?? []).map((line, i) => ({
              id: 9000 + i,
              reconciliationId: 900,
              denominationId: line.denominationId,
              denominationValue: line.denominationId === 1 ? 20 : 0.1,
              denominationType: line.denominationId === 1 ? "BILL" : "COIN",
              denominationLabel:
                line.denominationId === 1 ? "Billete de veinte" : "Moneda de diez centavos",
              quantity: line.quantity,
              lineTotal: line.denominationId === 1 ? 100 : 0.3,
              sortOrder: i,
              createdAt: null,
              updatedAt: null,
            }))
          : [],
    }
    records[body.accountId].unshift(saved)
    if (mode === "slow-save") await gate
    if (mode === "lost") return route.abort("failed")
    return route.fulfill({ status: 201, json: mode === "malformed" ? {} : saved })
  })
  await page.route(/\/api\/reconciliations\/\d+\/ignore$/, async (route) => {
    expect(route.request().method()).toBe("POST")
    const id = Number(new URL(route.request().url()).pathname.split("/").at(-2))
    ignores.push(id)
    if (mode === "slow-ignore") await gate
    const saved = Object.values(records)
      .flat()
      .find((row) => row.id === id)!
    saved.status = "IGNORED"
    saved.isActive = 0
    saved.closedAt = "2026-11-04 01:00:00"
    return route.fulfill({ json: saved })
  })
  await page.route("**/api/transactions?**", (route) => {
    const url = new URL(route.request().url())
    historyQueries.push(url.search)
    return route.fulfill({
      json: {
        data: [],
        meta: {
          page: Number(url.searchParams.get("page")),
          pageSize: Number(url.searchParams.get("pageSize")),
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      },
    })
  })
  return {
    creates,
    ignores,
    historyQueries,
    previewDates,
    records,
    release,
    get catalogCalls() {
      return catalogCalls
    },
  }
}
async function account(page: Page, cash = false) {
  await page.goto("/reconciliation")
  await expect(page.getByTestId("reconciliation-row")).toHaveCount(2)
  if (cash) {
    await page.getByRole("button", { name: "Cuenta a conciliar", exact: true }).click()
    await page
      .getByRole("combobox", { name: "Buscar cuenta a conciliar", exact: true })
      .fill("Caja")
    await page.getByRole("option").click()
    await expect(page.getByRole("region", { name: "Resumen de conciliación" })).toContainText(
      "Caja familiar",
    )
  }
}
const dialog = (page: Page, name = "Nueva conciliación") =>
  page.getByRole("dialog", { name, exact: true })
async function cashValues(page: Page) {
  await page.getByLabel("Cantidad de Billete de veinte", { exact: true }).fill("5")
  await page.getByLabel("Cantidad de Moneda de diez centavos", { exact: true }).fill("3")
}

for (const view of ["list", "cash", "detail"])
  for (const width of [360, 390, 1440])
    for (const theme of ["light", "dark"] as const)
      for (const scale of [100, 200])
        for (const font of width === 360 && scale === 200
          ? ["system", "Arial", "Verdana"]
          : ["system"])
          test(`reconciliation ${view} ${width}px ${theme} ${scale}% ${font}`, async ({
            page,
          }, info) => {
            await page.setViewportSize({ width, height: 1000 })
            await page.emulateMedia({ colorScheme: theme })
            await fixture(page)
            await account(page, view !== "list")
            let target = page.locator("main#main-content")
            if (view === "cash") {
              await page.getByRole("button", { name: "Nueva conciliación", exact: true }).click()
              target = dialog(page)
              await cashValues(page)
              await expect(
                target.getByRole("button", { name: "Crear conciliación", exact: true }),
              ).toBeEnabled()
            }
            if (view === "detail") {
              await page
                .getByRole("button", { name: "Ver detalle de conciliación 21", exact: true })
                .click()
              target = dialog(page, "Detalle de conciliación")
              await expect(target).toContainText("Billete original conservado")
              await expect(target).toContainText("dato histórico")
              await expect(
                target.getByRole("button", { name: "Ignorar conciliación", exact: true }),
              ).toHaveCount(0)
            }
            await page.evaluate(
              ({ scale, font }) => {
                document.documentElement.style.fontSize = `${scale}%`
                if (font !== "system") document.body.style.fontFamily = `"${font}",sans-serif`
              },
              { scale, font },
            )
            const geometry = () =>
              target.evaluate((root) => {
                const box = root.getBoundingClientRect(),
                  errors: string[] = []
                for (const el of [
                  root,
                  ...root.querySelectorAll<HTMLElement>(
                    "section,li,p,dt,dd,h1,h2,h3,label,button,input,textarea",
                  ),
                ]) {
                  const r = el.getBoundingClientRect(),
                    editable = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
                  if (
                    r.width &&
                    (r.left < Math.max(0, box.left) - 1 ||
                      r.right > Math.min(innerWidth, box.right) + 1 ||
                      (!editable && el.scrollWidth > el.clientWidth + 1))
                  )
                    errors.push(
                      `${el.tagName}:${el.textContent?.slice(0, 40)} ${r.left}/${r.right} ${el.scrollWidth}/${el.clientWidth}`,
                    )
                }
                return errors
              })
            await expect.poll(geometry).toEqual([])
            const axe = await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
            expect(
              axe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
            ).toEqual([])
            if (view === "list") {
              await page.evaluate(() => window.scrollTo(0, 0))
              await page.screenshot({
                path: info.outputPath(
                  `reconciliation-${view}-${width}-${theme}-${scale}-${font}.png`,
                ),
              })
            } else {
              await target.evaluate((root) => {
                root.scrollTop = 0
              })
              await target.screenshot({
                path: info.outputPath(
                  `reconciliation-${view}-${width}-${theme}-${scale}-${font}.png`,
                ),
              })
              await page.keyboard.press("Escape")
              await expect(target).toHaveCount(0)
            }
          })

test("manual cents preserve the posted amount and create an open review without adjustments", async ({
  page,
}) => {
  const state = await fixture(page)
  await account(page)
  await page.getByRole("button", { name: "Nueva conciliación", exact: true }).click()
  const form = dialog(page)
  await expect(form.getByRole("heading", { name: "Nueva conciliación", exact: true })).toBeFocused()
  await page.getByLabel("Total contado en USD", { exact: true }).fill("100.31")
  await form.getByRole("button", { name: "Crear conciliación", exact: true }).click()
  await expect(form).toHaveCount(0)
  expect(state.creates).toHaveLength(1)
  expect(state.creates[0]).toMatchObject({
    accountId: 1,
    countMethod: "MANUAL_TOTAL",
    date: "2026-11-03",
    realBalance: 100.31,
  })
  await expect(page.getByText("Conciliación registrada", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Nueva conciliación", exact: true })).toBeDisabled()
})

test("cash subtotals and quantities survive posting and a balanced result is closed", async ({
  page,
}) => {
  const state = await fixture(page)
  await account(page, true)
  await page.getByRole("button", { name: "Nueva conciliación", exact: true }).click()
  await cashValues(page)
  await expect(page.getByTestId("subtotal-2")).toContainText("0,30")
  await expect(page.getByTestId("denomination-counted-total")).toContainText("100,30")
  await dialog(page).getByRole("button", { name: "Crear conciliación", exact: true }).click()
  await expect(dialog(page)).toHaveCount(0)
  expect(state.creates[0]).toMatchObject({
    accountId: 2,
    countMethod: "DENOMINATION_COUNT",
    lines: [
      { denominationId: 1, quantity: 5 },
      { denominationId: 2, quantity: 3 },
    ],
  })
  expect(state.creates[0]).not.toHaveProperty("realBalance")
  await expect(page.getByRole("region", { name: "Resumen de conciliación" })).toContainText(
    "Conciliada",
  )
})

test("closed historical difference, cutoff, timestamp and snapshots remain explicit and read only", async ({
  page,
}) => {
  await fixture(page)
  await account(page, true)
  const trigger = page.getByRole("button", { name: "Ver detalle de conciliación 21", exact: true })
  await trigger.focus()
  await trigger.press("Enter")
  const detail = dialog(page, "Detalle de conciliación")
  await expect(detail).toContainText("01/11/2026")
  await expect(detail).toContainText("2 nov 2026")
  await expect(detail).toContainText("no es un problema abierto")
  await expect(detail).toContainText("Billete original conservado")
  await expect(detail).toContainText("Subtotal guardado")
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab")
    expect(await detail.evaluate((root) => root.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press("Escape")
  await expect(trigger).toBeFocused()
})

test("ignore requires confirmation and closes the review without correcting historical amounts", async ({
  page,
}) => {
  const state = await fixture(page, "open")
  await page.goto("/reconciliation")
  await expect(page.getByRole("button", { name: "Nueva conciliación", exact: true })).toBeDisabled()
  await page.getByRole("button", { name: "Revisar conciliación abierta", exact: true }).click()
  const detail = dialog(page, "Detalle de conciliación")
  await detail.getByRole("button", { name: "Ignorar conciliación", exact: true }).click()
  await expect(detail.getByRole("group", { name: "Confirmar cierre sin resolver" })).toContainText(
    "No cambia los saldos",
  )
  expect(state.ignores).toHaveLength(0)
  await detail.getByRole("button", { name: "Confirmar ignorar", exact: true }).click()
  await expect(detail).toContainText("Se cerró sin resolver")
  expect(state.ignores).toEqual([13])
  expect(state.records[1][0].difference).toBe(-1)
  expect(state.creates).toHaveLength(0)
})

test("investigation opens history with the actual account and inclusive cutoff", async ({
  page,
}) => {
  const state = await fixture(page)
  await account(page, true)
  await page.getByRole("button", { name: "Ver detalle de conciliación 21", exact: true }).click()
  await dialog(page, "Detalle de conciliación")
    .getByRole("link", { name: "Revisar movimientos del corte", exact: true })
    .click()
  await expect(page).toHaveURL(/\/transactions\?accountId=2&to=2026-11-01&source=reconciliation/)
  await expect(page.getByRole("region", { name: "Filtros aplicados" })).toContainText(
    "Hasta: 01/11/2026",
  )
  await expect.poll(() => state.historyQueries.at(-1)).toContain("accountId=2")
  expect(state.historyQueries.at(-1)).toContain("to=2026-11-01")
  expect(state.creates).toHaveLength(0)
})

test("invalid manual and denomination input stays visible and cannot be posted", async ({
  page,
}) => {
  const state = await fixture(page)
  await account(page)
  await page.getByRole("button", { name: "Nueva conciliación", exact: true }).click()
  const input = page.getByLabel("Total contado en USD", { exact: true })
  await input.fill("100.301")
  await expect(
    dialog(page).getByRole("button", { name: "Crear conciliación", exact: true }),
  ).toBeDisabled()
  await input.fill("1e2")
  await expect(input).toHaveValue("1e2")
  await expect(dialog(page).getByRole("region", { name: "Comparación de saldos" })).toContainText(
    "Por confirmar",
  )
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Cuenta a conciliar", exact: true }).click()
  await page.getByRole("combobox", { name: "Buscar cuenta a conciliar", exact: true }).fill("Caja")
  await page.getByRole("option").click()
  await page.getByRole("button", { name: "Nueva conciliación", exact: true }).click()
  const quantity = page.getByLabel("Cantidad de Billete de veinte", { exact: true })
  await quantity.fill("-2")
  await expect(quantity).toHaveValue("-2")
  await expect(quantity).toHaveAttribute("aria-invalid", "true")
  await expect(
    dialog(page).getByRole("button", { name: "Crear conciliación", exact: true }),
  ).toBeDisabled()
  expect(state.creates).toHaveLength(0)
})

for (const mode of ["lost", "malformed"] as const)
  test(`uncertain ${mode} receipt never enables a blind resend`, async ({ page }) => {
    const state = await fixture(page, mode)
    await account(page)
    await page.getByRole("button", { name: "Nueva conciliación", exact: true }).click()
    await page.getByLabel("Total contado en USD", { exact: true }).fill("100.3")
    await dialog(page).getByRole("button", { name: "Crear conciliación", exact: true }).click()
    await expect(dialog(page)).toContainText("Resultado por confirmar")
    await expect(
      dialog(page).getByRole("button", { name: "Crear conciliación", exact: true }),
    ).toHaveCount(0)
    await dialog(page).getByRole("button", { name: "Revisar historial", exact: true }).click()
    await expect(dialog(page)).toHaveCount(0)
    await expect(page.getByText("Resultado por confirmar", { exact: true })).toBeVisible()
    expect(state.creates).toHaveLength(1)
  })

test("a definitive rejection preserves the editable draft", async ({ page }) => {
  const state = await fixture(page, "rejected")
  await account(page)
  await page.getByRole("button", { name: "Nueva conciliación", exact: true }).click()
  const input = page.getByLabel("Total contado en USD", { exact: true })
  await input.fill("100.31")
  await dialog(page).getByRole("button", { name: "Crear conciliación", exact: true }).click()
  await expect(dialog(page)).toContainText("Ya puede existir una conciliación abierta")
  await expect(input).toBeEnabled()
  await expect(input).toHaveValue("100.31")
  expect(state.creates).toHaveLength(1)
})

for (const mode of ["preview-error", "malformed-preview"] as const)
  test(`${mode}: missing preview is not a zero and blocks creation`, async ({ page }) => {
    await fixture(page, mode)
    await account(page)
    await page.getByRole("button", { name: "Nueva conciliación", exact: true }).click()
    await page.getByLabel("Total contado en USD", { exact: true }).fill("100.3")
    await expect(dialog(page)).toContainText("Saldo calculado no disponible")
    await expect(
      dialog(page).getByRole("button", { name: "Crear conciliación", exact: true }),
    ).toBeDisabled()
    if (mode === "preview-error") {
      await dialog(page)
        .getByRole("button", { name: "Volver a consultar el saldo", exact: true })
        .click()
      await expect(
        dialog(page).getByRole("button", { name: "Crear conciliación", exact: true }),
      ).toBeEnabled()
    }
  })

test("late cutoff previews and old-account history cannot replace current context", async ({
  page,
}) => {
  const state = await fixture(page, "slow-date")
  await account(page)
  await page.getByRole("button", { name: "Nueva conciliación", exact: true }).click()
  await page.getByLabel("Fecha de corte", { exact: true }).fill("2026-11-01")
  await page.getByLabel("Fecha de corte", { exact: true }).fill("2026-11-02")
  await page.getByLabel("Total contado en USD", { exact: true }).fill("777")
  await expect(
    dialog(page).getByRole("button", { name: "Crear conciliación", exact: true }),
  ).toBeEnabled()
  state.release()
  await expect(dialog(page).getByRole("region", { name: "Comparación de saldos" })).toContainText(
    "777,00",
  )
})

test("save blocks repeated activation, Escape and dismissal until its confirmed result", async ({
  page,
}) => {
  const state = await fixture(page, "slow-save")
  await account(page)
  await page.getByRole("button", { name: "Nueva conciliación", exact: true }).click()
  await page.getByLabel("Total contado en USD", { exact: true }).fill("100.3")
  const form = dialog(page)
  await form.getByRole("button", { name: "Crear conciliación", exact: true }).click()
  await page.keyboard.press("Escape")
  await expect(form).toBeVisible()
  await expect(form.getByRole("button", { name: "Cerrar", exact: true })).toHaveCount(0)
  await expect(form.getByRole("button", { name: "Cancelar", exact: true })).toBeDisabled()
  expect(state.creates).toHaveLength(1)
  state.release()
  await expect(form).toHaveCount(0)
})

test("catalog failures retry explicitly without changing quantities or sending writes", async ({
  page,
}) => {
  const state = await fixture(page, "catalog-error")
  await account(page, true)
  await page.getByRole("button", { name: "Nueva conciliación", exact: true }).click()
  await expect(
    dialog(page).getByRole("button", { name: "Volver a cargar denominaciones", exact: true }),
  ).toBeVisible()
  expect(state.catalogCalls).toBe(1)
  await dialog(page)
    .getByRole("button", { name: "Volver a cargar denominaciones", exact: true })
    .click()
  await cashValues(page)
  expect(state.catalogCalls).toBe(2)
  expect(state.creates).toHaveLength(0)
})

test("history from a previous account and detail from a closed dialog stay cancelled", async ({
  page,
}) => {
  const state = await fixture(page, "slow-history")
  await account(page)
  await page.getByRole("button", { name: "Cuenta a conciliar", exact: true }).click()
  await page.getByRole("combobox", { name: "Buscar cuenta a conciliar", exact: true }).fill("Caja")
  await page.getByRole("option").click()
  await page.getByRole("button", { name: "Cuenta a conciliar", exact: true }).click()
  await page.getByRole("combobox", { name: "Buscar cuenta a conciliar", exact: true }).fill("Banco")
  await page.getByRole("option").click()
  state.release()
  await expect(
    page.getByRole("button", { name: "Ver detalle de conciliación 11", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Ver detalle de conciliación 21", exact: true }),
  ).toHaveCount(0)
})
