/** Closed vocabulary: never pass form values, API errors or resource identifiers here. */
export const usageTasks = ["movement", "import", "reconciliation", "budget_save"] as const
export type UsageTask = (typeof usageTasks)[number]
export const usageScreens = [
  "dashboard",
  "transactions",
  "import",
  "accounts",
  "envelopes",
  "reconciliation",
  "budgets",
  "reports",
  "settings",
  "institutions",
  "categories",
  "other",
] as const
export type UsageScreen = (typeof usageScreens)[number]
export type UsageEvent =
  | { name: "screen_view"; data: { screen: UsageScreen } }
  | { name: "task_start" | "task_submit" | "task_abandon"; data: { task: UsageTask } }
  | {
      name: "task_finish"
      data: { task: UsageTask; result: "completed" | "partial" | "uncertain" }
    }
  | { name: "task_error"; data: { task: UsageTask; reason: "rejected" | "local" } }
export type UsageSink = (event: UsageEvent) => void

export function usageScreen(pathname: string): UsageScreen {
  if (pathname === "/") return "dashboard"
  if (pathname === "/transactions/import") return "import"
  for (const screen of usageScreens) {
    if (pathname === `/${screen}` || pathname.startsWith(`/${screen}/`)) return screen
  }
  return "other"
}

/** Rebuild instead of spreading input. Reject extra keys even on otherwise valid events. */
export function safeUsageEvent(input: unknown): UsageEvent | null {
  if (!input || typeof input !== "object") return null
  const record = input as Record<string, unknown>
  if (
    Object.keys(record).sort().join() !== "data,name" ||
    !record.data ||
    typeof record.data !== "object"
  )
    return null
  const data = record.data as Record<string, unknown>
  const keys = Object.keys(data).sort().join()
  if (
    record.name === "screen_view" &&
    keys === "screen" &&
    usageScreens.includes(data.screen as UsageScreen)
  )
    return { name: "screen_view", data: { screen: data.screen as UsageScreen } }
  if (!usageTasks.includes(data.task as UsageTask)) return null
  const task = data.task as UsageTask
  if (
    ["task_start", "task_submit", "task_abandon"].includes(record.name as string) &&
    keys === "task"
  )
    return { name: record.name as "task_start" | "task_submit" | "task_abandon", data: { task } }
  if (
    record.name === "task_finish" &&
    keys === "result,task" &&
    ["completed", "partial", "uncertain"].includes(data.result as string)
  )
    return {
      name: "task_finish",
      data: { task, result: data.result as "completed" | "partial" | "uncertain" },
    }
  if (
    record.name === "task_error" &&
    keys === "reason,task" &&
    ["rejected", "local"].includes(data.reason as string)
  )
    return { name: "task_error", data: { task, reason: data.reason as "rejected" | "local" } }
  return null
}

/** In-memory lifecycle only. No ID, storage, timer, retry or financial arguments. */
export function createUsageTask(task: UsageTask, sink: UsageSink) {
  let active = false,
    pending = false
  const emit = (event: UsageEvent) => {
    const safe = safeUsageEvent(event)
    try {
      if (safe) sink(safe)
    } catch {
      /* Measurement must never affect an operation. */
    }
  }
  const start = () => {
    if (active) return
    active = true
    emit({ name: "task_start", data: { task } })
  }
  const finish = (result: "completed" | "partial" | "uncertain") => {
    if (!active) return
    active = false
    pending = false
    emit({ name: "task_finish", data: { task, result } })
  }
  return {
    start,
    submit() {
      if (pending) return
      start()
      pending = true
      emit({ name: "task_submit", data: { task } })
    },
    finish,
    error(reason: "rejected" | "local") {
      if (!active || !pending) return
      pending = false
      emit({ name: "task_error", data: { task, reason } })
    },
    leave() {
      if (!active) return
      if (pending) {
        finish("uncertain")
        return
      }
      active = false
      emit({ name: "task_abandon", data: { task } })
    },
  }
}
