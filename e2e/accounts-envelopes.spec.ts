import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { installSyntheticAPI } from "./fixtures"

async function fixture(
  page: Page,
  mode: "ready" | "pending" | "error" | "empty" | "conflict" = "ready",
) {
  await installSyntheticAPI(page)
  const institutions = [{ id: 1, user_id: 1, name: "Banco Horizonte", type: "BANK", is_active: 1 }]
  const names = [
    "Reserva de tranquilidad",
    "Casa",
    "Alimentación",
    "Transporte",
    "Personal",
    "Suscripciones",
    "Un nuevo propósito",
  ]
  const balances = [600000, 180000, 85000, 24000, 17500, -9000, 0]
  const rows: Record<
    number,
    Array<{
      envelopeId: number
      categoryId: number
      categoryName: string
      balance: number | null
      currency: string
    }>
  > = {
    1: Array.from({ length: 35 }, (_, index) => ({
      envelopeId: 1001 + index,
      categoryId: 11 + index,
      categoryName:
        names[index] ?? `Propósito familiar ${index} · ${"ReferenciaSinEspacios".repeat(3)}`,
      balance: balances[index] ?? index * 10,
      currency: "CRC",
    })),
    2: [
      {
        envelopeId: 2001,
        categoryId: 70,
        categoryName: "El próximo destino",
        balance: 4500.25,
        currency: "USD",
      },
      {
        envelopeId: 2002,
        categoryId: 71,
        categoryName: "Experiencias",
        balance: 650.75,
        currency: "USD",
      },
    ],
    3: [],
  }
  const accounts = [
    {
      id: 1,
      user_id: 1,
      institution_id: 1,
      name: "Cuenta principal CRC",
      currency: "CRC",
      is_active: 1,
      allow_overdraft: 1,
      institution: "Banco Horizonte",
      type: "BANK",
      balance: 904000,
      has_active_envelopes: true,
      active_envelopes_count: 35,
    },
    {
      id: 2,
      user_id: 1,
      institution_id: 1,
      name: "Cuenta de viajes USD",
      currency: "USD",
      is_active: 1,
      allow_overdraft: 0,
      institution: "Banco Horizonte",
      type: "BANK",
      balance: 5151,
      has_active_envelopes: true,
      active_envelopes_count: 2,
    },
    {
      id: 3,
      user_id: 1,
      institution_id: 1,
      name: "Cuenta histórica sin sobres",
      currency: "CRC",
      is_active: 1,
      allow_overdraft: 0,
      institution: "Banco Horizonte",
      type: "BANK",
      balance: 50,
      has_active_envelopes: false,
      active_envelopes_count: 0,
    },
  ]
  const categories = [
    { id: 10, user_id: 1, name: "Propósitos", parent_id: null as number | null, is_active: 1 },
    ...Object.values(rows)
      .flat()
      .map((row) => ({
        id: row.categoryId,
        user_id: 1,
        name: row.categoryName,
        parent_id: 10 as number | null,
        is_active: 1,
      })),
  ]
  const reads: URL[] = []
  const writes: Array<{ path: string; body: Record<string, unknown> }> = []
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname.slice(4)
    if (request.method() === "GET") {
      reads.push(url)
      if (path === "/reports/account-balances") {
        if (mode === "error") return route.fulfill({ status: 503, json: {} })
        return route.fulfill({
          json:
            mode === "empty"
              ? []
              : accounts
                  .filter((row) => row.is_active)
                  .map((row) => ({
                    ...row,
                    balance: mode === "pending" && row.id === 1 ? null : row.balance,
                  })),
        })
      }
      if (path === "/accounts")
        return route.fulfill({ json: accounts.filter((row) => row.is_active) })
      if (path === "/institutions") return route.fulfill({ json: institutions })
      if (path === "/categories") return route.fulfill({ json: categories })
      if (path === "/reports/envelope-balances") {
        const id = Number(url.searchParams.get("accountId"))
        return route.fulfill({
          json: (rows[id] ?? []).map((row, index) => ({
            ...row,
            balance: mode === "pending" && id === 1 && index === 0 ? null : row.balance,
          })),
        })
      }
      if (path === "/transactions")
        return route.fulfill({
          json: {
            data: [],
            meta: {
              page: 1,
              pageSize: 10,
              totalItems: 0,
              totalPages: 0,
              hasNextPage: false,
              hasPrevPage: false,
            },
          },
        })
      return route.fallback()
    }
    const body = request.postDataJSON() ?? {}
    writes.push({ path, body })
    if (path === "/institutions" && request.method() === "POST") {
      const created = {
        id: 300 + institutions.length,
        user_id: 1,
        name: String(body.name),
        type: String(body.type),
        is_active: 1,
      }
      institutions.push(created)
      return route.fulfill({ status: 201, json: created })
    }
    if (path === "/accounts" && request.method() === "POST") {
      const created = {
        id: 4,
        user_id: 1,
        institution_id: Number(body.institutionId),
        name: String(body.name),
        currency: String(body.currency),
        is_active: 1,
        allow_overdraft: Number(body.allowOverdraft),
        institution: institutions.find((row) => row.id === Number(body.institutionId))!.name,
        type: "BANK",
        balance: 0,
        has_active_envelopes: false,
        active_envelopes_count: 0,
      }
      accounts.push(created)
      rows[4] = []
      return route.fulfill({ status: 201, json: created })
    }
    if (path === "/categories" && request.method() === "POST") {
      const created = {
        id: 500 + categories.length,
        user_id: 1,
        name: String(body.name),
        parent_id: body.parentId === null ? null : Number(body.parentId),
        is_active: 1,
      }
      categories.push(created)
      return route.fulfill({ status: 201, json: created })
    }
    if (/^\/accounts\/\d+\/envelopes$/.test(path)) {
      const id = Number(path.split("/")[2]),
        categoryId = Number(body.categoryId),
        category = categories.find((row) => row.id === categoryId)!
      const created = {
        envelopeId: 9000,
        categoryId,
        categoryName: category.name,
        balance: 0,
        currency: accounts.find((row) => row.id === id)!.currency,
      }
      rows[id].push(created)
      return route.fulfill({
        status: 201,
        json: { id: 9000, account_id: id, category_id: categoryId, is_active: 1 },
      })
    }
    if (/^\/envelopes\/\d+\/deactivate$/.test(path)) {
      if (mode === "conflict")
        return route.fulfill({
          status: 409,
          json: { error: { code: "CONFLICT", message: "private exception" } },
        })
      const id = Number(path.split("/")[2])
      for (const key of Object.keys(rows))
        rows[Number(key)] = rows[Number(key)].filter((row) => row.envelopeId !== id)
      return route.fulfill({ status: 204 })
    }
    if (/^\/accounts\/\d+\/deactivate$/.test(path)) {
      accounts.find((row) => row.id === Number(path.split("/")[2]))!.is_active = 0
      return route.fulfill({ status: 204 })
    }
    throw new Error(`Unexpected write in isolated fixture: ${path}`)
  })
  return { reads, writes, rows, accounts }
}

async function choose(page: Page, label: string, option: string) {
  await page.getByRole("button", { name: label, exact: true }).click()
  await page.getByRole("option", { name: new RegExp(option) }).click()
}

for (const path of ["/accounts", "/envelopes"])
  for (const width of [390, 1440])
    for (const theme of ["light", "dark"] as const)
      for (const scale of [100, 200])
        for (const font of width === 390 && scale === 200
          ? ["system", "Arial", "Verdana"]
          : ["system"]) {
          test(`${path} Marea ${width}px ${theme} ${scale}% ${font}: context, open rows and geometry`, async ({
            page,
          }, info) => {
            await page.setViewportSize({ width, height: 1000 })
            await page.emulateMedia({ colorScheme: theme })
            const model = await fixture(page)
            await page.goto(path)
            await expect(
              page.getByTestId(path === "/accounts" ? "account-row" : "envelope-row").first(),
            ).toBeVisible()
            await page.addStyleTag({
              content: `html { font-size: ${scale}%; } ${font === "system" ? "" : `body { font-family: ${font}, sans-serif !important; }`}`,
            })
            const geometry = await page.locator("#main-content").evaluate((root) => {
              const viewport = document.documentElement.clientWidth
              return {
                viewport,
                doc: document.documentElement.scrollWidth,
                overflow: [...root.querySelectorAll<HTMLElement>("h1,h2,h3,p,button,a,input")]
                  .filter((node) => {
                    const r = node.getBoundingClientRect()
                    return (
                      r.right > viewport + 1 ||
                      r.left < -1 ||
                      node.scrollWidth > node.clientWidth + 1
                    )
                  })
                  .map((node) => ({
                    tag: node.tagName,
                    text: node.textContent?.slice(0, 65),
                    width: node.clientWidth,
                    scroll: node.scrollWidth,
                  })),
              }
            })
            expect(geometry.doc, JSON.stringify(geometry.overflow)).toBeLessThanOrEqual(
              geometry.viewport + 1,
            )
            expect(geometry.overflow).toEqual([])
            const axe = await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
            expect(
              axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
            ).toEqual([])
            if (path === "/envelopes") {
              await expect(page.getByTestId("envelope-row")).toHaveCount(35)
              await expect(
                page.getByText(/Low|Healthy|Bajo|Saludable/, { exact: true }),
              ).toHaveCount(0)
            } else
              await expect(page.getByText("Saldo original · USD", { exact: true })).toBeVisible()
            expect(model.writes).toEqual([])
            if (scale === 100) await page.screenshot({ path: info.outputPath("marea.png") })
          })
        }

test("account and envelope activity carry exact filters, including category rather than envelope ID", async ({
  page,
}) => {
  const model = await fixture(page)
  await page.goto("/accounts")
  await page
    .getByRole("link", { name: "Movimientos de la cuenta Cuenta de viajes USD", exact: true })
    .click()
  await expect
    .poll(() =>
      model.reads.some(
        (url) =>
          url.pathname === "/api/transactions" &&
          url.searchParams.get("accountId") === "2" &&
          !url.searchParams.has("categoryId"),
      ),
    )
    .toBe(true)
  await page.goto("/envelopes?accountId=1")
  await page.getByRole("link", { name: "Movimientos del sobre Suscripciones", exact: true }).click()
  await expect
    .poll(() =>
      model.reads.some(
        (url) =>
          url.pathname === "/api/transactions" &&
          url.searchParams.get("accountId") === "1" &&
          url.searchParams.get("categoryId") === "16" &&
          !url.searchParams.has("from"),
      ),
    )
    .toBe(true)
})

test("switching currency/account cancels stale envelopes and never relabels a previous balance", async ({
  page,
}) => {
  const model = await fixture(page)
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/api/reports/envelope-balances?accountId=1", async (route) => {
    model.reads.push(new URL(route.request().url()))
    await gate
    await route.fulfill({ json: model.rows[1] }).catch(() => {})
  })
  await page.goto("/envelopes?accountId=1")
  await expect
    .poll(() => model.reads.some((url) => url.searchParams.get("accountId") === "1"))
    .toBe(true)
  await choose(page, "Cuenta de los sobres", "Cuenta de viajes USD")
  await expect(page.getByText("El próximo destino", { exact: true }).first()).toBeVisible()
  release()
  await expect(page.getByTestId("envelope-row")).toHaveCount(2)
  await expect(page.getByRole("region", { name: "Saldo y distribución de sobres" })).toContainText(
    /5\s*151,00/,
  )
  await expect(
    page.getByRole("heading", { name: "Reserva de tranquilidad", exact: true }),
  ).toHaveCount(0)
})

test("missing balances remain unknown while known negatives are still actionable", async ({
  page,
}) => {
  await fixture(page, "pending")
  await page.goto("/envelopes")
  const hero = page.getByRole("region", { name: "Saldo y distribución de sobres" })
  await expect(hero.getByText("Por confirmar", { exact: true })).toBeVisible()
  await expect(hero.getByText(/1 sobre con saldo negativo/)).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Desactivar sobre Reserva de tranquilidad", exact: true }),
  ).toBeDisabled()
  await hero.getByRole("link", { name: /Revisar/ }).click()
  await expect(page.getByTestId("envelope-row")).toHaveCount(1)
  await expect(page.getByTestId("envelope-row")).toContainText("Suscripciones")
})

test("search, sorting and density change only the view and preserve the full distribution", async ({
  page,
}) => {
  const model = await fixture(page)
  await page.goto("/envelopes")
  await expect(page.getByTestId("envelope-row")).toHaveCount(35)
  const balance = await page
    .getByRole("region", { name: "Saldo y distribución de sobres" })
    .innerText()
  const reads = model.reads.length
  await page.getByLabel("Buscar sobres", { exact: true }).fill("alimentacion")
  await expect(page.getByTestId("envelope-row")).toHaveCount(1)
  await expect(page.getByTestId("envelope-row")).toContainText("Alimentación")
  await page.getByRole("button", { name: "Compacta", exact: true }).click()
  await expect(page.getByRole("button", { name: "Compacta", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await page.getByLabel("Buscar sobres", { exact: true }).fill("")
  await choose(page, "Ordenar sobres", "Menor saldo primero")
  await expect(page.getByTestId("envelope-row").first()).toContainText("Suscripciones")
  expect(
    await page.getByRole("region", { name: "Saldo y distribución de sobres" }).innerText(),
  ).toBe(balance)
  expect(model.reads).toHaveLength(reads)
  expect(model.writes).toEqual([])
})

test("creating a missing institution keeps the account draft, currency and overdraft choice", async ({
  page,
}) => {
  const model = await fixture(page)
  await page.goto("/accounts")
  await page.getByRole("button", { name: "Añadir cuenta", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Crear cuenta", exact: true })
  await dialog.getByLabel("Nombre de la cuenta", { exact: true }).fill("Nueva cuenta en dólares")
  await choose(page, "Moneda de la cuenta", "USD · Dólar")
  await dialog.getByRole("switch", { name: "Permitir sobregiro", exact: true }).click()
  await dialog.getByRole("button", { name: "Crear institución aquí", exact: true }).click()
  await dialog
    .getByLabel("Nombre de la nueva institución", { exact: true })
    .fill("Nueva institución familiar")
  await dialog.getByRole("button", { name: "Crear institución", exact: true }).click()
  await expect(dialog.getByLabel("Nombre de la cuenta", { exact: true })).toHaveValue(
    "Nueva cuenta en dólares",
  )
  await expect(dialog.getByRole("button", { name: "Institución", exact: true })).toContainText(
    "Nueva institución familiar",
  )
  await dialog.getByRole("button", { name: "Crear cuenta", exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(
    page.getByRole("heading", { name: "Nueva cuenta en dólares", exact: true }),
  ).toBeVisible()
  expect(model.writes.find((write) => write.path === "/accounts")!.body).toMatchObject({
    institutionId: 301,
    currency: "USD",
    allowOverdraft: false,
    name: "Nueva cuenta en dólares",
  })
  expect(model.writes.filter((write) => write.path === "/accounts")).toHaveLength(1)
})

test("inline category and group creation stays separate from linking and never assigns money", async ({
  page,
}) => {
  const model = await fixture(page)
  await page.goto("/envelopes?accountId=1")
  await page.getByRole("button", { name: "Vincular categoría", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Vincular categoría a la cuenta", exact: true })
  await dialog.getByRole("button", { name: "Crear categoría aquí", exact: true }).click()
  await dialog.getByLabel("Nombre de la nueva categoría", { exact: true }).fill("Cine en familia")
  await dialog.getByText("Crear un grupo si no existe", { exact: true }).click()
  await dialog.getByLabel("Nombre del nuevo grupo", { exact: true }).fill("Tiempo compartido")
  await dialog.getByRole("button", { name: "Crear grupo", exact: true }).click()
  await expect(
    dialog.getByRole("button", { name: "Grupo de la categoría", exact: true }),
  ).toContainText("Tiempo compartido")
  await dialog.getByRole("button", { name: "Crear categoría", exact: true }).click()
  await expect(
    dialog.getByRole("button", { name: "Categoría del sobre", exact: true }),
  ).toContainText("Cine en familia")
  expect(model.writes.map((write) => write.path)).toEqual(["/categories", "/categories"])
  await dialog.getByRole("button", { name: "Vincular categoría", exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole("heading", { name: "Cine en familia", exact: true })).toBeVisible()
  expect(model.writes.at(-1)!.path).toBe("/accounts/1/envelopes")
  expect(model.writes.some((write) => /transactions|transfers/.test(write.path))).toBe(false)
})

test("deactivation keeps balance/envelope restrictions and accepts a historical nonzero account balance", async ({
  page,
}) => {
  const model = await fixture(page)
  await page.goto("/envelopes")
  await expect(
    page.getByRole("button", { name: "Desactivar sobre Casa", exact: true }),
  ).toBeDisabled()
  await page
    .getByRole("button", { name: "Desactivar sobre Un nuevo propósito", exact: true })
    .click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Confirmar desactivación", exact: true })
    .click()
  await expect(page.getByRole("heading", { name: "Un nuevo propósito", exact: true })).toHaveCount(
    0,
  )
  await page.goto("/accounts")
  await expect(
    page.getByRole("button", { name: "Desactivar cuenta Cuenta principal CRC", exact: true }),
  ).toBeDisabled()
  await page
    .getByRole("button", { name: "Desactivar cuenta Cuenta histórica sin sobres", exact: true })
    .click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Cuenta histórica sin sobres", exact: true }),
  ).toHaveCount(0)
  expect(model.writes.map((write) => write.path)).toEqual([
    "/envelopes/1007/deactivate",
    "/accounts/3/deactivate",
  ])
})

test("a server-side balance conflict preserves the envelope and exposes a safe error", async ({
  page,
}) => {
  const model = await fixture(page, "conflict")
  await page.goto("/envelopes")
  await page
    .getByRole("button", { name: "Desactivar sobre Un nuevo propósito", exact: true })
    .click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Confirmar desactivación", exact: true })
    .click()
  await expect(page.getByText("Desactivación por revisar", { exact: true })).toBeVisible()
  await expect(page.getByText("private exception", { exact: true })).toHaveCount(0)
  expect(model.writes).toHaveLength(1)
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Desactivar sobre Un nuevo propósito", exact: true }),
  ).toBeFocused()
})

test("empty, failed and unavailable account links do not fall back to another account", async ({
  page,
}) => {
  await fixture(page, "empty")
  await page.goto("/accounts")
  await expect(page.getByText("Todavía no hay cuentas", { exact: true })).toBeVisible()
  await fixture(page, "error")
  await page.goto("/envelopes")
  await expect(page.getByText("Cuentas por confirmar", { exact: true })).toBeVisible()
  await expect(page.getByText("Primero, una cuenta", { exact: true })).toHaveCount(0)
  await fixture(page)
  await page.goto("/envelopes?accountId=999")
  await expect(
    page.getByText("La cuenta del enlace no está disponible", { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole("region", { name: "Saldo y distribución de sobres" })).toHaveCount(0)
})

test("editing and inline cancellation restore focus without losing the account draft", async ({
  page,
}) => {
  const model = await fixture(page)
  await page.goto("/accounts")
  const edit = page.getByRole("button", { name: "Editar cuenta Cuenta principal CRC", exact: true })
  await edit.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("dialog", { name: "Editar cuenta", exact: true })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(edit).toBeFocused()
  await page.getByRole("button", { name: "Añadir cuenta", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Crear cuenta", exact: true })
  await dialog.getByLabel("Nombre de la cuenta", { exact: true }).fill("Borrador conservado")
  const inline = dialog.getByRole("button", { name: "Crear institución aquí", exact: true })
  await inline.click()
  await dialog.getByRole("button", { name: "Volver a la cuenta", exact: true }).click()
  await expect(inline).toBeFocused()
  await expect(dialog.getByLabel("Nombre de la cuenta", { exact: true })).toHaveValue(
    "Borrador conservado",
  )
  expect(model.writes).toEqual([])
})

test("a lost create response keeps the draft, blocks another submit and never invents an account", async ({
  page,
}) => {
  await fixture(page)
  const posts: unknown[] = []
  await page.route("**/api/accounts", (route) => {
    if (route.request().method() !== "POST") return route.fallback()
    posts.push(route.request().postDataJSON())
    return route.abort("failed")
  })
  await page.goto("/accounts")
  await page.getByRole("button", { name: "Añadir cuenta", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Crear cuenta", exact: true })
  await dialog.getByLabel("Nombre de la cuenta", { exact: true }).fill("Resultado incierto")
  await choose(page, "Institución", "Banco Horizonte")
  const submit = dialog.getByRole("button", { name: "Crear cuenta", exact: true })
  await submit.click()
  await expect(dialog.getByText(/El resultado está por confirmar/)).toBeVisible()
  await expect(submit).toBeDisabled()
  await expect(dialog.getByLabel("Nombre de la cuenta", { exact: true })).toHaveValue(
    "Resultado incierto",
  )
  await expect(page.getByText("Cuenta creada.", { exact: true })).toHaveCount(0)
  expect(posts).toHaveLength(1)
})
