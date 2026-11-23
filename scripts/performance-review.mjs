import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import fs from "node:fs"
import Module, { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { chromium, expect } from "@playwright/test"
import ts from "typescript"

// Development-only lab harness. No real backend, credentials, analytics or field telemetry.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const output = process.argv[2]
assert.ok(output, "Provide a new output JSON path; never overwrite a prior measurement")
assert.ok(!fs.existsSync(output), "The output already exists")
for (const revision of process.argv.slice(3, 5)) assert.match(revision, /^[a-f0-9]{40}$/)
assert.equal(process.argv.length, 5, "Use OUTPUT BEFORE_FULL_SHA AFTER_FULL_SHA")
const fixtureFile = path.join(root, "e2e/fixtures.ts")
const fixture = new Module(fixtureFile)
fixture.paths = createRequire(path.join(root, "package.json")).resolve.paths("@playwright/test")
fixture._compile(
  ts.transpileModule(fs.readFileSync(fixtureFile, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  fixtureFile,
)
const { installSyntheticAPI } = fixture.exports
const versions = {
  before: { origin: "http://127.0.0.1:3214", revision: process.argv[3], label: "before Atlantico" },
  after: { origin: "http://127.0.0.1:3215", revision: process.argv[4], label: "Marea plus ZA-107" },
}
const profiles = [
  { name: "desktop", width: 1440, height: 1000, cpu: 1, latency: 0, download: -1, upload: -1 },
  {
    name: "mobile-lab",
    width: 390,
    height: 844,
    cpu: 4,
    latency: 100,
    download: 200_000,
    upload: 100_000,
  },
]
const routes = ["/", "/transactions", "/reports"]
const samples = []
const browser = await chromium.launch()
try {
  // Warm server compilation/route caches equally; every measured browser context is fresh/cold.
  for (const version of Object.values(versions))
    for (const route of routes) {
      const context = await browser.newContext({ serviceWorkers: "block" })
      const page = await context.newPage()
      await installSyntheticAPI(page, "current", { origin: version.origin, fixedClock: false })
      await page.goto(version.origin + route, { waitUntil: "networkidle" })
      await context.close()
    }
  for (const profile of profiles)
    for (const route of routes)
      for (let iteration = 0; iteration < 5; iteration++) {
        // Alternate order to reduce thermal/order bias. Never run timed samples in parallel.
        for (const label of iteration % 2 ? ["after", "before"] : ["before", "after"]) {
          const version = versions[label]
          const context = await browser.newContext({
            viewport: { width: profile.width, height: profile.height },
            locale: "es-CR",
            timezoneId: "America/Costa_Rica",
            colorScheme: "light",
            reducedMotion: "reduce",
            serviceWorkers: "block",
          })
          const page = await context.newPage()
          const errors = []
          page.on("pageerror", (error) => errors.push(error.message))
          await installSyntheticAPI(page, "current", { origin: version.origin, fixedClock: false })
          await page.route("**/api/**", async (request) => {
            await new Promise((resolve) => setTimeout(resolve, 120))
            await request.fallback()
          })
          await page.addInitScript(() => {
            window.__lab = { lcp: 0, cls: 0, blocking: 0 }
            for (const type of ["largest-contentful-paint", "layout-shift", "longtask"])
              new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                  if (type === "largest-contentful-paint") window.__lab.lcp = entry.startTime
                  if (type === "layout-shift" && !entry.hadRecentInput)
                    window.__lab.cls += entry.value
                  if (type === "longtask") window.__lab.blocking += Math.max(0, entry.duration - 50)
                }
              }).observe({ type, buffered: true })
          })
          const session = await context.newCDPSession(page)
          await session.send("Network.enable")
          await session.send("Network.setCacheDisabled", { cacheDisabled: true })
          await session.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu })
          await session.send("Network.emulateNetworkConditions", {
            offline: false,
            latency: profile.latency,
            downloadThroughput: profile.download,
            uploadThroughput: profile.upload,
          })
          await page.goto(version.origin + route, { waitUntil: "networkidle" })
          await expect(page.getByText(/Cargando|Loading/)).toHaveCount(0)
          // A loading skeleton may contain no text. Require real fixture content as well.
          if (route === "/reports")
            await expect(page.getByText(/^(No reports yet|Todavía no hay reportes)$/)).toBeVisible()
          else
            await expect(page.getByText("Compra de prueba", { exact: true }).first()).toBeVisible()
          await page.waitForLoadState("networkidle")
          const initial = await page.evaluate(() => {
            const resources = performance.getEntriesByType("resource")
            return {
              fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null,
              ...window.__lab,
              ready: performance.now(),
              documentBytes: performance.getEntriesByType("navigation")[0].encodedBodySize,
              resources: resources.map((r) => ({
                path: new URL(r.name).pathname,
                transfer: r.transferSize,
                encoded: r.encodedBodySize,
                duration: r.duration,
              })),
            }
          })
          // Measure a shared real interaction: theme change, click event to two painted frames.
          await page.evaluate(() => {
            document.addEventListener(
              "click",
              () => {
                const start = performance.now()
                const observer = new MutationObserver(() => {
                  observer.disconnect()
                  requestAnimationFrame(() =>
                    requestAnimationFrame(() => {
                      window.__lab.themeInteraction = performance.now() - start
                    }),
                  )
                })
                observer.observe(document.documentElement, {
                  attributes: true,
                  attributeFilter: ["class"],
                })
              },
              { capture: true, once: true },
            )
          })
          await page.getByRole("button", { name: /^(Toggle theme|Cambiar apariencia)$/ }).click()
          await page.waitForFunction(() => Number.isFinite(window.__lab.themeInteraction))
          const themeInteraction = await page.evaluate(() => window.__lab.themeInteraction)
          assert.deepEqual(errors, [], `${label} ${route}: browser errors invalidate comparison`)
          samples.push({
            label,
            profile: profile.name,
            route,
            iteration,
            ...initial,
            themeInteraction,
          })
          console.log(
            `${label} ${profile.name} ${route} ${iteration + 1}/5: FCP ${Math.round(initial.fcp)}ms`,
          )
          fs.writeFileSync(output, JSON.stringify({ complete: false, samples }, null, 2))
          await context.close()
        }
      }
  const median = (values) => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)]
  const summary = []
  for (const profile of profiles)
    for (const route of routes)
      for (const label of Object.keys(versions)) {
        const group = samples.filter(
          (s) => s.profile === profile.name && s.route === route && s.label === label,
        )
        summary.push({
          label,
          profile: profile.name,
          route,
          samples: group.length,
          fcpMs: median(group.map((s) => s.fcp)),
          observedLcpMs: median(group.map((s) => s.lcp)),
          observedCls: median(group.map((s) => s.cls)),
          observedBlockingMs: median(group.map((s) => s.blocking)),
          themeInteractionMs: median(group.map((s) => s.themeInteraction)),
          assetBytes: median(
            group.map((s) =>
              s.resources
                .filter((r) => !r.path.startsWith("/api/") && !r.path.startsWith("/_vercel/"))
                .reduce((sum, r) => sum + r.encoded, 0),
            ),
          ),
          scriptBytes: median(
            group.map((s) =>
              s.resources
                .filter((r) => r.path.endsWith(".js"))
                .reduce((sum, r) => sum + r.encoded, 0),
            ),
          ),
          styleBytes: median(
            group.map((s) =>
              s.resources
                .filter((r) => r.path.endsWith(".css"))
                .reduce((sum, r) => sum + r.encoded, 0),
            ),
          ),
          imageBytes: median(
            group.map((s) =>
              s.resources
                .filter(
                  (r) => /\.(svg|png|webp|ico|jpg)$/.test(r.path) || r.path === "/_next/image",
                )
                .reduce((sum, r) => sum + r.encoded, 0),
            ),
          ),
          documentBytes: median(group.map((s) => s.documentBytes)),
        })
      }
  fs.writeFileSync(
    output,
    JSON.stringify(
      {
        complete: true,
        date: new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Costa_Rica",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date()),
        timezone: "America/Costa_Rica",
        environment: {
          platform: os.platform(),
          architecture: os.arch(),
          cpu: os.cpus()[0].model,
          logicalCpus: os.cpus().length,
          node: process.version,
          chromium: browser.version(),
        },
        method: {
          versions,
          profiles,
          routes,
          samplesPerCell: 5,
          order: "alternating, sequential",
          serverCache: "warm",
          browserCache: "disabled, new context",
          api: "same synthetic responses, fixed 120ms delay; no backend benchmark",
          compiler: "Next 16 webpack production, same installed runtime dependencies",
          fixtureSha256: createHash("sha256").update(fs.readFileSync(fixtureFile)).digest("hex"),
          installedLockSha256: createHash("sha256")
            .update(fs.readFileSync(path.join(root, "package-lock.json")))
            .digest("hex"),
          limitations:
            "Lab only; observed LCP/CLS/blocking in bounded load window and theme interaction are not field CWV/INP or human task times. No historical measurements were available; before is reconstructed from source.",
        },
        summary,
        samples,
      },
      null,
      2,
    ),
  )
} finally {
  await browser.close()
}
