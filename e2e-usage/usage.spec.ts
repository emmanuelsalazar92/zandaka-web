import { expect, test, type Page } from "@playwright/test"

import { installSyntheticAPI } from "../e2e/fixtures"
import { calculateBudgetPlan } from "../lib/budget-plan"
import { safeUsageEvent } from "../lib/usage-events"
import { exampleSavedPlan, planId, planOptions } from "../tests/fixtures/budget-plan"

type Captured = { name: string; data: Record<string, string>; url: string }
const evidence = new WeakMap<Page, Captured[]>()
test.afterEach(async ({ page }, info) => {
  await info.attach("synthetic-application-events.json", {
    contentType: "application/json",
    body: Buffer.from(
      JSON.stringify(
        { source: "synthetic", remoteProviderVerified: false, events: evidence.get(page) ?? [] },
        null,
        2,
      ),
    ),
  })
})
async function fixture(page: Page) {
  await installSyntheticAPI(page, "current", { origin: "http://127.0.0.1:3213" })
  const captured: Captured[] = []
  evidence.set(page, captured)
  await page.exposeFunction("__captureUsage", (event: Captured) => {
    expect(event.url).toBe("http://127.0.0.1:3213/usage")
    expect(
      safeUsageEvent({ name: event.name.replace(/^za_/, ""), data: event.data }),
    ).not.toBeNull()
    captured.push(event)
  })
  // Synthetic SDK script consumes the REAL pinned SDK's queue/track calls. This does
  // not assert remote Vercel ingestion, plan eligibility or its private wire format.
  await page.route("**/_vercel/insights/script.js", (route) => {
    expect(route.request().headers().referer).toBeUndefined()
    return route.fulfill({
      contentType: "application/javascript",
      body: `
      (()=>{let before;const q=window.vaq||[];window.va=(kind,p)=>{
        if(kind==='beforeSend'){before=p;return;}
        if(kind==='event'){
          const clean=before?.({type:'event',url:location.href});
          if(clean)window.__captureUsage({name:p.name,data:p.data,url:clean.url});
        }
      };for(const args of q)window.va(...args);window.vaq=[];})();`,
    })
  })
  return captured
}
async function ready(page: Page, captured: Captured[]) {
  await expect.poll(() => captured.filter((e) => e.name === "za_screen_view").length).toBe(1)
  await expect(page.locator('script[src="/_vercel/insights/script.js"]')).toHaveAttribute(
    "data-disable-auto-track",
    "1",
  )
}
function taskEvents(captured: Captured[], task: string) {
  return captured.filter((e) => e.data.task === task).map(({ name, data }) => ({ name, data }))
}
async function selectFirst(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click()
  await page.getByRole("option").first().click()
}

for (const result of ["completed", "rejected", "uncertain", "abandon"] as const)
  test(`movement ${result}: one event per action and no financial properties`, async ({ page }) => {
    const captured = await fixture(page)
    await page.route("**/api/transactions", async (route) => {
      if (route.request().method() !== "POST") return route.fallback()
      const p = route.request().postDataJSON()
      if (result === "uncertain") return route.fulfill({ status: 503, json: {} })
      if (result === "rejected")
        return route.fulfill({
          status: 400,
          json: { error: { code: "VALIDATION_ERROR", message: "PRIVATE ERROR" } },
        })
      return route.fulfill({
        status: 201,
        json: {
          transaction: {
            id: 91,
            user_id: p.userId,
            type: p.type,
            date: p.date,
            description: p.description,
          },
          lines: p.lines.map((l: { accountId: number; envelopeId: number; amount: number }) => ({
            account_id: l.accountId,
            envelope_id: l.envelopeId,
            amount: l.amount,
          })),
        },
      })
    })
    await page.goto("/transactions?private=SECRET#PRIVATE")
    await ready(page, captured)
    await page.getByRole("button", { name: "Nuevo movimiento", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: "Nuevo movimiento", exact: true })
    await expect.poll(() => taskEvents(captured, "movement").length).toBe(1)
    if (result === "abandon")
      await dialog.getByRole("button", { name: "Cancelar", exact: true }).click()
    else {
      await dialog.getByLabel("Descripción", { exact: true }).fill("PRIVATE SALARY")
      await selectFirst(page, "Cuenta 1")
      await selectFirst(page, "Sobre 1")
      await dialog.getByLabel(/^Importe 1 en/).fill("123.45")
      await dialog.getByRole("button", { name: "Guardar gasto", exact: true }).click()
    }
    const terminal =
      result === "abandon"
        ? "za_task_abandon"
        : result === "rejected"
          ? "za_task_error"
          : "za_task_finish"
    await expect.poll(() => taskEvents(captured, "movement").at(-1)?.name).toBe(terminal)
    expect(taskEvents(captured, "movement")).toEqual([
      { name: "za_task_start", data: { task: "movement" } },
      ...(result === "abandon" ? [] : [{ name: "za_task_submit", data: { task: "movement" } }]),
      {
        name: terminal,
        data: {
          task: "movement",
          ...(result === "rejected"
            ? { reason: "rejected" }
            : result === "abandon"
              ? {}
              : { result }),
        },
      },
    ])
    expect(JSON.stringify(captured)).not.toMatch(
      /SECRET|PRIVATE|123\.45|Cuenta de prueba|Alimentación/,
    )
  })

for (const outcome of ["completed", "partial", "uncertain"] as const)
  test(`import batch ${outcome} counts the batch, not individual rows`, async ({ page }) => {
    const captured = await fixture(page)
    let writes = 0
    await page.route("**/api/transactions", (route) => {
      if (route.request().method() !== "POST") return route.fallback()
      writes++
      if (writes === 2 && outcome !== "completed")
        return route.fulfill({ status: outcome === "partial" ? 400 : 503, json: {} })
      return route.fulfill({ status: 201, json: { id: 90 + writes } })
    })
    await page.goto("/transactions/import")
    await ready(page, captured)
    await page
      .getByLabel("Pegar movimientos", { exact: true })
      .fill(
        ["PRIVATE ONE", "PRIVATE TWO"]
          .map((s) => `01/11/2026\n12:00:00\n${s}\n₡1,000.01\n₡10,000.00`)
          .join("\n"),
      )
    await page.getByRole("button", { name: "Procesar movimientos", exact: true }).click()
    for (const i of [1, 2])
      await page.getByLabel(`Seleccionar movimiento ${i}`, { exact: true }).check()
    await page.getByLabel("Cuenta para selección", { exact: true }).selectOption("1")
    await expect(page.getByLabel("Sobre para selección").locator("option")).toHaveCount(4)
    await page.getByLabel("Sobre para selección").selectOption("1")
    await page.getByRole("button", { name: "Aplicar a compatibles", exact: true }).click()
    await page.getByRole("button", { name: /Revisar importación/ }).click()
    expect(taskEvents(captured, "import").filter((e) => e.name === "za_task_submit")).toHaveLength(
      0,
    )
    await page.getByRole("button", { name: "Confirmar importación", exact: true }).click()
    await expect.poll(() => taskEvents(captured, "import").at(-1)?.data.result).toBe(outcome)
    expect(taskEvents(captured, "import").map((e) => e.name)).toEqual([
      "za_task_start",
      "za_task_submit",
      "za_task_finish",
    ])
    expect(writes).toBe(2)
    expect(JSON.stringify(captured)).not.toMatch(/PRIVATE|1000|description|accountId/)
  })

for (const outcome of ["completed", "uncertain"] as const)
  test(`budget draft ${outcome} does not count viewing as editing or saving as funding`, async ({
    page,
  }) => {
    const captured = await fixture(page)
    let current = exampleSavedPlan()
    await page.route("**/api/budget-plans**", (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname
      if (path.endsWith("/options")) return route.fulfill({ json: planOptions })
      if (request.method() === "PUT") {
        if (outcome === "uncertain") return route.fulfill({ status: 503, json: {} })
        const body = request.postDataJSON()
        current = {
          ...current,
          document: body.document,
          revision: current.revision + 1,
          calculation: calculateBudgetPlan(body.document),
        }
      }
      return route.fulfill({ json: current })
    })
    await page.goto(`/budgets/plans/${planId}`)
    await ready(page, captured)
    await page.getByRole("tab", { name: "Tipo de cambio", exact: true }).click()
    expect(taskEvents(captured, "budget_save")).toEqual([])
    await page.getByLabel("Margen de planificación · %", { exact: true }).fill("3")
    await page.getByRole("button", { name: "Guardar borrador", exact: true }).click()
    await expect.poll(() => taskEvents(captured, "budget_save").at(-1)?.data.result).toBe(outcome)
    expect(taskEvents(captured, "budget_save").map((e) => e.name)).toEqual([
      "za_task_start",
      "za_task_submit",
      "za_task_finish",
    ])
    expect(JSON.stringify(captured)).not.toContain(planId)
  })

test("reconciliation confirms only after receiving a valid receipt", async ({ page }) => {
  const captured = await fixture(page)
  await page.route("**/api/reconciliations", (route) => {
    if (route.request().method() !== "POST") return route.fallback()
    const body = route.request().postDataJSON()
    return route.fulfill({
      status: 201,
      json: {
        id: 900,
        accountId: body.accountId,
        currency: "CRC",
        date: body.date,
        countMethod: "MANUAL_TOTAL",
        countedTotal: body.realBalance,
        expectedTotal: 10000,
        realBalance: body.realBalance,
        calculatedBalance: 10000,
        difference: 0,
        status: "BALANCED",
        isActive: 0,
        note: body.note ?? null,
        notes: body.note ?? null,
        createdAt: null,
        updatedAt: null,
        closedAt: null,
        lines: [],
      },
    })
  })
  await page.goto("/reconciliation")
  await ready(page, captured)
  await page.getByRole("button", { name: "Nueva conciliación", exact: true }).click()
  await page.getByLabel("Total contado en CRC", { exact: true }).fill("10000")
  await page.getByRole("button", { name: "Crear conciliación", exact: true }).click()
  await expect
    .poll(() => taskEvents(captured, "reconciliation").at(-1)?.data.result)
    .toBe("completed")
  expect(taskEvents(captured, "reconciliation").map((e) => e.name)).toEqual([
    "za_task_start",
    "za_task_submit",
    "za_task_finish",
  ])
})
