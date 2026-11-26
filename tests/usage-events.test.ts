import { describe, expect, it, vi } from "vitest"

import {
  createUsageTask,
  safeUsageEvent,
  usageScreen,
  usageTasks,
  type UsageEvent,
} from "@/lib/usage-events"
import { usageReport } from "@/lib/usage-report"

describe("privacy-first usage catalog", () => {
  it.each(["/budgets/plans/private-id", "/budgets/12345"])(
    "maps %s without exposing identifiers",
    (path) => {
      expect(usageScreen(path)).toBe("budgets")
    },
  )
  it("never uses query, fragment or unknown paths as event properties", () => {
    expect(usageScreen("/institutions")).toBe("institutions")
    expect(usageScreen("/categories")).toBe("categories")
    expect(usageScreen("/transactions/import")).toBe("import")
    expect(usageScreen("/unknown/private-name?amount=12#secret")).toBe("other")
  })
  it.each([
    { name: "task_start", data: { task: "movement", amount: 3370 } },
    { name: "screen_view", data: { screen: "/accounts/123" } },
    { name: "task_error", data: { task: "movement", reason: "Banco secreto" } },
    { name: "task_finish", data: { task: "import", result: "completed", description: "SALARIO" } },
    { name: "task_start", data: { task: "import" }, userId: 1 },
    { name: "arbitrary", data: { task: "import" } },
    { name: "task_finish", data: { task: "import", result: { toString: () => "completed" } } },
    null,
    [],
  ])("rejects uncatalogued payload %#", (event) => expect(safeUsageEvent(event)).toBeNull())
  it.each(usageTasks)("deduplicates start, submit and terminal actions for %s", (task) => {
    const events: UsageEvent[] = [],
      tracker = createUsageTask(task, (e) => events.push(e))
    tracker.start()
    tracker.start()
    tracker.submit()
    tracker.submit()
    tracker.finish("completed")
    tracker.finish("completed")
    tracker.leave()
    expect(events).toEqual([
      { name: "task_start", data: { task } },
      { name: "task_submit", data: { task } },
      { name: "task_finish", data: { task, result: "completed" } },
    ])
  })
  it("distinguishes a corrected retry, partial result, abandonment and in-flight departure", () => {
    const sink = vi.fn(),
      task = createUsageTask("import", sink)
    task.start()
    task.submit()
    task.error("rejected")
    task.error("rejected")
    task.submit()
    task.finish("partial")
    task.leave()
    task.start()
    task.leave()
    task.leave()
    task.submit()
    task.leave()
    task.finish("completed")
    expect(sink.mock.calls.map(([e]) => e)).toEqual([
      { name: "task_start", data: { task: "import" } },
      { name: "task_submit", data: { task: "import" } },
      { name: "task_error", data: { task: "import", reason: "rejected" } },
      { name: "task_submit", data: { task: "import" } },
      { name: "task_finish", data: { task: "import", result: "partial" } },
      { name: "task_start", data: { task: "import" } },
      { name: "task_abandon", data: { task: "import" } },
      { name: "task_start", data: { task: "import" } },
      { name: "task_submit", data: { task: "import" } },
      { name: "task_finish", data: { task: "import", result: "uncertain" } },
    ])
  })
  it("measurement failures cannot throw into financial operations", () => {
    const task = createUsageTask("movement", () => {
      throw Error("unavailable")
    })
    expect(() => {
      task.start()
      task.submit()
      task.finish("completed")
      task.leave()
    }).not.toThrow()
  })
})

describe("period reports", () => {
  const period = { from: "2026-11-26T06:00:00.000Z", to: "2026-11-27T06:00:00.000Z" }
  it("does not replace absence of a provider with zero traffic", () => {
    expect(usageReport({ ...period, source: "unavailable" })).toMatchObject({
      views: null,
      tasks: null,
      errors: null,
      rates: null,
    })
  })
  it("separates views, tasks, errors and denominators with an exclusive upper bound", () => {
    const events: UsageEvent[] = [{ name: "screen_view", data: { screen: "transactions" } }]
    const task = createUsageTask("movement", (e) => events.push(e))
    task.start()
    task.submit()
    task.error("rejected")
    task.submit()
    task.finish("completed")
    const report = usageReport({
      ...period,
      source: "synthetic",
      rows: [
        ...events.map((event) => ({ at: period.from, event })),
        { at: period.to, event: events[0] },
      ],
    })
    expect(report.source).toBe("synthetic")
    expect(report.views?.transactions).toBe(1)
    expect(report.tasks?.movement).toEqual({
      starts: 1,
      submissions: 2,
      completed: 1,
      partial: 0,
      uncertain: 0,
      abandoned: 0,
    })
    expect(report.errors?.movement).toEqual({ rejected: 1, local: 0 })
    expect(report.rates?.movement).toEqual({
      completedPerStart: 1,
      abandonedPerStart: 0,
      errorsPerSubmission: 0.5,
    })
    expect(report.rates?.import.completedPerStart).toBeNull()
  })
  it("rejects raw or contaminated exports rather than retaining them", () => {
    expect(() =>
      usageReport({
        ...period,
        source: "verified_export",
        rows: [
          {
            at: period.from,
            event: { name: "task_start", data: { task: "budget_save", accountName: "SECRET" } },
          },
        ],
      }),
    ).toThrow()
    expect(() =>
      usageReport({
        ...period,
        source: "synthetic",
        rows: [{ at: period.from, event: {}, ip: "127.0.0.1" }],
      }),
    ).toThrow()
  })
  it("requires an explicit, ordered UTC range", () => {
    expect(() => usageReport({ ...period, from: period.to, source: "unavailable" })).toThrow()
    expect(() => usageReport({ ...period, from: "2026-11-26", source: "unavailable" })).toThrow()
    expect(() => usageReport({ ...period, source: "verified_export" })).toThrow()
    expect(() =>
      usageReport({ ...period, from: "2026-02-30T06:00:00.000Z", source: "unavailable" }),
    ).toThrow()
  })
})
