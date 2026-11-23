import { expect, test } from "@playwright/test"

import { installSyntheticAPI } from "./fixtures"

test("partial batch retries only the explicitly reviewed rejection and retains an uncertain receipt across reload", async ({
  page,
}) => {
  await installSyntheticAPI(page)
  const sent: string[] = []
  let rejectedOnce = false
  await page.route("**/api/transactions", async (route) => {
    if (route.request().method() === "GET") return route.fallback()
    const body = route.request().postDataJSON()
    expect(body.date).toBe("2026-11-01")
    expect(body.lines).toHaveLength(1)
    expect(body.lines[0].amount).toBe(-1000.01)
    sent.push(body.description)
    if (body.description === "RECHAZADO" && !rejectedOnce) {
      rejectedOnce = true
      return route.fulfill({ status: 400, json: { error: { code: "VALIDATION_ERROR" } } })
    }
    if (body.description === "INCIERTO") return route.fulfill({ status: 503, json: {} })
    return route.fulfill({ status: 201, json: { id: body.description === "CONFIRMADO" ? 91 : 92 } })
  })
  const text = ["CONFIRMADO", "RECHAZADO", "INCIERTO"]
    .map((name) => `01/11/2026\n12:00:00\n${name}\n₡1,000.01\n₡10,000.00`)
    .join("\n")
  const process = async () => {
    await page.getByLabel("Pegar movimientos", { exact: true }).fill(text)
    await page.getByRole("button", { name: "Procesar movimientos", exact: true }).click()
    for (const index of [1, 2, 3])
      await page.getByLabel(`Seleccionar movimiento ${index}`, { exact: true }).check()
    await page.getByLabel("Cuenta para selección", { exact: true }).selectOption("1")
    await expect(page.getByLabel("Sobre para selección").locator("option")).toHaveCount(4)
    await page.getByLabel("Sobre para selección").selectOption("1")
    await page.getByRole("button", { name: "Aplicar a compatibles", exact: true }).click()
  }
  const confirm = async () => {
    await page.getByRole("button", { name: /Revisar importación/ }).click()
    await page.getByRole("button", { name: "Confirmar importación", exact: true }).click()
  }
  await page.goto("/transactions/import")
  await process()
  await confirm()
  await expect(page.getByText("Importado · #91", { exact: true })).toBeVisible()
  await expect(
    page.getByText("Rechazado: corrige los datos antes de reintentar.", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText("Resultado incierto: revisa Movimientos.", { exact: true }),
  ).toBeVisible()
  expect(sent).toEqual(["CONFIRMADO", "RECHAZADO", "INCIERTO"])
  // The fixture fixes the clock; explicitly dismiss feedback instead of waiting for its timer.
  await page.getByRole("button", { name: "Cerrar notificación", exact: true }).click()
  await page
    .getByRole("row")
    .filter({ hasText: "RECHAZADO" })
    .getByRole("button", { name: "Revisé Movimientos: autorizar otro intento" })
    .click()
  await confirm()
  await expect(page.getByText("Importado · #92", { exact: true })).toBeVisible()
  expect(sent).toEqual(["CONFIRMADO", "RECHAZADO", "INCIERTO", "RECHAZADO"])
  await page.reload()
  await process()
  await confirm()
  await expect(
    page.getByText("Coincidencia pendiente de revisión: no se envió.", { exact: true }),
  ).toHaveCount(2)
  await expect(
    page.getByText("Resultado incierto: revisa Movimientos antes de decidir.", { exact: true }),
  ).toBeVisible()
  expect(sent).toEqual(["CONFIRMADO", "RECHAZADO", "INCIERTO", "RECHAZADO"])
})

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
