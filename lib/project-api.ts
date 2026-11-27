import { z } from "zod"

const projectSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  revision: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  finalizedAt: z.string().datetime().nullable(),
  archivedAt: z.string().datetime().nullable(),
})
const pageSchema = z.object({
  items: z.array(projectSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
})

export type Project = z.infer<typeof projectSchema>
export type ProjectPage = z.infer<typeof pageSchema>
export type ProjectView = "visible" | "archived"
export type ProjectAction = "rename" | "finalize" | "reopen" | "archive" | "restore"

const identifier = z.number().int().positive().safe()
const kind = z.enum(["expense", "refund"])
const movementLine = z.object({
  lineId: identifier,
  transactionId: identifier,
  date: z.string(),
  description: z.string(),
  accountId: identifier,
  accountName: z.string(),
  categoryId: identifier.nullable(),
  categoryName: z.string().nullable(),
  currency: z.string(),
  amount: z.string().regex(/^-?\d+(?:\.\d+)?$/),
})
const linkedLine = movementLine.extend({ kind, eligible: z.boolean() })
const searchLine = movementLine.extend({ linkedKind: kind.nullable() })
const paging = pageSchema.omit({ items: true })
const projectMovements = paging.extend({ items: z.array(linkedLine), project: projectSchema })
const movementResults = paging.extend({
  items: z.array(
    z.object({
      id: identifier,
      date: z.string(),
      description: z.string(),
      lines: z.array(searchLine).min(1),
    }),
  ),
})
const option = z.object({ id: identifier, name: z.string() })
const movementFilters = z.object({
  accounts: z.array(option.extend({ currency: z.string() })),
  categories: z.array(option),
  currencies: z.array(z.string()),
})

export type ProjectMovementKind = z.infer<typeof kind>
export type LinkedProjectLine = z.infer<typeof linkedLine>
export type ProjectMovementSearch = {
  q: string
  kind: ProjectMovementKind
  from: string
  to: string
  accountId: string
  categoryId: string
  currency: string
}

export class ProjectRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super("Project request failed")
  }
}

async function request(path: string, init: RequestInit) {
  const response = await fetch("/api/projects" + path, {
    ...init,
    cache: "no-store",
    signal: init.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(15_000)])
      : AbortSignal.timeout(15_000),
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const failure = z.object({ error: z.object({ code: z.string() }) }).safeParse(payload)
    throw new ProjectRequestError(
      response.status,
      failure.success ? failure.data.error.code : undefined,
    )
  }
  return payload
}

export async function listProjects(view: ProjectView, page: number, signal: AbortSignal) {
  return pageSchema.parse(await request(`?view=${view}&page=${page}`, { signal }))
}

export async function getProject(id: string, signal: AbortSignal) {
  const project = projectSchema.parse(await request(`/${encodeURIComponent(id)}`, { signal }))
  if (project.id !== id) throw new Error("Unexpected project")
  return project
}

export async function createProject(title: string, requestId: string) {
  return projectSchema.parse(
    await request("", {
      method: "POST",
      body: JSON.stringify({ title, requestId }),
    }),
  )
}

export async function changeProject(project: Project, action: ProjectAction, title: string) {
  const rename = action === "rename"
  const updated = projectSchema.parse(
    await request(`/${encodeURIComponent(project.id)}${rename ? "" : "/" + action}`, {
      method: rename ? "PATCH" : "POST",
      body: JSON.stringify({
        expectedRevision: project.revision,
        ...(rename ? { title } : {}),
      }),
    }),
  )
  if (updated.id !== project.id || updated.revision !== project.revision + 1)
    throw new Error("Unexpected project confirmation")
  return updated
}

export async function listProjectMovements(id: string, page: number, signal: AbortSignal) {
  const result = projectMovements.parse(
    await request(`/${encodeURIComponent(id)}/movements?page=${page}`, { signal }),
  )
  if (result.project.id !== id) throw new Error("Unexpected project")
  return result
}

export async function projectMovementFilters(id: string, signal: AbortSignal) {
  return movementFilters.parse(
    await request(`/${encodeURIComponent(id)}/movement-filters`, { signal }),
  )
}

export async function searchProjectMovements(
  id: string,
  filters: ProjectMovementSearch,
  page: number,
  signal: AbortSignal,
) {
  const query = new URLSearchParams({ page: String(page) })
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value)
  return movementResults.parse(
    await request(`/${encodeURIComponent(id)}/movement-search?${query}`, { signal }),
  )
}

export async function changeProjectMovements(
  project: Project,
  lineIds: number[],
  kind?: ProjectMovementKind,
) {
  const updated = projectSchema.parse(
    await request(`/${encodeURIComponent(project.id)}/movements`, {
      method: kind ? "POST" : "DELETE",
      body: JSON.stringify({ expectedRevision: project.revision, lineIds, ...(kind && { kind }) }),
    }),
  )
  if (updated.id !== project.id || updated.revision < project.revision)
    throw new Error("Unexpected project confirmation")
  return updated
}
