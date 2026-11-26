import { act, cleanup, fireEvent, render } from "@testing-library/react"
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  redactUsageUrl,
  UsageAnalytics,
  UsageContext,
  useUsageTask,
} from "@/components/usage-analytics"
import type { UsageEvent } from "@/lib/usage-events"

const sdk = vi.hoisted(() => ({ inject: vi.fn(), track: vi.fn() }))
vi.mock("@vercel/analytics", () => sdk)
vi.mock("next/navigation", () => ({ usePathname: () => "/budgets/plans/PRIVATE-ID" }))

function Flow({ active = true }: { active?: boolean }) {
  const task = useUsageTask("movement", active)
  return (
    <>
      <button onClick={task.submit}>Submit</button>
      <button onClick={() => task.finish("completed")}>Complete</button>
    </>
  )
}
async function settle() {
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  sdk.inject.mockReset()
  sdk.track.mockReset()
  Object.defineProperty(navigator, "doNotTrack", { configurable: true, get: () => null })
  Object.defineProperty(navigator, "globalPrivacyControl", { configurable: true, get: () => false })
  vi.spyOn(document, "referrer", "get").mockReturnValue("")
  sdk.inject.mockImplementation(() => {
    const script = document.createElement("script")
    script.src = "/_vercel/insights/script.js"
    document.head.append(script)
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  document.querySelectorAll('script[src="/_vercel/insights/script.js"]').forEach((s) => s.remove())
})

describe("usage transport and React lifecycle", () => {
  it("does not invent a start or abandonment when the provider appears during an existing task", async () => {
    const sink = vi.fn()
    const view = render(
      <UsageContext.Provider value={null}>
        <Flow />
      </UsageContext.Provider>,
    )
    await settle()
    fireEvent.click(view.getByText("Submit"))
    view.rerender(
      <UsageContext.Provider value={sink}>
        <Flow />
      </UsageContext.Provider>,
    )
    await settle()
    view.unmount()
    await settle()
    expect(sink).not.toHaveBeenCalled()
  })
  it("emits once under StrictMode and does not call completion an abandonment", async () => {
    const sink = vi.fn(),
      view = render(
        <React.StrictMode>
          <UsageContext.Provider value={sink}>
            <Flow />
          </UsageContext.Provider>
        </React.StrictMode>,
      )
    await settle()
    fireEvent.click(view.getByText("Submit"))
    fireEvent.click(view.getByText("Submit"))
    fireEvent.click(view.getByText("Complete"))
    view.unmount()
    await settle()
    expect(sink.mock.calls.map(([e]) => e.name)).toEqual([
      "task_start",
      "task_submit",
      "task_finish",
    ])
  })
  it("differentiates cancellation, in-flight pagehide and return from bfcache", async () => {
    const events: UsageEvent[] = [],
      sink = (e: UsageEvent) => events.push(e)
    const view = render(
      <UsageContext.Provider value={sink}>
        <Flow />
      </UsageContext.Provider>,
    )
    await settle()
    view.rerender(
      <UsageContext.Provider value={sink}>
        <Flow active={false} />
      </UsageContext.Provider>,
    )
    await settle()
    expect(events.at(-1)?.name).toBe("task_abandon")
    view.rerender(
      <UsageContext.Provider value={sink}>
        <Flow />
      </UsageContext.Provider>,
    )
    await settle()
    fireEvent.click(view.getByText("Submit"))
    fireEvent(window, new Event("pagehide"))
    fireEvent(window, new Event("pagehide"))
    expect(events.at(-1)).toEqual({
      name: "task_finish",
      data: { task: "movement", result: "uncertain" },
    })
    fireEvent.click(view.getByText("Complete"))
    expect(events.filter((e) => e.name === "task_finish")).toHaveLength(1)
  })
  it("does not load or queue analytics outside the explicit platform opt-in", async () => {
    render(
      <UsageAnalytics enabled={false}>
        <Flow />
      </UsageAnalytics>,
    )
    await settle()
    fireEvent.click(document.querySelector("button")!)
    expect(sdk.inject).not.toHaveBeenCalled()
    expect(sdk.track).not.toHaveBeenCalled()
  })
  it.each(["referrer", "dnt", "gpc"])("suppresses all analytics for %s", async (mode) => {
    if (mode === "referrer")
      vi.spyOn(document, "referrer", "get").mockReturnValue("https://bank.invalid/private-account")
    if (mode === "dnt") vi.spyOn(navigator, "doNotTrack", "get").mockReturnValue("1")
    if (mode === "gpc")
      vi.spyOn(
        navigator as Navigator & { globalPrivacyControl: boolean },
        "globalPrivacyControl",
        "get",
      ).mockReturnValue(true)
    render(
      <UsageAnalytics enabled>
        <Flow />
      </UsageAnalytics>,
    )
    await settle()
    expect(sdk.inject).not.toHaveBeenCalled()
  })
  it("waits for the script, sends only enums and disables automatic views", async () => {
    const view = render(
      <UsageAnalytics enabled>
        <Flow />
      </UsageAnalytics>,
    )
    await settle()
    expect(sdk.track).not.toHaveBeenCalled()
    fireEvent.load(document.querySelector('script[src="/_vercel/insights/script.js"]')!)
    await settle()
    fireEvent.click(view.getByText("Submit"))
    fireEvent.click(view.getByText("Complete"))
    expect(sdk.inject).toHaveBeenCalledWith(
      expect.objectContaining({ disableAutoTrack: true, debug: false, mode: "production" }),
    )
    expect(sdk.track.mock.calls).toEqual([
      ["za_screen_view", { screen: "budgets" }],
      ["za_task_start", { task: "movement" }],
      ["za_task_submit", { task: "movement" }],
      ["za_task_finish", { task: "movement", result: "completed" }],
    ])
    expect(JSON.stringify(sdk.track.mock.calls)).not.toMatch(
      /PRIVATE-ID|amount|account|description|userId/,
    )
  })
  it("discards automatic pageviews and strips path, query and fragment of custom events", () => {
    expect(redactUsageUrl({ type: "pageview", url: "https://app.invalid/private" })).toBeNull()
    expect(
      redactUsageUrl({
        type: "event",
        url: "https://app.invalid/accounts/123?token=SECRET#description",
      }),
    ).toEqual({ type: "event", url: "https://app.invalid/usage" })
    expect(redactUsageUrl({ type: "event", url: "invalid" })).toBeNull()
  })
})
