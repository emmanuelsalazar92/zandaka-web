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
