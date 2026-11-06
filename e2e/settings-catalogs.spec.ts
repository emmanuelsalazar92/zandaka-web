import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { installSyntheticAPI } from "./fixtures"

const rule = {
  id: 1,
  user_id: 1,
  pattern: "Netflix",
  match_type: "CONTAINS",
  priority: 10,
  account_id: 1,
  account_envelope_id: 2 as number | null,
  is_active: 1,
  account_name: "Cuenta de prueba",
  account_currency: "CRC",
  account_envelope_label: "Suscripciones",
  notes: "Servicios mensuales",
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-03T00:00:00Z",
}
async function catalogFixture(
  page: Page,
  options: {
    countsFail?: boolean
    categoriesFail?: boolean
    rulesFail?: boolean
    write?: "normal" | "lost" | "conflict"
  } = {},
) {
  await installSyntheticAPI(page)
  let rules = [rule]
  let institutions = [
    { id: 1, user_id: 1, name: "Banco principal", type: "BANK", is_active: 1 },
    { id: 2, user_id: 1, name: "Reserva", type: "VIRTUAL", is_active: 1 },
    { id: 3, user_id: 1, name: "Archivada", type: "CASH", is_active: 0 },
  ]
  let categories = [
    { id: 1, name: "Necesidades", parent_id: null as number | null, is_active: 1 },
    { id: 2, name: "Casa", parent_id: 1, is_active: 1 },
    { id: 3, name: "Teléfono", parent_id: 2, is_active: 1 },
    { id: 4, name: "Ocio", parent_id: null, is_active: 1 },
  ]
  const writes: { method: string; path: string; body: Record<string, unknown> | null }[] = []
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname.slice(4)
    if (request.method() === "GET") {
      if (path === "/institutions") return route.fulfill({ json: institutions })
      if (path === "/categories")
        return route.fulfill(
          options.categoriesFail
            ? { status: 503, json: { error: { code: "INTERNAL_ERROR" } } }
            : { json: categories },
        )
      if (path === "/reports/account-balances" && options.countsFail)
        return route.fulfill({ status: 503, json: { error: { code: "INTERNAL_ERROR" } } })
      if (path === "/auto-assignment-rules")
        return route.fulfill(
          options.rulesFail
            ? { status: 503, json: { error: { code: "INTERNAL_ERROR" } } }
            : { json: rules },
        )
      return route.fallback()
    }
    const body = request.postData() ? (request.postDataJSON() as Record<string, unknown>) : null
    writes.push({ method: request.method(), path, body })
    // Explicit synthetic metadata-only allowlist. Everything else remains forbidden.
    if (path === "/auto-assignment-rules/test" && request.method() === "POST")
      return route.fulfill({
        json: { description: body!.description, matched: true, matchedRule: rule, matches: [rule] },
      })
    if (path === "/auto-assignment-rules" && request.method() === "POST") {
      const saved = {
        ...rule,
        id: 52,
        ...body,
        user_id: 1,
        is_active: 1,
        account_envelope_id: null,
      }
      rules = [...rules, saved]
      return route.fulfill({ status: 201, json: saved })
    }
    if (path === "/auto-assignment-rules/52/status" && request.method() === "PATCH") {
      const saved = {
        ...rules.find((item) => item.id === 52)!,
        is_active: body!.isActive ? 1 : 0,
        isActive: body!.isActive,
      }
      rules = rules.map((item) => (item.id === 52 ? saved : item))
      return route.fulfill({ json: saved })
    }
    if (
      /^\/(institutions|categories)(\/\d+(\/deactivate)?)?$/.test(path) &&
      ["POST", "PATCH"].includes(request.method())
    ) {
      if (options.write === "lost")
        return route.fulfill({ status: 201, json: { name: body?.name } })
      if (options.write === "conflict")
        return route.fulfill({
          status: 409,
          json: { error: { code: "CONFLICT", message: "Category has active envelopes" } },
        })
      const [, kind, target] = path.split("/"),
        id = target ? Number(target) : 50
      if (path.endsWith("/deactivate")) {
        if (kind === "institutions")
          institutions = institutions.map((item) =>
            item.id === id ? { ...item, is_active: 0 } : item,
          )
        else categories = categories.filter((item) => item.id !== id)
        return route.fulfill({ status: 204 })
      }
      if (kind === "institutions") {
        const item = {
          id,
          user_id: 1,
          name: String(body!.name),
          type: String(body!.type),
          is_active: 1,
        }
        institutions = [...institutions.filter((row) => row.id !== id), item]
        return route.fulfill({ status: target ? 200 : 201, json: item })
      }
      const item = {
        id,
        name: String(body!.name),
        parent_id: body!.parentId as number | null,
        is_active: 1,
      }
      categories = [...categories.filter((row) => row.id !== id), item]
      return route.fulfill({ status: target ? 200 : 201, json: item })
    }
    expect(request.method(), `Unexpected mutation ${path}`).toBe("GET")
    return route.abort()
  })
  return writes
}
async function ready(page: Page) {
  await expect(
    page.getByText(/Cargando ajustes|Cargando instituciones|Cargando categorías/),
  ).toHaveCount(0)
}

test("catalogs stay in settings and return to the originating workflow", async ({ page }) => {
  await catalogFixture(page)
  await page.goto("/accounts")
  await page.getByRole("link", { name: "Gestionar instituciones" }).click()
  await expect(page).toHaveURL(/\/institutions\?returnTo=%2Faccounts$/)
  await page.getByRole("link", { name: "Volver a Cuentas" }).click()
  await expect(page).toHaveURL(/\/accounts$/)
  await page.goto("/envelopes")
  await page.getByRole("link", { name: "Gestionar categorías" }).click()
  await page.getByRole("link", { name: "Volver a Sobres" }).click()
  await expect(page).toHaveURL(/\/envelopes$/)
  await expect(
    page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("link", { name: "Instituciones" }),
  ).toHaveCount(0)
  await page.goto("/categories?returnTo=https://evil.test")
  await expect(page.getByRole("link", { name: "Volver a Ajustes" })).toHaveAttribute(
    "href",
    "/settings",
  )
})

test("institution detail explains business blocks and never offers unsupported activation", async ({
  page,
}) => {
  await catalogFixture(page)
  await page.goto("/institutions")
  await page.getByRole("button", { name: "Ver Banco principal", exact: true }).click()
  await expect(
    page.getByText("Desactiva las cuentas activas antes de desactivar esta institución."),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Desactivar institución Banco principal" }),
  ).toBeDisabled()
  await page.getByLabel("Buscar instituciones").fill("archivada")
  await page.getByRole("button", { name: "Ver Archivada", exact: true }).click()
  await expect(
    page.getByRole("button", { name: /Activar institución|Desactivar institución/ }),
  ).toHaveCount(0)
  await expect(page.getByText("Esta institución ya está inactiva.")).toBeVisible()
})

test("missing dependency counts keep the catalog readable and deactivation unconfirmed", async ({
  page,
}) => {
  await catalogFixture(page, { countsFail: true })
  await page.goto("/institutions")
  await page.getByRole("button", { name: "Ver Reserva", exact: true }).click()
  await expect(page.getByText("Cuentas vinculadas por confirmar.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Desactivar institución Reserva" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Editar institución Reserva" })).toBeEnabled()
})

test("metadata create/edit/deactivate use confirmed server IDs with keyboard focus return", async ({
  page,
}) => {
  const writes = await catalogFixture(page)
  await page.goto("/institutions")
  const add = page.getByRole("button", { name: "Añadir institución", exact: true })
  await add.click()
  await page.getByLabel("Nombre de la institución").fill("Nueva entidad")
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(add).toBeFocused()
  await page.getByRole("button", { name: "Ver Nueva entidad", exact: true }).click()
  await page.getByRole("button", { name: "Editar institución Nueva entidad" }).click()
  await page.getByLabel("Nombre de la institución").fill("Entidad renombrada")
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
  await page.getByRole("button", { name: "Ver Entidad renombrada", exact: true }).click()
  await page.getByRole("button", { name: "Desactivar institución Entidad renombrada" }).click()
  await page.getByRole("button", { name: "Confirmar desactivación" }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  expect(writes.map((item) => [item.method, item.path])).toEqual([
    ["POST", "/institutions"],
    ["PATCH", "/institutions/50"],
    ["POST", "/institutions/50/deactivate"],
  ])
  expect(writes[0].body).toEqual({ userId: 1, name: "Nueva entidad", type: "BANK" })
})

test("uncertain creation keeps the draft, blocks duplication and requires explicit verification", async ({
  page,
}) => {
  const writes = await catalogFixture(page, { write: "lost" })
  await page.goto("/categories")
  await page.getByRole("button", { name: "Añadir categoría", exact: true }).click()
  await page.getByLabel("Nombre de la categoría").fill("Resultado incierto")
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
  await expect(
    page.getByRole("dialog").getByText("Resultado por confirmar", { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Guardar cambios", exact: true })).toBeDisabled()
  await expect(page.getByLabel("Nombre de la categoría")).toHaveValue("Resultado incierto")
  expect(writes).toHaveLength(1)
  await page.getByRole("button", { name: "Cancelar", exact: true }).click()
  await expect(page.getByRole("button", { name: "Añadir categoría", exact: true })).toBeDisabled()
  await page.getByRole("button", { name: "Actualizar catálogo" }).click()
  await expect(page.getByRole("button", { name: "Añadir categoría", exact: true })).toBeEnabled()
  await expect(page.getByRole("button", { name: "Ver Resultado incierto" })).toHaveCount(0)
})

test("category search traverses collapsed groups and preserves ancestry and parent restrictions", async ({
  page,
}) => {
  const writes = await catalogFixture(page)
  await page.goto("/categories")
  await page.getByRole("button", { name: "Contraer Necesidades" }).click()
  await expect(page.getByRole("button", { name: "Ver Teléfono", exact: true })).toHaveCount(0)
  await page.getByLabel("Buscar categorías").fill("telefono")
  await expect(page.getByRole("button", { name: "Ver Teléfono", exact: true })).toContainText(
    "Necesidades / Casa / Teléfono",
  )
  await page.getByRole("button", { name: "Limpiar búsqueda" }).click()
  await page.getByRole("button", { name: "Ver Necesidades", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Desactivar categoría Necesidades" }),
  ).toBeDisabled()
  await page.getByRole("button", { name: "Editar categoría Necesidades" }).click()
  await page.getByRole("button", { name: "Categoría principal", exact: true }).click()
  await expect(page.getByRole("option", { name: /Necesidades|Casa|Teléfono/ })).toHaveCount(0)
  await page.getByRole("option", { name: "Ocio", exact: true }).click()
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
  await expect(
    page.getByText("No puedes mover una categoría principal con subcategorías activas.", {
      exact: true,
    }),
  ).toBeVisible()
  expect(writes).toHaveLength(0)
})

test("category conflicts surface the active-envelope business rule and preserve the record", async ({
  page,
}) => {
  const writes = await catalogFixture(page, { write: "conflict" })
  await page.goto("/categories")
  await page.getByRole("button", { name: "Ver Ocio", exact: true }).click()
  await page.getByRole("button", { name: "Desactivar categoría Ocio" }).click()
  await page.getByRole("button", { name: "Confirmar desactivación" }).click()
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    /sobres|relaciones|No pudimos/,
  )
  await expect(page.getByRole("dialog")).toBeVisible()
  expect(writes).toHaveLength(1)
})

test("read failures never masquerade as an empty catalog", async ({ page }) => {
  await catalogFixture(page, { categoriesFail: true })
  await page.goto("/categories")
  await expect(page.locator("main").getByRole("alert")).toContainText("Catálogo no disponible")
  await expect(page.getByText("Todavía no hay categorías")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Añadir categoría", exact: true })).toBeDisabled()
})

test("settings navigation preserves drafts and lazily mounts cash/payroll sections", async ({
  page,
}) => {
  const writes = await catalogFixture(page)
  const requests: string[] = []
  page.on("request", (request) => {
    if (request.url().includes("/api/")) requests.push(new URL(request.url()).pathname)
  })
  await page.goto("/settings")
  await ready(page)
  expect(requests.some((path) => /payroll|cash-denominations/.test(path))).toBe(false)
  await page.getByLabel("Nombre", { exact: true }).fill("Borrador conservado")
  const nav = page.getByRole("navigation", { name: "Secciones de ajustes" })
  await nav.getByRole("link", { name: "Automatización", exact: true }).click()
  await expect(page).toHaveURL(/section=rules$/)
  await expect(page.getByRole("list", { name: "Reglas configuradas" })).toContainText("Contiene")
  await nav.getByRole("link", { name: "Perfil y preferencias" }).click()
  await page.getByRole("button", { name: "Actualizar", exact: true }).click()
  await ready(page)
  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Borrador conservado")
  expect(writes).toHaveLength(0)
})

test("an automation outage leaves profile, catalogs and payroll reachable", async ({ page }) => {
  await catalogFixture(page, { rulesFail: true })
  await page.goto("/settings")
  await ready(page)
  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Perfil de prueba")
  await expect(page.getByLabel("Nombre", { exact: true })).toBeEnabled()
  await page
    .getByRole("navigation", { name: "Secciones de ajustes" })
    .getByRole("link", { name: "Automatización" })
    .click()
  await expect(page.getByRole("button", { name: "Nueva regla", exact: true })).toBeDisabled()
  await expect(page.getByText("No hay reglas configuradas", { exact: true })).toHaveCount(0)
})

test("the tester names the selected rule, destination and priority without creating records", async ({
  page,
}) => {
  const writes = await catalogFixture(page)
  await page.goto("/settings?section=rules")
  await ready(page)
  await page.getByLabel("Descripción del movimiento").fill("Netflix mensual")
  await page.getByRole("button", { name: "Probar reglas activas" }).click()
  const result = page.getByRole("status").filter({ hasText: "Regla seleccionada:" })
  await expect(result).toContainText("Netflix")
  await expect(result).toContainText("Cuenta de prueba · Suscripciones")
  await expect(result).toContainText("Prioridad: 10")
  await page.getByLabel("Descripción del movimiento").fill("Otra descripción")
  await expect(result).toHaveCount(0)
  expect(writes).toEqual([
    {
      method: "POST",
      path: "/auto-assignment-rules/test",
      body: { userId: 1, description: "Netflix mensual" },
    },
  ])
})

test("a delayed tester response is discarded after the description changes", async ({ page }) => {
  await catalogFixture(page)
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let seen = false
  await page.route("**/api/auto-assignment-rules/test", async (route) => {
    seen = true
    await gate
    await route.fulfill({
      json: { description: "Netflix anterior", matched: true, matchedRule: rule, matches: [rule] },
    })
  })
  await page.goto("/settings?section=rules")
  await page.getByLabel("Descripción del movimiento").fill("Netflix anterior")
  await page.getByRole("button", { name: "Probar reglas activas" }).click()
  await expect.poll(() => seen).toBe(true)
  await page.getByLabel("Descripción del movimiento").fill("Nueva descripción")
  release()
  await expect(page.getByRole("button", { name: "Probar reglas activas" })).toBeEnabled()
  await expect(page.getByText("Regla seleccionada:")).toHaveCount(0)
})

test("fractional rule priorities cannot be silently saved", async ({ page }) => {
  const writes = await catalogFixture(page)
  await page.goto("/settings?section=rules")
  await page.getByRole("button", { name: "Editar regla Netflix" }).click()
  await page.getByLabel("Prioridad", { exact: true }).fill("1.5")
  await page.getByRole("button", { name: "Guardar regla", exact: true }).click()
  await expect(page.getByText(/Introduce un patrón, una prioridad entera/)).toBeVisible()
  expect(writes).toHaveLength(0)
})

test("cash and versioned payroll keep validations and drafts through settings navigation", async ({
  page,
}) => {
  const writes = await catalogFixture(page)
  await page.goto("/settings?section=cash")
  await ready(page)
  await page.getByRole("button", { name: /Nueva denominación/ }).click()
  await page.getByLabel("Valor", { exact: true }).fill("0")
  await page.getByRole("button", { name: "Crear denominación", exact: true }).click()
  await expect(page.getByText("El valor debe ser mayor que cero.")).toBeVisible()
  await page.getByLabel("Etiqueta", { exact: true }).fill("Billete borrador")
  const nav = page.getByRole("navigation", { name: "Secciones de ajustes" })
  await nav.getByRole("link", { name: "Nómina", exact: true }).click()
  await page.getByRole("button", { name: "Nueva versión", exact: true }).first().click()
  await page.getByLabel("Nombre de la regla", { exact: true }).fill("CCSS futura")
  await page.getByLabel("Tasa del trabajador", { exact: true }).fill("2")
  await page.getByRole("button", { name: "Crear regla", exact: true }).click()
  await expect(page.getByText("La tasa del trabajador debe estar entre 0 y 1.")).toBeVisible()
  await nav.getByRole("link", { name: "Efectivo", exact: true }).click()
  await expect(page.getByLabel("Etiqueta", { exact: true })).toHaveValue("Billete borrador")
  await nav.getByRole("link", { name: "Nómina", exact: true }).click()
  await expect(page.getByLabel("Nombre de la regla", { exact: true })).toHaveValue("CCSS futura")
  expect(writes).toHaveLength(0)
})

test("category creation and edit preserve the selected parent and confirmed ID", async ({
  page,
}) => {
  const writes = await catalogFixture(page)
  await page.goto("/categories")
  await page.getByRole("button", { name: "Añadir categoría", exact: true }).click()
  await page.getByLabel("Nombre de la categoría").fill("Nueva hija")
  await page.getByRole("button", { name: "Categoría principal", exact: true }).click()
  await page.getByRole("option", { name: "Ocio", exact: true }).click()
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
  await page.getByRole("button", { name: "Ver Nueva hija", exact: true }).click()
  await expect(page.getByRole("region", { name: "Detalle de Nueva hija" })).toContainText(
    "Ocio / Nueva hija",
  )
  await page.getByRole("button", { name: "Editar categoría Nueva hija" }).click()
  await page.getByLabel("Nombre de la categoría").fill("Hija renombrada")
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Ver Hija renombrada", exact: true }),
  ).toContainText("Ocio / Hija renombrada")
  expect(writes.map((item) => [item.method, item.path, item.body?.parentId])).toEqual([
    ["POST", "/categories", 4],
    ["PATCH", "/categories/50", 4],
  ])
})

test("rule creation and status change keep their existing metadata-only contracts", async ({
  page,
}) => {
  const writes = await catalogFixture(page)
  await page.goto("/settings?section=rules")
  await page.getByRole("button", { name: "Nueva regla", exact: true }).click()
  await page.getByLabel("Patrón", { exact: true }).fill("Salario")
  await page.getByLabel("Prioridad", { exact: true }).fill("5")
  await page.getByRole("combobox", { name: "Cuenta", exact: true }).click()
  await page.getByRole("option", { name: "Cuenta de prueba (CRC)", exact: true }).click()
  await page.getByRole("button", { name: "Crear regla", exact: true }).click()
  await expect(page.getByRole("list", { name: "Reglas configuradas" })).toContainText("Salario")
  await page.getByRole("switch", { name: "Regla activa: Salario", exact: true }).click()
  await expect(
    page.getByRole("switch", { name: "Regla activa: Salario", exact: true }),
  ).not.toBeChecked()
  expect(writes.map((item) => [item.method, item.path])).toEqual([
    ["POST", "/auto-assignment-rules"],
    ["PATCH", "/auto-assignment-rules/52/status"],
  ])
  expect(writes[0].body).toMatchObject({
    pattern: "Salario",
    matchType: "CONTAINS",
    accountId: 1,
    accountEnvelopeId: null,
    priority: 5,
    isActive: true,
  })
})

for (const kind of ["institutions", "categories"] as const)
  for (const colorScheme of ["light", "dark"] as const) {
    test(`390px 200% ${colorScheme} ${kind}: editor, selector and focus are accessible`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 1000 })
      await page.emulateMedia({ colorScheme })
      await catalogFixture(page)
      await page.goto(`/${kind}`)
      await ready(page)
      await page.addStyleTag({ content: "html { font-size: 200% !important; }" })
      const add = page.getByRole("button", {
        name: kind === "institutions" ? "Añadir institución" : "Añadir categoría",
        exact: true,
      })
      await add.click()
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
      expect(
        result.violations.map((item) => ({
          id: item.id,
          nodes: item.nodes.map((node) => node.target),
        })),
      ).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        391,
      )
      await page
        .getByRole("button", {
          name: kind === "institutions" ? "Tipo de institución" : "Categoría principal",
          exact: true,
        })
        .click()
      await expect(page.getByRole("combobox")).toBeVisible()
      await page.keyboard.press("Escape")
      await expect(page.getByRole("combobox")).toHaveCount(0)
      await page.keyboard.press("Escape")
      await expect(page.getByRole("dialog")).toHaveCount(0)
      await expect(add).toBeFocused()
    })
  }

for (const width of [390, 1440])
  for (const colorScheme of ["light", "dark"] as const)
    for (const scale of [100, 200]) {
      for (const path of ["/settings?section=rules", "/institutions", "/categories"]) {
        test(`${width} ${colorScheme} ${scale}% ${path}: responsive Marea and accessibility`, async ({
          page,
        }, info) => {
          await page.setViewportSize({ width, height: 1000 })
          await page.emulateMedia({ colorScheme })
          await catalogFixture(page)
          await page.goto(path)
          await ready(page)
          await page.addStyleTag({ content: `html { font-size: ${scale}% !important; }` })
          const main = page.locator("#main-content")
          await expect(main.locator("h1")).toHaveCount(1)
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(width + 1)
          const violations = (
            await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
          ).violations
          expect(
            violations.map((item) => ({
              id: item.id,
              nodes: item.nodes.map((node) => node.target),
            })),
          ).toEqual([])
          if (width === 1440 && scale === 100)
            await page.screenshot({ path: info.outputPath("marea.png") })
        })
      }
    }

for (const section of ["profile", "cash", "payroll"]) {
  test(`390px dark 200% ${section}: settings modules remain usable`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 1000 })
    await page.emulateMedia({ colorScheme: "dark" })
    await catalogFixture(page)
    await page.goto(`/settings?section=${section}`)
    await ready(page)
    await expect(page.getByText(/Cargando reglas|Cargando denominaciones/)).toHaveCount(0)
    await page.addStyleTag({
      content: "html { font-size: 200% !important; font-family: Verdana, sans-serif !important; }",
    })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391)
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze()
    expect(
      result.violations.map((item) => ({
        id: item.id,
        nodes: item.nodes.map((node) => node.target),
      })),
    ).toEqual([])
  })
}

for (const moveFocus of [false, true])
  test(`catalog delayed refresh restores focus without stealing user navigation ${moveFocus}`, async ({
    page,
  }) => {
    await catalogFixture(page)
    let reads = 0,
      release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route("**/api/institutions", async (route) => {
      if (route.request().method() === "GET" && ++reads > 1) await gate
      await route.fallback()
    })
    await page.goto("/institutions")
    const add = page.getByRole("button", { name: "Añadir institución", exact: true })
    await add.click()
    await page.getByLabel("Nombre de la institución").fill("Foco de prueba")
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(page.locator("#main-content")).toBeFocused()
    const navigation = page
      .getByRole("navigation", { name: "Secciones de ajustes" })
      .getByRole("link", { name: "Perfil y preferencias" })
    if (moveFocus) await navigation.focus()
    release()
    await expect(add).toBeEnabled()
    await expect(moveFocus ? navigation : add).toBeFocused()
  })
