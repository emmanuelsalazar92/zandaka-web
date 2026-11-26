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
  await page.route("**/api/projects**", async (route) => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    if (method === "GET") {
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
