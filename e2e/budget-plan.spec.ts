import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { calculateBudgetPlan } from "../lib/budget-plan"
import { formatPlanMoney } from "../lib/budget-plan-view"
import { exampleSavedPlan, planId, planOptions } from "../tests/fixtures/budget-plan"

import { installSyntheticAPI } from "./fixtures"

import type { MonthStart } from "../lib/budget-month-start"
import type { BudgetPlanDocument } from "../lib/budget-plan"
import type { FundingPreview } from "../lib/budget-plan-api"

test.beforeEach(async ({ page }) => {
  // Localhost is a secure context; reproduce the capability of the real LAN HTTP origin.
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true })
  })
})

type Mode =
  | "success"
  | "new"
  | "lost-save"
  | "lost-fund"
  | "malformed-fund"
  | "rejected-fund"
  | "missing-setup"
async function fixture(
  page: Page,
  mode: Mode = "success",
  initial = exampleSavedPlan(),
  options = planOptions,
) {
  await installSyntheticAPI(page)
  let current = initial,
    saveCount = 0,
    fundCount = 0,
    posted = 0
  const bodies: unknown[] = []
  const preview = (): FundingPreview => {
    const values = calculateBudgetPlan(current.document)
    const transfers = values.lines.map((line) => {
      const original = current.document.lines.find((l) => l.id === line.id)!
      const target = options.envelopes.find((e) => e.id === original.targetEnvelopeId)!
      const source = options.envelopes.find(
        (e) =>
          e.id ===
          current.document.sources.find((s) => s.accountId === target.accountId)?.envelopeId,
      )!
      return {
        lineId: line.id,
        name: original.name,
        amount: line.payAmount,
        currency: line.payCurrency,
        source,
        target,
      }
    })
    return {
      transfers,
      sources: [...new Set(transfers.map((t) => t.source.id))].map((id) => ({
        ...transfers.find((t) => t.source.id === id)!.source,
        required: String(
          transfers.filter((t) => t.source.id === id).reduce((n, t) => n + Number(t.amount), 0),
        ),
        sufficient: true,
      })),
    }
  }
  await page.route("**/api/budget-plans**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace("/api/budget-plans", "")
    if (mode === "missing-setup")
      return route.fulfill({
        status: 503,
        json: { error: { code: "FEATURE_NOT_READY", message: "private server path" } },
      })
    if (req.method() === "GET") {
      if (path === "/options") return route.fulfill({ json: options })
      if (path === "")
        return route.fulfill({
          json: { items: [current], page: 1, pageSize: 20, total: 1, totalPages: 1 },
        })
      if (path.endsWith("/funding-preview")) return route.fulfill({ json: preview() })
      if (path.endsWith("/previous-assignments"))
        return route.fulfill({
          json: {
            document: {
              ...current.document,
              lines: current.document.lines.map((l) => ({
                ...l,
                id: crypto.randomUUID(),
                name: `Anterior ${l.name}`,
              })),
            },
          },
        })
      if (path === `/${current.id}` && !(mode === "new" && saveCount === 0))
        return route.fulfill({ json: current })
      return route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND" } } })
    }
    const body = req.postDataJSON()
    bodies.push(body)
    if (req.method() === "PUT") {
      saveCount++
      if (mode === "new" && saveCount === 1 && body.expectedRevision === 0) {
        current = {
          ...current,
          id: path.slice(1),
          document: body.document,
          revision: 1,
          calculation: calculateBudgetPlan(body.document),
        }
        return route.fulfill({ json: current })
      }
      if (body.expectedRevision !== current.revision)
        return route.fulfill({ status: 409, json: { error: { code: "CONFLICT" } } })
      current = {
        ...current,
        document: body.document as BudgetPlanDocument,
        revision: current.revision + 1,
        calculation: calculateBudgetPlan(body.document as BudgetPlanDocument),
      }
      if (mode === "lost-save" && saveCount === 1) return route.abort("failed")
      return route.fulfill({ json: current })
    }
    if (path.endsWith("/finalize")) {
      current = { ...current, status: "finalized", revision: current.revision + 1 }
      return route.fulfill({ json: current })
    }
    if (path.endsWith("/reopen")) {
      current = { ...current, status: "draft", revision: current.revision + 1 }
      return route.fulfill({ json: current })
    }
    if (path.endsWith("/fund")) {
      fundCount++
      if (mode === "rejected-fund")
        return route.fulfill({ status: 409, json: { error: { code: "CONFLICT" } } })
      if (current.status !== "funded") {
        const values = preview()
        posted++
        current = {
          ...current,
          status: "funded",
          revision: current.revision + 1,
          receipt: {
            requestId: body.requestId,
            revision: body.revision,
            date: body.date,
            postedAt: "2026-11-03T18:00:00Z",
            transactions: values.transfers.map((t, index) => ({
              lineId: t.lineId,
              transactionId: 100 + index,
              amount: t.amount,
              currency: t.currency,
              sourceEnvelopeId: t.source.id,
              targetEnvelopeId: t.target.id,
              accountId: t.target.accountId,
            })),
          },
        }
      }
      if (mode === "lost-fund" && fundCount === 1) return route.abort("failed")
      if (mode === "malformed-fund" && fundCount === 1)
        return route.fulfill({
          json: {
            ...current,
            receipt: {
              ...current.receipt!,
              transactions: current.receipt!.transactions.map((transaction, index) =>
                index === 0 ? { ...transaction, lineId: crypto.randomUUID() } : transaction,
              ),
            },
          },
        })
      return route.fulfill({ json: current })
    }
    throw new Error(`Unexpected budget fixture write: ${req.method()} ${path}`)
  })
  return {
    get saved() {
      return current
    },
    get saves() {
      return saveCount
    },
    get funds() {
      return fundCount
    },
    get posted() {
      return posted
    },
    bodies,
  }
}
async function open(page: Page) {
  await page.goto(`/budgets/plans/${planId}`)
  await expect(page.getByRole("heading", { name: "Tu distribución", exact: true })).toBeVisible()
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`budget list uses the shared panel ${colorScheme}`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme })
    await fixture(page)
    const panel = page.getByRole("main").locator(".marea-surface").first()
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto("/reconciliation")
      await expect(page.getByRole("heading", { name: "Conciliación", exact: true })).toBeVisible()
      const reference = (await panel.boundingBox())!
      await page.goto("/budgets")
      const row = panel.getByRole("link", { name: /noviembre de 2026/i })
      await expect(row).toBeVisible()
      await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${colorScheme}\\b`))
      await page.screenshot({ path: info.outputPath(`presupuestos-${width}.png`) })
      const list = (await panel.boundingBox())!
      expect(list.x).toBe(reference.x)
      expect(list.width).toBe(reference.width)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
      expect
        .soft(await panel.evaluate((element) => getComputedStyle(element).backgroundColor))
        .not.toBe("rgba(0, 0, 0, 0)")
      await expect(panel.getByRole("link", { name: "Nuevo presupuesto" })).toHaveAttribute(
        "href",
        "/budgets/plans/new",
      )
      await expect(
        panel.getByRole("link", { name: "Consultar presupuestos anteriores" }),
      ).toHaveAttribute("href", "/budgets/legacy")
      await expect(panel.getByRole("link", { name: "Gestionar categorías" })).toBeVisible()
      await expect(panel.getByRole("button", { name: "Actualizar" })).toBeEnabled()
      await expect(panel.getByText("Página 1 de 1")).toBeVisible()
      await row.click()
      await expect(
        page.getByRole("heading", { name: "Tu distribución", exact: true }),
      ).toBeVisible()
    }
  })
}
async function prepared(page: Page) {
  await page.getByRole("tab", { name: "Revisar sobres", exact: true }).click()
  await page.getByRole("button", { name: "Verificar fondos guardados", exact: true }).click()
  await expect(
    page.getByText("Fondos disponibles para las asignaciones", { exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Preparar presupuesto", exact: true }).click()
  await expect(page.getByRole("button", { name: "Volver a borrador", exact: true })).toBeVisible()
}
async function apply(page: Page) {
  await page.getByRole("button", { name: "Verificar fondos guardados", exact: true }).click()
  await page.getByRole("button", { name: "Asignar a sobres", exact: true }).click()
  await page.getByRole("button", { name: "Confirmar asignación", exact: true }).click()
}

for (const width of [360, 390, 1440])
  for (const theme of ["light", "dark"] as const)
    for (const scale of [100, 200])
      for (const font of width === 360 && scale === 200
        ? ["system", "Arial", "Verdana"]
        : ["system"])
        test(`budget plan ${width}px ${theme} ${scale}% ${font} readable and accessible`, async ({
          page,
        }, info) => {
          await page.setViewportSize({ width, height: 1000 })
          await page.emulateMedia({ colorScheme: theme })
          await fixture(page)
          await open(page)
          await page.evaluate((size) => {
            document.documentElement.style.fontSize = `${size}%`
          }, scale)
          if (font !== "system")
            await page.evaluate((value) => {
              document.body.style.fontFamily = value
            }, font)
          await expect(
            page.getByRole("button", { name: "Editar Personal", exact: true }),
          ).toBeVisible()
          await expect
            .poll(() =>
              page.locator("main#main-content").evaluate((root) => {
                const bounds = root.getBoundingClientRect()
                return [...root.querySelectorAll<HTMLElement>("section,div,p,strong,button,small")]
                  .filter(
                    (node) =>
                      node.getClientRects().length &&
                      (node.getBoundingClientRect().right > bounds.right + 1 ||
                        node.scrollWidth > node.clientWidth + 1),
                  )
                  .slice(0, 12)
                  .map((node) => ({
                    tag: node.tagName,
                    class: node.className,
                    scroll: node.scrollWidth,
                    width: node.clientWidth,
                    text: node.textContent?.slice(0, 45),
                  }))
              }),
            )
            .toEqual([])
          const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
          expect(
            results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
          ).toEqual([])
          await page
            .locator("main#main-content")
            .screenshot({ path: info.outputPath(`budget-${width}-${theme}-${scale}.png`) })
          await page.getByRole("button", { name: "Editar Personal", exact: true }).click()
          await expect(page.getByLabel("Moneda de origen", { exact: true })).toBeDisabled()
          await expect(page.getByRole("dialog")).toContainText("La asignación nace en USD")
          const editorA11y = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
          expect(
            editorA11y.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
          ).toEqual([])
          await page.getByRole("button", { name: "Cancelar", exact: true }).click()
          for (const name of ["Ingreso", "Tipo de cambio", "Revisar sobres"]) {
            await page.getByRole("tab", { name, exact: true }).click()
            const overflow = await page.locator("main#main-content").evaluate((root) =>
              [...root.querySelectorAll<HTMLElement>("section,div,p,strong,button,small")]
                .filter(
                  (node) => node.getClientRects().length && node.scrollWidth > node.clientWidth + 1,
                )
                .map((node) => ({
                  class: node.className,
                  text: node.textContent?.slice(0, 40),
                  width: node.clientWidth,
                  scroll: node.scrollWidth,
                })),
            )
            expect(overflow, name).toEqual([])
            const a11y = await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
            expect(
              a11y.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
              name,
            ).toEqual([])
          }
        })
test("net income stays independent from deductions and assignment edits persist on explicit save", async ({
  page,
}) => {
  const state = await fixture(page)
  await open(page)
  await page.getByRole("tab", { name: "Ingreso", exact: true }).click()
  await page.getByLabel("Forma de registrar el ingreso", { exact: true }).selectOption("net")
  await page.getByLabel("Ingreso neto disponible · USD", { exact: true }).fill("3000")
  await expect(page.getByLabel("Salario contractual · USD", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Guardar borrador", exact: true }).click()
  await expect(page.getByText("Borrador guardado", { exact: true })).toBeVisible()
  expect(state.saves).toBe(1)
  expect(state.saved.document.income.net).toBe("3000")
  expect(state.posted).toBe(0)
})
test("a new budget starts with already-net income and creates one stable draft", async ({
  page,
}) => {
  const state = await fixture(page, "new")
  await page.goto("/budgets/plans/new")
  await expect(page.getByLabel("Ingreso neto disponible · USD", { exact: true })).toBeVisible()
  await page.getByLabel("Ingreso neto disponible · USD", { exact: true }).fill("3000")
  await page.getByLabel("Mes en que recibiste el ingreso", { exact: true }).fill("2026-05")
  await page.getByRole("button", { name: "Guardar borrador", exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/budgets/plans/${state.saved.id}$`))
  await expect(page.getByText("Borrador guardado", { exact: true })).toBeVisible()
  expect(state.saves).toBe(1)
  expect(state.saved.document.incomeMode).toBe("net")
  expect(state.posted).toBe(0)
})
test("USD percentage, original currency and subscription breakdown remain explicit", async ({
  page,
}) => {
  const state = await fixture(page)
  await open(page)
  await page.getByRole("button", { name: "Editar Personal", exact: true }).click()
  await page.getByLabel("Porcentaje del neto · %", { exact: true }).fill("12")
  await page.getByRole("button", { name: "Actualizar plan", exact: true }).click()
  await page.getByRole("button", { name: "Editar Netflix", exact: true }).click()
  await page.getByText("Ver cálculo y redondeo", { exact: true }).click()
  await expect(page.getByRole("dialog")).toContainText("múltiplo de 50")
  await page.getByRole("button", { name: "Cancelar", exact: true }).click()
  await page.getByRole("button", { name: "Guardar borrador", exact: true }).click()
  await expect(page.getByText("Borrador guardado", { exact: true })).toBeVisible()
  expect(state.saved.document.lines[1].amount).toBe("12")
  expect(state.posted).toBe(0)
})
test("new assignments retain a UUID when randomUUID is unavailable on LAN HTTP", async ({
  page,
}) => {
  const state = await fixture(page)
  await open(page)
  expect(await page.evaluate(() => typeof globalThis.crypto.randomUUID)).toBe("undefined")
  await page.getByRole("button", { name: "Añadir asignación", exact: true }).click()
  await page.getByLabel("Nombre de la asignación", { exact: true }).fill("Extra HTTP")
  await page.getByLabel("Importe original", { exact: true }).fill("1000")
  await page.getByLabel("Sobre de destino", { exact: true }).selectOption("22")
  await page.getByRole("button", { name: "Actualizar plan", exact: true }).click()
  await page.getByRole("button", { name: "Guardar borrador", exact: true }).click()
  await expect(page.getByText("Borrador guardado", { exact: true })).toBeVisible()
  expect(state.saved.document.lines.find((line) => line.name === "Extra HTTP")?.id).toMatch(
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
  )
  expect(state.posted).toBe(0)
})

test("a lost save is recovered by querying the same plan rather than creating another", async ({
  page,
}) => {
  const state = await fixture(page, "lost-save")
  await open(page)
  await page.getByRole("tab", { name: "Tipo de cambio", exact: true }).click()
  await page.getByLabel("Margen de planificación · %", { exact: true }).fill("3")
  await page.getByRole("button", { name: "Guardar borrador", exact: true }).click()
  await expect(page.getByText("Resultado por confirmar", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Consultar resultado", exact: true }).click()
  await expect(page.getByText("Borrador guardado", { exact: true })).toBeVisible()
  expect(state.saves).toBe(1)
  expect(state.saved.document.exchange.margin).toBe("3")
})
test("the month-start guide follows the draft and stays read-only", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  const initial = exampleSavedPlan()
  const doc = initial.document
  initial.document = {
    ...doc,
    incomeMode: "net",
    income: { ...doc.income, net: "1000" },
    retainedAccountId: null,
    exchange: { ...doc.exchange, source: "Grupo Mutual", margin: "0" },
    lines: [
      { ...doc.lines[0], amount: "200000" },
      { ...doc.lines[1], kind: "fixed", currency: "CRC", amount: "100000" },
      { ...doc.lines[3], amount: "100" },
    ],
  }
  initial.calculation = calculateBudgetPlan(initial.document)
  const institutions = new Map([
    [1, "Grupo Mutual"],
    [2, "Grupo Mutual"],
    [3, "BAC Credomatic"],
  ])
  const options = {
    accounts: planOptions.accounts.map((account) => ({
      ...account,
      institutionName: institutions.get(account.id)!,
    })),
    envelopes: planOptions.envelopes.map((envelope) => ({
      ...envelope,
      institutionName: institutions.get(envelope.accountId)!,
    })),
  }
  const state = await fixture(page, "success", initial, options)
  const tab = page.getByRole("tab", { name: "Revisar sobres", exact: true })
  const guide = page.getByRole("region", { name: "Inicio de mes", exact: true })
  const metric = (name: string) => guide.locator("dl > div").filter({ hasText: name }).locator("dd")
  await open(page)
  await tab.click()
  for (const [label, value, currency] of [
    ["USD estimados por convertir", "600", "USD"],
    ["CRC estimados por recibir", "300000", "CRC"],
    ["USD a conservar", "400", "USD"],
    ["Compromisos y pagos en CRC", "300000", "CRC"],
    ["CRC a distribuir a sobres con destino", "300000", "CRC"],
    ["Colchón previsto en CRC", "0", "CRC"],
    ["Comprometidos en USD", "100", "USD"],
    ["Libres del plan", "300", "USD"],
  ]) {
    await expect(metric(label)).toHaveText(formatPlanMoney(value, currency))
  }
  await expect(guide.getByText("Pendiente · Por confirmar", { exact: true })).toBeVisible()
  await expect(guide.getByText(/Pagos CRC · Grupo Mutual.*Destino: Casa/)).toBeVisible()
  await expect(guide.getByText(/Tarjeta CRC · BAC Credomatic.*Destino: Personal/)).toBeVisible()
  await expect(metric("Tasa ejecutada")).toHaveText("Por verificar")
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  const exchange = page.getByRole("tab", { name: "Tipo de cambio", exact: true })
  await exchange.click()
  const buy = page.getByLabel("Compra · CRC por USD", { exact: true })
  await buy.fill("450")
  await tab.click()
  await expect(metric("USD estimados por convertir")).toHaveText(formatPlanMoney("667.22"))
  await expect(metric("USD a conservar")).toHaveText(formatPlanMoney("332.78"))
  await expect(metric("Colchón previsto en CRC")).toHaveText(formatPlanMoney("250", "CRC"))
  await exchange.click()
  await buy.fill("")
  await tab.click()
  await expect(metric("USD estimados por convertir")).toHaveText("Por confirmar")
  await expect(metric("CRC a distribuir a sobres con destino")).toHaveText("Por confirmar")
  await page.reload()
  await tab.click()
  await expect(guide).toBeVisible()
  expect(state.bodies).toHaveLength(0)
})

test("month-start reviews the actual conversion and recovers the same transfer after a lost response", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 })
  const initial = exampleSavedPlan()
  const doc = initial.document
  initial.document = {
    ...doc,
    exchange: { ...doc.exchange, buy: "434", margin: "0" },
    lines: [{ ...doc.lines[0], amount: "260400", targetEnvelopeId: 32 }],
  }
  initial.calculation = calculateBudgetPlan(initial.document)
  const existing = await fixture(page, "success", initial)
  const data: MonthStart = {
    planId,
    revision: initial.revision,
    detachedCount: 0,
    steps: [
      {
        key: "fx",
        kind: "fx",
        label: "Conversión USD a CRC",
        planned: "600",
        currency: "USD",
        fromAccountId: 1,
        fromEnvelopeId: null,
        toAccountId: null,
        toEnvelopeId: null,
        evidence: null,
      },
    ],
  }
  const movements = [
    {
      id: 71,
      date: "2026-11-01",
      accountId: 1,
      accountName: "Reserva USD",
      envelopeId: 11,
      amount: "600",
      currency: "USD",
    },
    {
      id: 72,
      date: "2026-11-01",
      accountId: 2,
      accountName: "Pagos CRC",
      envelopeId: 21,
      amount: "262000",
      currency: "CRC",
    },
  ] as const
  await page.route(/\/api\/transactions\/(71|72)\?/, (route) => {
    const movement = route.request().url().includes("/71?") ? movements[0] : movements[1]
    const expense = movement.id === 71
    return route.fulfill({
      json: {
        id: movement.id,
        userId: 1,
        type: expense ? "EXPENSE" : "INCOME",
        description: expense ? "Salida bancaria" : "Abono bancario",
        date: movement.date,
        createdAt: null,
        correction: { available: false, reason: "NO_AUDITED_CORRECTION_FLOW" },
        lines: [
          {
            id: movement.id,
            accountId: movement.accountId,
            accountName: movement.accountName,
            accountCurrency: movement.currency,
            institutionName: "Banco de ejemplo",
            envelopeId: movement.envelopeId,
            categoryName: "Disponible",
            envelopeActive: true,
            amount: Number(movement.amount) * (expense ? -1 : 1),
          },
        ],
      },
    })
  })
  await page.route(/\/api\/reports\/envelope-balances\?/, (route) => {
    const accountId = Number(new URL(route.request().url()).searchParams.get("accountId"))
    return route.fulfill({
      json: planOptions.envelopes
        .filter((e) => e.accountId === accountId)
        .map((e) => ({ envelopeId: e.id, categoryName: e.categoryName })),
    })
  })
  let links = 0
  let posts = 0
  let original: unknown
  await page.route(/\/api\/budget-plans\/[^/]+\/month-start(?:\?|\/)/, async (route) => {
    const req = route.request()
    if (req.method() === "GET") return route.fulfill({ json: data })
    if (req.method() === "PUT") {
      links++
      const body = req.postDataJSON()
      expect(body.movementIds).toEqual([71, 72])
      data.steps[0].evidence = { current: true, rate: "436.666667", movements: [...movements] }
      data.steps.push({
        key: "transfer:3",
        kind: "transfer",
        label: "Traslado de fondos en CRC",
        planned: "260400",
        currency: "CRC",
        fromAccountId: 2,
        fromEnvelopeId: 21,
        toAccountId: 3,
        toEnvelopeId: 31,
        evidence: null,
      })
      return route.fulfill({ json: data })
    }
    posts++
    const body = req.postDataJSON()
    const t = body.transfer
    if (posts === 1) {
      original = body
      data.steps[1].evidence = {
        current: true,
        rate: null,
        movements: [
          { ...movements[1], id: 80, amount: String(t.amount), date: t.date },
          {
            ...movements[1],
            id: 80,
            accountId: 3,
            accountName: "Tarjeta CRC",
            envelopeId: 31,
            amount: String(t.amount),
            date: t.date,
          },
        ],
      }
      return route.abort("failed")
    }
    expect(body).toEqual(original)
    return route.fulfill({
      json: {
        transaction: {
          id: 80,
          userId: 1,
          type: "TRANSFER",
          description: t.description,
          date: t.date,
        },
        lines: [
          { ...t.from, amount: -t.amount },
          { ...t.to, amount: t.amount },
        ],
      },
    })
  })
  await open(page)
  const tab = page.getByRole("tab", { name: "Revisar sobres", exact: true })
  await tab.click()
  const link = page.getByRole("button", { name: "Vincular movimiento", exact: true })
  await link.click()
  await page.getByRole("button", { name: "Cerrar", exact: true }).last().click()
  expect(links).toBe(0)
  await link.click()
  let dialog = page.getByRole("dialog")
  await dialog.getByLabel("ID de salida en USD").fill("71")
  await dialog.getByLabel("ID de entrada en CRC").fill("72")
  await dialog.getByRole("button", { name: "Revisar movimientos" }).click()
  await expect(
    dialog.getByText("Los importes reales difieren del plan.", { exact: false }),
  ).toBeVisible()
  expect(links).toBe(0)
  await dialog.getByRole("button", { name: "Confirmar vínculo" }).click()
  await expect(page.getByText(/Conversión registrada.*262/)).toBeVisible()
  expect(links).toBe(1)
  await page.getByRole("button", { name: "Preparar transferencia" }).click()
  dialog = page.getByRole("dialog")
  await expect(dialog.getByLabel("Importe en CRC")).toHaveValue("260400")
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click()
  expect(posts).toBe(0)
  await page.getByRole("button", { name: "Preparar transferencia" }).click()
  await dialog.getByRole("button", { name: "Guardar transferencia" }).click()
  await expect(dialog.getByText("Transferencia por confirmar", { exact: true })).toBeVisible()
  await page.reload()
  await tab.click()
  await page.getByRole("button", { name: "Recuperar transferencia" }).click()
  await dialog.getByRole("button", { name: "Reintentar transferencia" }).click()
  await expect(
    page.getByRole("link", { name: "Movimiento #80", exact: true }).first(),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Recuperar transferencia" })).toHaveCount(0)
  await page.getByRole("link", { name: "Movimiento #71", exact: true }).click()
  await expect(page.getByRole("dialog").getByText("Salida bancaria", { exact: true })).toBeVisible()
  expect(posts).toBe(2)
  expect(existing.bodies).toHaveLength(0)
})

test("applying is explicit, single-shot and leaves a persistent receipt", async ({ page }) => {
  const state = await fixture(page)
  await open(page)
  await prepared(page)
  expect(state.posted).toBe(0)
  await apply(page)
  await expect(page.getByText("Presupuesto asignado", { exact: true })).toBeVisible()
  expect(state.funds).toBe(1)
  expect(state.posted).toBe(1)
  expect(state.saved.receipt?.transactions).toHaveLength(4)
  await page.reload()
  await page.getByRole("tab", { name: "Revisar sobres", exact: true }).click()
  await expect(page.getByText("Presupuesto asignado", { exact: true })).toBeVisible()
  const guide = page.getByRole("region", { name: "Inicio de mes", exact: true })
  await expect(guide.getByText("Confirmado · Movimiento 100", { exact: true })).toBeVisible()
  await expect(guide.getByText("Por verificar", { exact: true })).toHaveCount(2)
  await expect(page.getByRole("button", { name: "Asignar a sobres", exact: true })).toHaveCount(0)
})

test("tracking separates planned, assigned and spent and opens the exact envelope history", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.emulateMedia({ colorScheme: "dark" })
  const plan = exampleSavedPlan()
  const state = await fixture(page, "success", plan)
  const data = {
    planId,
    revision: plan.revision,
    month: "2026-11",
    from: "2026-11-01",
    to: "2026-11-30",
    fundingStatus: "confirmed",
    fundingDate: "2026-12-02",
    unmappedCount: 0,
    rows: [
      {
        envelopeId: 22,
        accountId: 2,
        accountName: "Pagos CRC",
        categoryName: "Casa",
        currency: "CRC",
        active: true,
        hasPlan: true,
        planned: "100",
        assigned: "80",
        spent: "90",
      },
      {
        envelopeId: 32,
        accountId: 3,
        accountName: "Tarjeta CRC",
        categoryName: "Personal",
        currency: "CRC",
        active: false,
        hasPlan: false,
        planned: null,
        assigned: "0",
        spent: "7",
      },
      {
        envelopeId: 12,
        accountId: 1,
        accountName: "Reserva USD",
        categoryName: "Meta USD",
        currency: "USD",
        active: true,
        hasPlan: true,
        planned: "20",
        assigned: "20",
        spent: "0",
      },
    ],
  }
  let reads = 0
  await page.route(/\/api\/budget-plans\/[^/]+\/tracking\?/, (route) => {
    reads++
    return route.fulfill({ json: data })
  })
  await open(page)
  expect(reads).toBe(0)
  await page.getByRole("tab", { name: "Seguimiento" }).click()
  const panel = page.getByRole("tabpanel", { name: "Seguimiento" })
  const house = panel
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: "Casa", exact: true }) })
  for (const [name, amount] of [
    ["Planeado", "100"],
    ["Asignado", "80"],
    ["Gastado", "90"],
    ["Falta asignar", "20"],
    ["Restante del plan", "10"],
    ["Exceso sobre lo asignado", "10"],
  ]) {
    await expect(
      house
        .locator("dl > div")
        .filter({ has: page.getByText(name, { exact: true }) })
        .locator("dd"),
    ).toHaveText(formatPlanMoney(amount, "CRC"))
  }
  await expect(panel.getByText("Asignación registrada el 02/12/2026.")).toBeVisible()
  await expect(panel.getByText("Tarjeta CRC · Inactivo")).toBeVisible()
  await expect(panel.getByText("Sin plan")).toBeVisible()
  await expect(panel.getByRole("heading", { name: "Dólares · USD" })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  expect(a11y.violations.map((v) => v.id)).toEqual([])
  expect(reads).toBe(1)
  const detailed = page.waitForRequest(
    (req) =>
      new URL(req.url()).searchParams.get("accountEnvelopeId") === "32" &&
      req.url().includes("/api/transactions?"),
  )
  await panel.getByRole("link", { name: "Ver gastos de Personal, Tarjeta CRC" }).click()
  const query = new URL((await detailed).url()).searchParams
  expect([query.get("from"), query.get("to"), query.get("accountId"), query.get("type")]).toEqual([
    "2026-11-01",
    "2026-11-30",
    "3",
    "EXPENSE",
  ])
  expect(state.bodies).toHaveLength(0)
})

test("a historical funded plan keeps its tracking visible when the receipt cannot be verified", async ({
  page,
}) => {
  const plan = exampleSavedPlan()
  plan.status = "funded"
  await fixture(page, "success", plan)
  await page.route(/\/api\/budget-plans\/[^/]+\/tracking\?/, (route) =>
    route.fulfill({
      json: {
        planId,
        revision: plan.revision,
        month: "2026-11",
        from: "2026-11-01",
        to: "2026-11-30",
        fundingStatus: "unverified",
        fundingDate: null,
        unmappedCount: 0,
        rows: [
          {
            envelopeId: 22,
            accountId: 2,
            accountName: "Pagos CRC",
            categoryName: "Casa",
            currency: "CRC",
            active: true,
            hasPlan: true,
            planned: "100",
            assigned: null,
            spent: "0",
          },
        ],
      },
    }),
  )
  await page.goto("/budgets")
  await page.getByRole("link", { name: /noviembre de 2026/i }).click()
  await expect(page.getByRole("heading", { name: "Tu distribución", exact: true })).toBeVisible()
  await page.getByRole("tab", { name: "Revisar sobres" }).click()
  await expect(page.getByText("Recibo por verificar", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Asignar a sobres", exact: true })).toHaveCount(0)
  await page.getByRole("tab", { name: "Seguimiento" }).click()
  await expect(page.getByText("Asignación por verificar", { exact: true })).toBeVisible()
  const panel = page.getByRole("tabpanel", { name: "Seguimiento" })
  await expect(panel.getByText("Por verificar", { exact: true })).toBeVisible()
  await expect(panel.getByText(formatPlanMoney("0", "CRC"), { exact: true })).toBeVisible()
})
for (const mode of ["lost-fund", "malformed-fund"] as const)
  test(`${mode} never confirms an unverified receipt or posts another intent`, async ({ page }) => {
    const state = await fixture(page, mode)
    await open(page)
    await prepared(page)
    await apply(page)
    await expect(
      page.getByRole("button", { name: "Consultar resultado", exact: true }),
    ).toBeVisible()
    expect(state.posted).toBe(1)
    await expect(page.getByText(/Confirmado · Movimiento/)).toHaveCount(0)
    await page.getByRole("button", { name: "Consultar resultado", exact: true }).click()
    await page.getByRole("tab", { name: "Revisar sobres", exact: true }).click()
    await expect(page.getByText("Presupuesto asignado", { exact: true })).toBeVisible()
    expect(state.funds).toBe(1)
    expect(state.posted).toBe(1)
  })
test("a definitive funding rejection keeps the plan for review without a success message", async ({
  page,
}) => {
  const state = await fixture(page, "rejected-fund")
  await open(page)
  await prepared(page)
  await apply(page)
  await expect(page.getByRole("dialog")).toContainText("faltan fondos")
  expect(state.posted).toBe(0)
  await expect(page.getByText("Presupuesto asignado", { exact: true })).toHaveCount(0)
})
test("copying keeps current income and asks before replacing assignments", async ({ page }) => {
  const state = await fixture(page)
  await open(page)
  await page.getByRole("button", { name: "Copiar asignaciones anteriores", exact: true }).click()
  await expect(page.getByRole("dialog")).toContainText(
    "El ingreso y las cotizaciones actuales se conservan",
  )
  await page.getByRole("button", { name: "Copiar asignaciones", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Editar Anterior Casa", exact: true }),
  ).toBeVisible()
  expect(state.saves).toBe(0)
  expect(state.saved.document.income.gross).toBe("3600")
})
test("missing preparation stays an explicit unavailable state", async ({ page }) => {
  await fixture(page, "missing-setup")
  await page.goto("/budgets")
  await expect(
    page.getByText("La planificación de presupuestos aún no está habilitada en este entorno.", {
      exact: true,
    }),
  ).toBeVisible()
  await expect(page.getByText("private server path", { exact: false })).toHaveCount(0)
})
