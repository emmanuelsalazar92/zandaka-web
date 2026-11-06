import { expect, test } from "@playwright/test"

import { installSyntheticAPI } from "./fixtures"
for (const path of [
  "/",
  "/transactions",
  "/accounts",
  "/envelopes",
  "/reconciliation",
  "/budgets",
  "/reports",
  "/settings",
]) {
  for (const state of ["loading", "error"] as const)
    test(`${path}: ${state} remains explicit and keeps the task heading`, async ({ page }) => {
      await installSyntheticAPI(page)
      await page.route("**/api/**", async (route) => {
        expect(route.request().method()).toBe("GET")
        if (state === "loading") return
        await route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE" } } })
      })
      await page.goto(path)
      await expect(page.locator("main h1")).toHaveCount(1)
      if (state === "error") await expect(page.locator('main [role="alert"]').first()).toBeVisible()
      else
        await expect(
          page.locator('main [role="status"],main [aria-busy="true"]').first(),
        ).toBeVisible()
    })
}
for (const reducedMotion of ["reduce", "no-preference"] as const)
  test(`motion ${reducedMotion}: controls keep focus and information`, async ({ page }) => {
    await installSyntheticAPI(page)
    await page.emulateMedia({ reducedMotion })
    await page.goto("/design-system")
    const button = page.locator('main [data-slot="button"]').first()
    await button.focus()
    await expect(button).toBeFocused()
    const style = await button.evaluate((node) => ({
      transition: getComputedStyle(node).transitionDuration,
      name: node.textContent,
    }))
    if (reducedMotion === "reduce") expect(style.transition).toBe("0s")
    else expect(style.transition).not.toBe("0s")
    expect(style.name?.trim()).not.toBe("")
    if (reducedMotion === "reduce")
      expect(
        await page
          .locator(".animate-spin")
          .first()
          .evaluate((node) => getComputedStyle(node).animationName),
      ).toBe("none")
  })
test("profile save is exclusive and the draft and recovery remain visible after failure", async ({
  page,
}) => {
  await installSyntheticAPI(page)
  let release!: () => void,
    writes = 0
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/api/users/1", async (route) => {
    if (route.request().method() === "GET") return route.fallback()
    expect(route.request().method()).toBe("PUT")
    writes++
    await gate
    await route.fulfill({ status: 503, json: {} })
  })
  await page.goto("/settings")
  await page.getByLabel("Nombre", { exact: true }).fill("Mi borrador")
  await page.getByRole("button", { name: "Guardar perfil", exact: true }).click()
  const save = page.getByRole("button", { name: "Guardar perfil", exact: true })
  await expect(save).toHaveAttribute("aria-busy", "true")
  await expect(save).toBeDisabled()
  await expect.poll(() => writes).toBe(1)
  release()
  await expect(page.getByText("Perfil por revisar", { exact: true }).first()).toBeVisible()
  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Mi borrador")
  await expect(
    page.getByRole("button", { name: "Consultar perfil guardado", exact: true }),
  ).toBeVisible()
  expect(writes).toBe(1)
})
test("report generation blocks Escape while pending and requires verification after uncertainty", async ({
  page,
}) => {
  await installSyntheticAPI(page)
  let release!: () => void,
    writes = 0
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/api/reports/generate", async (route) => {
    expect(route.request().method()).toBe("POST")
    writes++
    await gate
    await route.fulfill({ status: 503, json: {} })
  })
  await page.goto("/reports")
  await page.getByRole("button", { name: "Generar reporte", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("combobox", { name: "Origen de la cotización", exact: true }).click()
  await page.getByRole("option", { name: /manual/i }).click()
  await dialog.locator('input[inputmode="decimal"]').fill("500")
  await dialog.getByRole("button", { name: "Generar reporte", exact: true }).click()
  await expect(
    dialog.getByRole("button", { name: "Generar reporte", exact: true }),
  ).toHaveAttribute("aria-busy", "true")
  await page.keyboard.press("Escape")
  await expect(dialog).toBeVisible()
  expect(writes).toBe(1)
  release()
  await expect(dialog.getByText("Generación por revisar", { exact: true })).toBeVisible()
  await expect(dialog.getByRole("button", { name: "Generar reporte", exact: true })).toBeDisabled()
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click()
  await page.getByRole("button", { name: "Actualizar archivo", exact: true }).click()
  await expect(page.getByRole("button", { name: "Generar reporte", exact: true })).toBeEnabled()
  expect(writes).toBe(1)
})
for (const [path, emptyText] of [
  ["/accounts", "Todavía no hay cuentas"],
  ["/envelopes", "Primero, una cuenta"],
  ["/budgets", "Tu próximo mes empieza aquí"],
  ["/reports", "Todavía no hay reportes"],
])
  test(`${path}: confirmed empty data stays distinct from failure`, async ({ page }) => {
    await installSyntheticAPI(page)
    await page.route("**/api/reports/account-balances**", (route) => route.fulfill({ json: [] }))
    await page.goto(path)
    await expect(page.getByText(emptyText, { exact: true })).toBeVisible()
    await expect(page.locator('main [role="alert"]')).toHaveCount(0)
  })
