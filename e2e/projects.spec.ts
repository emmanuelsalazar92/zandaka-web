import { expect, test } from "@playwright/test"

import { installSyntheticAPI } from "./fixtures"

test("Proyectos lifecycle at 390 px with a lost creation response", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installSyntheticAPI(page)
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true })
  })
  const id = "00000000-0000-4000-8000-000000000115"
  const now = "2026-11-26T18:00:00.000Z"
  const requests: string[] = []
  let project = {
    id,
    title: "",
    revision: 1,
    createdAt: now,
    updatedAt: now,
    archivedAt: null as string | null,
    finalizedAt: null as string | null,
  }
  await page.route(/\/api\/projects(?:\/[^?]*)?(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    if (method === "GET") {
      if (url.pathname.endsWith("/analysis"))
        return route.fulfill({
          json: {
            project,
            calculatedAt: now,
            latestLedgerUpdateAt: null,
            excludedLineCount: 0,
            currencies: [],
          },
        })
      if (url.pathname.endsWith("/movements"))
        return route.fulfill({ json: { project, items: [], total: 0, page: 1, pageSize: 20 } })
      if (url.pathname !== "/api/projects") return route.fulfill({ json: project })
      const archived = url.searchParams.get("view") === "archived"
      const items = project.title && !!project.archivedAt === archived ? [project] : []
      return route.fulfill({ json: { items, total: items.length, page: 1, pageSize: 20 } })
    }
    const body = route.request().postDataJSON()
    expect(body.userId).toBeUndefined()
    if (url.pathname === "/api/projects") {
      requests.push(body.requestId)
      project = { ...project, title: body.title }
      if (requests.length === 1) return route.abort("failed")
      expect(requests).toEqual([body.requestId, body.requestId])
      return route.fulfill({ status: 201, json: project })
    }
    expect(body.expectedRevision).toBe(project.revision)
    project.revision++
    const action = url.pathname.split("/").at(-1)
    if (method === "PATCH") project.title = body.title
    else if (action === "finalize") project.finalizedAt = now
    else if (action === "archive") project.archivedAt = now
    else if (action === "restore") project.archivedAt = null
    else if (action === "reopen") project.finalizedAt = null
    else throw new Error("Unexpected project operation")
    return route.fulfill({ json: project })
  })

  await page.goto("/projects")
  await expect(page.getByText("Aún no tienes proyectos")).toBeVisible()
  const create = page.getByRole("button", { name: "Nuevo proyecto" })
  await create.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(create).toBeFocused()
  await create.click()
  await page.getByLabel("Título del proyecto").fill("Construcción del lote")
  await page.getByRole("button", { name: "Crear proyecto", exact: true }).click()
  await expect(page.getByLabel("Título del proyecto")).toHaveAttribute("readonly", "")
  await page.getByRole("button", { name: "Reintentar creación" }).click()
  await expect(page.getByRole("heading", { name: "Construcción del lote" })).toBeVisible()

  const confirm = async (open: string, submit: string) => {
    await page.getByRole("button", { name: open, exact: true }).click()
    await page.getByRole("dialog").getByRole("button", { name: submit, exact: true }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
  }
  const longTitle = "Construcción del lote " + "A".repeat(85)
  await page.getByRole("button", { name: "Editar título" }).click()
  await page.getByLabel("Título del proyecto").fill(longTitle)
  await page.getByRole("button", { name: "Guardar título" }).click()
  await expect(page.getByRole("heading", { name: longTitle })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await confirm("Finalizar proyecto", "Finalizar")
  await expect(page.getByText("Fecha de cierre")).toBeVisible()
  await expect(page.getByRole("button", { name: "Editar título" })).toHaveCount(0)
  await confirm("Archivar proyecto", "Archivar")
  await page.reload()
  await expect(page.getByText("Finalizado · Archivado")).toBeVisible()
  await page.getByRole("main").getByRole("link", { name: "Proyectos", exact: true }).click()
  await expect(page.getByText("Aún no tienes proyectos")).toBeVisible()
  await page.getByRole("button", { name: "Archivados" }).click()
  await page.getByRole("link", { name: new RegExp(longTitle) }).click()
  await confirm("Restaurar proyecto", "Restaurar")
  await expect(page.getByText("Fecha de cierre")).toBeVisible()
  await confirm("Reabrir proyecto", "Reabrir")
  await expect(page.getByRole("button", { name: "Editar título" })).toBeVisible()
})

test("Proyectos links split movements and explicitly marked refunds at 390 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installSyntheticAPI(page)
  const id = "00000000-0000-4000-8000-000000000116"
  const now = "2026-11-26T18:00:00.000Z"
  const project = {
    id,
    title: "Construcción del lote",
    revision: 1,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    finalizedAt: null as string | null,
  }
  const first = {
    lineId: 11,
    transactionId: 100,
    date: "2026-11-20",
    description: "Compra de materiales",
    accountId: 1,
    accountName: "Lote CRC",
    categoryId: 1,
    categoryName: "Materiales",
    currency: "CRC",
    amount: "-100",
  }
  const lines = [
    first,
    { ...first, lineId: 12, categoryId: 2, categoryName: "Permisos", amount: "-50" },
    { ...first, lineId: 13, transactionId: 101, description: "Devolución", amount: "20" },
  ]
  const linked = new Map<number, "expense" | "refund">()
  const submitted: number[][] = []
  let lostResponse = true
  let findError = true
  await page.route(new RegExp(`/api/projects/${id}(?:/[^?]*)?(?:\\?.*)?$`), async (route) => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    const endpoint = url.pathname.split("/").at(-1)
    if (endpoint === "analysis")
      return route.fulfill({
        json: {
          project,
          calculatedAt: now,
          latestLedgerUpdateAt: null,
          excludedLineCount: 0,
          currencies: [],
        },
      })
    if (endpoint === "movement-filters") {
      return route.fulfill({
        json: {
          accounts: [{ id: 1, name: "Lote CRC", currency: "CRC" }],
          categories: [
            { id: 1, name: "Materiales" },
            { id: 2, name: "Permisos" },
          ],
          currencies: ["CRC"],
        },
      })
    }
    if (endpoint === "movement-search") {
      if (findError) {
        findError = false
        return route.fulfill({ status: 500, json: {} })
      }
      const refund = url.searchParams.get("kind") === "refund"
      const q = url.searchParams.get("q")
      const selected = refund ? lines.slice(2) : lines.slice(0, 2)
      const [movement] = selected
      const matched = !q || q === `#${movement.transactionId}` || movement.description.includes(q)
      if (q === "#100") {
        expect(url.searchParams.get("accountId")).toBe("1")
        expect(url.searchParams.get("categoryId")).toBe("1")
        expect(url.searchParams.get("currency")).toBe("CRC")
        expect(url.searchParams.get("from")).toBe("2026-11-01")
      }
      return route.fulfill({
        json: {
          items: matched
            ? [
                {
                  id: movement.transactionId,
                  date: movement.date,
                  description: movement.description,
                  lines: selected.map((line) => ({
                    ...line,
                    linkedKind: linked.get(line.lineId) ?? null,
                  })),
                },
              ]
            : [],
          total: matched ? 1 : 0,
          page: 1,
          pageSize: 20,
        },
      })
    }
    if (endpoint === "movements") {
      if (method === "GET") {
        const items = lines.flatMap((line) => {
          const kind = linked.get(line.lineId)
          return kind ? [{ ...line, kind, eligible: true }] : []
        })
        return route.fulfill({
          json: { project, items, total: items.length, page: 1, pageSize: 20 },
        })
      }
      const body = route.request().postDataJSON()
      expect(body.userId).toBeUndefined()
      submitted.push(body.lineIds)
      let changed = false
      for (const lineId of body.lineIds) {
        if (method === "DELETE") changed = linked.delete(lineId) || changed
        else if (!linked.has(lineId)) {
          linked.set(lineId, body.kind)
          changed = true
        }
      }
      if (changed) {
        expect(body.expectedRevision).toBe(project.revision)
        project.revision++
      }
      if (lostResponse) {
        lostResponse = false
        return route.abort("failed")
      }
      return route.fulfill({ json: project })
    }
    if (endpoint === "finalize") {
      expect(route.request().postDataJSON().expectedRevision).toBe(project.revision)
      project.revision++
      project.finalizedAt = now
    }
    return route.fulfill({ json: project })
  })

  await page.goto(`/projects/${id}`)
  const open = page.getByRole("button", { name: "Vincular movimientos" })
  await open.focus()
  await page.keyboard.press("Enter")
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText("No pudimos buscar movimientos")).toBeVisible()
  await dialog.getByRole("button", { name: "Reintentar" }).click()
  await dialog.getByLabel("Descripción o #ID").fill("materiales")
  await dialog.getByRole("button", { name: "Buscar", exact: true }).click()
  await expect(dialog.getByText("Compra de materiales")).toBeVisible()
  await dialog.getByRole("checkbox", { name: /Materiales/ }).focus()
  await page.keyboard.press("Space")
  await expect(dialog.getByText("1 línea seleccionada")).toBeVisible()
  await dialog.getByRole("button", { name: "Vincular selección" }).click()
  await expect(dialog.getByText(/No pudimos confirmar el vínculo/)).toBeVisible()
  await dialog.getByRole("button", { name: "Vincular selección" }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText("1 línea vinculada")).toBeVisible()
  expect(submitted).toEqual([[11], [11]])

  await open.click()
  await dialog.getByText("Filtrar por fecha, cuenta, categoría o moneda").click()
  await dialog.getByLabel("Cuenta").selectOption("1")
  await dialog.getByLabel("Categoría").selectOption("1")
  await dialog.getByLabel("Moneda").selectOption("CRC")
  await dialog.getByLabel("Desde").fill("2026-11-01")
  await dialog.getByLabel("Descripción o #ID").fill("#100")
  await dialog.getByRole("button", { name: "Buscar", exact: true }).click()
  await expect(dialog.getByText("Ya vinculado")).toBeVisible()
  await dialog.getByRole("button", { name: "Seleccionar movimiento completo" }).click()
  await dialog.getByRole("button", { name: "Vincular selección" }).click()
  await expect(page.getByText("2 líneas vinculadas")).toBeVisible()
  expect(submitted.at(-1)).toEqual([12])

  await open.click()
  await dialog.getByLabel("Tipo de vínculo").selectOption("refund")
  await dialog.getByRole("checkbox", { name: /Materiales/ }).check()
  await dialog.getByRole("button", { name: "Vincular como reembolso" }).click()
  await expect(page.getByText("3 líneas vinculadas")).toBeVisible()
  expect(linked.get(13)).toBe("refund")
  await page.getByRole("button", { name: "Quitar vínculo de la línea #12" }).click()
  await dialog.getByRole("button", { name: "Quitar vínculo", exact: true }).click()
  await expect(page.getByText("2 líneas vinculadas")).toBeVisible()
  expect(linked.has(12)).toBe(false)

  await page.getByRole("button", { name: "Finalizar proyecto" }).click()
  await dialog.getByRole("button", { name: "Finalizar", exact: true }).click()
  await expect(page.getByText("Fecha de cierre")).toBeVisible()
  await expect(open).toHaveCount(0)
  await expect(page.getByText("2 líneas vinculadas")).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
})
