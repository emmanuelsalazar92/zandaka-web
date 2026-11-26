import { safeUsageEvent, usageScreens, usageTasks } from "@/lib/usage-events"

function validTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  )
}

/** Normalized, already-minimized exports only. Never feed raw provider exports into this. */
export function usageReport(input: {
  from: string
  to: string
  source: "unavailable" | "synthetic" | "verified_export"
  rows?: unknown[]
}) {
  const from = Date.parse(input.from),
    to = Date.parse(input.to)
  if (
    !validTimestamp(input.from) ||
    !validTimestamp(input.to) ||
    from >= to ||
    !input.from.endsWith("Z") ||
    !input.to.endsWith("Z")
  )
    throw new Error("Usa un intervalo UTC válido [desde, hasta).")
  const period = {
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    displayTimezone: "America/Costa_Rica",
  }
  if (input.source === "unavailable")
    return { source: input.source, period, views: null, tasks: null, errors: null, rates: null }
  if (!["synthetic", "verified_export"].includes(input.source) || !Array.isArray(input.rows))
    throw new Error("Indica una fuente válida y una exportación explícita.")
  const views = Object.fromEntries(usageScreens.map((screen) => [screen, 0]))
  const tasks = Object.fromEntries(
    usageTasks.map((task) => [
      task,
      { starts: 0, submissions: 0, completed: 0, partial: 0, uncertain: 0, abandoned: 0 },
    ]),
  )
  const errors = Object.fromEntries(usageTasks.map((task) => [task, { rejected: 0, local: 0 }]))
  for (const row of input.rows ?? []) {
    if (!row || typeof row !== "object" || Object.keys(row).sort().join() !== "at,event")
      throw new Error("Exportación fuera del catálogo permitido.")
    const { at, event } = row as { at: unknown; event: unknown }
    const safe = safeUsageEvent(event)
    if (!validTimestamp(at) || !safe) throw new Error("Exportación fuera del catálogo permitido.")
    if (Date.parse(at) < from || Date.parse(at) >= to) continue
    if (safe.name === "screen_view") {
      views[safe.data.screen]++
      continue
    }
    const task = tasks[safe.data.task]
    if (safe.name === "task_start") task.starts++
    else if (safe.name === "task_submit") task.submissions++
    else if (safe.name === "task_abandon") task.abandoned++
    else if (safe.name === "task_finish") task[safe.data.result]++
    else if (safe.name === "task_error") errors[safe.data.task][safe.data.reason]++
  }
  // Period counts, not cohorts. They may exceed 100% across period boundaries.
  const rates = Object.fromEntries(
    usageTasks.map((task) => [
      task,
      {
        completedPerStart: tasks[task].starts ? tasks[task].completed / tasks[task].starts : null,
        abandonedPerStart: tasks[task].starts ? tasks[task].abandoned / tasks[task].starts : null,
        errorsPerSubmission: tasks[task].submissions
          ? (errors[task].local + errors[task].rejected) / tasks[task].submissions
          : null,
      },
    ]),
  )
  return { source: input.source, period, views, tasks, errors, rates }
}
