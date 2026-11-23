import { expect, test } from "@playwright/test"

import { installSyntheticAPI } from "./fixtures"

test("review fixtures reject remote origins before installing interception", async ({ page }) => {
  for (const origin of [
    "https://example.com",
    "http://192.168.31.76:3101",
    "https://127.0.0.1:3212",
  ])
    await expect(installSyntheticAPI(page, "current", { origin })).rejects.toThrow(
      "Review fixtures are restricted to HTTP loopback",
    )
})

test("default fixtures remain local and block outbound requests with the real clock enabled", async ({
  page,
}) => {
  await installSyntheticAPI(page, "current", { fixedClock: false })
  await page.goto("/accounts")
  await expect(page.getByText("Cuenta de prueba", { exact: true }).first()).toBeVisible()
  const result = await page.evaluate(async () => {
    try {
      await fetch("https://example.com/fixture-must-not-leave-loopback")
      return "unexpected network access"
    } catch {
      return "blocked"
    }
  })
  expect(result).toBe("blocked")
})
