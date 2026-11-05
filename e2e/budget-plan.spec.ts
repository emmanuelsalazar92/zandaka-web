import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { calculateBudgetPlan } from "../lib/budget-plan"
import { exampleSavedPlan, planId, planOptions } from "../tests/fixtures/budget-plan"

import { installSyntheticAPI } from "./fixtures"

import type { BudgetPlanDocument } from "../lib/budget-plan"
import type { FundingPreview } from "../lib/budget-plan-api"

type Mode =
  | "success"
  | "new"
  | "lost-save"
  | "lost-fund"
  | "malformed-fund"
  | "rejected-fund"
  | "missing-setup"
async function fixture(page: Page, mode: Mode = "success") {
  await installSyntheticAPI(page)
  let current = exampleSavedPlan(),
    saveCount = 0,
    fundCount = 0,
    posted = 0
  const bodies: unknown[] = []
  const preview = (): FundingPreview => {
    const values = calculateBudgetPlan(current.document)
    const transfers = values.lines.map((line) => {
      const original = current.document.lines.find((l) => l.id === line.id)!
      const target = planOptions.envelopes.find((e) => e.id === original.targetEnvelopeId)!
      const source = planOptions.envelopes.find(
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
      if (path === "/options") return route.fulfill({ json: planOptions })
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
          json: { ...current, receipt: { ...current.receipt, transactions: [] } },
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
  await expect(page.getByRole("button", { name: "Asignar a sobres", exact: true })).toHaveCount(0)
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
