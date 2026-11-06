import { expect, test } from "@playwright/test"

import { installSyntheticAPI } from "./fixtures"
for (const outcome of ["confirmed", "uncertain", "duplicates"] as const)
  test(`batch preserves ${outcome} rows and never resends them automatically`, async ({ page }) => {
    await installSyntheticAPI(page)
    let writes = 0
    await page.route("**/api/transactions", async (route) => {
      if (route.request().method() === "GET") return route.fallback()
      expect(route.request().method()).toBe("POST")
      expect(route.request().postDataJSON().lines[0].amount).toBe(-1000)
      writes++
      await route.fulfill(
        outcome === "confirmed" ? { status: 201, json: { id: 99 } } : { status: 503, json: {} },
      )
    })
    await page.goto("/transactions/import")
    await page
      .getByLabel("Pegar movimientos", { exact: true })
      .fill("01/11/2026\n12:00:00\nCOMPRA SINTETICA\n₡1,000.00\n₡10,000.00")
    await page.getByRole("button", { name: "Procesar movimientos", exact: true }).click()
    if (outcome === "duplicates") {
      await page.getByRole("button", { name: "Limpiar", exact: true }).click()
      await page
        .getByLabel("Pegar movimientos", { exact: true })
        .fill(
          "01/11/2026\n12:00:00\nCOMPRA SINTETICA\n₡1,000.00\n₡10,000.00\n01/11/2026\n12:00:00\nCOMPRA SINTETICA\n₡1,000.00\n₡10,000.00",
        )
      await page.getByRole("button", { name: "Procesar movimientos", exact: true }).click()
      await page.getByLabel("Seleccionar movimiento 2", { exact: true }).check()
    }
    await page.getByLabel("Seleccionar movimiento 1", { exact: true }).check()
    await page.getByLabel("Cuenta para selección", { exact: true }).selectOption("1")
    await expect(page.getByLabel("Sobre para selección").locator("option")).toHaveCount(4)
    await page.getByLabel("Sobre para selección").selectOption("1")
    await page.getByRole("button", { name: "Aplicar a compatibles", exact: true }).click()
    await page.getByRole("button", { name: /Revisar importación/ }).click()
    await expect(page.getByRole("region", { name: "Confirmación de importación" })).toContainText(
      outcome === "duplicates" ? "CRC: 2 movimientos" : "CRC: 1 movimientos",
    )
    expect(writes).toBe(0)
    await page.getByRole("button", { name: "Confirmar importación", exact: true }).click()
    if (outcome === "duplicates") {
      await expect(
        page.getByText("Coincidencia pendiente de revisión: no se envió.", { exact: true }),
      ).toHaveCount(2)
      expect(writes).toBe(0)
      return
    }
    await expect(
      page.getByText(
        outcome === "confirmed" ? "Importado · #99" : "Resultado incierto: revisa Movimientos.",
        { exact: true },
      ),
    ).toBeVisible()
    await expect(page.getByRole("button", { name: /Revisar importación/ })).toBeDisabled()
    expect(writes).toBe(1)
    await expect(
      page.getByRole("heading", { name: "Importar movimientos", exact: true }),
    ).toBeVisible()
  })
