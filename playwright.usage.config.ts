import { defineConfig } from "@playwright/test"

// A mock SDK endpoint and synthetic financial API only; never connects to Vercel or testing.
export default defineConfig({
  testDir: "./e2e-usage",
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3213",
    locale: "es-CR",
    timezoneId: "America/Costa_Rica",
    serviceWorkers: "block",
  },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3213",
    url: "http://127.0.0.1:3213",
    env: { VERCEL: "1", ZANDAKA_ANALYTICS_ENABLED: "true" },
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
