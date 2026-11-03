import { defineConfig } from "@playwright/test"

// Deliberately local and isolated: tests never target testing/production or reuse another server.
const baseURL = "http://127.0.0.1:3212"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    browserName: "chromium",
    locale: "es-CR",
    timezoneId: "America/Costa_Rica",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3212",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
