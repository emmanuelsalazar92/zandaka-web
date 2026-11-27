"use client"

import { ArrowRight, Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"

import { PageHeader } from "@/components/page-header"
import { ProjectAnalysisPanel } from "@/components/project-analysis"
import { ProjectMovements } from "@/components/project-movements"
import { ProjectPdfDownload } from "@/components/project-pdf-download"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Feedback, LoadingState } from "@/components/ui/feedback"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ACCOUNTING_TIME_ZONE } from "@/lib/date-only"
import {
  changeProject,
  createProject,
  getProject,
  listProjects,
  ProjectRequestError,
  type Project,
  type ProjectAction,
  type ProjectBreakdownFilter,
  type ProjectPage,
  type ProjectView,
} from "@/lib/project-api"
import { useProjectRead } from "@/lib/use-project-read"
import { secureUuid } from "@/lib/uuid"

const controls = "min-h-11"
const surface = "marea-surface min-w-0 space-y-6 rounded-2xl bg-background p-4 sm:p-7"

const states = (project: Project) => (project.finalizedAt ? "Finalizado" : "Activo")
const projectDateFormatter = new Intl.DateTimeFormat("es-CR", {
  dateStyle: "medium",
  timeZone: ACCOUNTING_TIME_ZONE,
})

function ProjectDate({ value }: { value: string }) {
  return <time dateTime={value}>{projectDateFormatter.format(new Date(value))}</time>
}

function ProjectRowMetadata({ project }: { project: Project }) {
  const [label, date] = project.archivedAt
    ? ["Archivado el", project.archivedAt]
    : project.finalizedAt
      ? ["Cerrado el", project.finalizedAt]
      : ["Creado el", project.createdAt]

  return (
    <p className="text-sm text-muted-foreground">
      {states(project)} · {label} <ProjectDate value={date} />
    </p>
  )
}

function readMessage(error: unknown) {
  if (error instanceof ProjectRequestError) {
    if (error.status === 404) return "Este proyecto no está disponible."
    if (error.status === 503 && error.code === "FEATURE_NOT_READY")
      return "Proyectos aún no está habilitado en este entorno."
  }
  return "No pudimos consultar Proyectos. Intenta de nuevo."
}

const actions = {
  rename: ["Editar título", "El título aparecerá en la lista y el detalle.", "Guardar título"],
  finalize: [
    "Finalizar proyecto",
    "Registraremos la fecha de cierre. Podrás reabrir el proyecto si aparece un gasto más adelante.",
    "Finalizar",
  ],
  reopen: ["Reabrir proyecto", "El proyecto volverá a Activo y podrás editarlo.", "Reabrir"],
  archive: [
    "Archivar proyecto",
    "Lo encontrarás en Archivados y conservará su estado actual.",
    "Archivar",
  ],
  restore: [
    "Restaurar proyecto",
    "Volverá a la lista principal con su estado actual.",
    "Restaurar",
  ],
  create: ["Nuevo proyecto", "Elige un título que te ayude a reconocerlo.", "Crear proyecto"],
} as const
type DialogAction = keyof typeof actions

function ProjectDialog({
  action,
  project,
  onClose,
  onSaved,
  onRefresh,
  returnFocus,
}: {
  action: DialogAction
  project?: Project
  onClose: () => void
  onSaved: (project: Project) => void
  onRefresh?: () => void
  returnFocus: () => void
}) {
  const [title, setTitle] = React.useState(project?.title ?? "")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")
  const [needsReview, setNeedsReview] = React.useState(false)
  const [retryTitle, setRetryTitle] = React.useState<string>()
  const pending = React.useRef(false)
  const creationKey = React.useRef<string | undefined>(undefined)
  const titleId = React.useId()
  const editingTitle = action === "create" || action === "rename"
  const [heading, info, submitLabel] = actions[action]

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (pending.current || needsReview || (editingTitle && !title.trim())) return
    pending.current = true
    setBusy(true)
    setError("")
    try {
      if (action === "create") {
        creationKey.current ??= secureUuid()
        onSaved(await createProject(title.trim(), creationKey.current))
      } else if (project) {
        onSaved(await changeProject(project, action, title.trim()))
      }
    } catch (cause) {
      if (cause instanceof ProjectRequestError && cause.status === 409) {
        setNeedsReview(true)
        setError("El proyecto cambió mientras lo tenías abierto. Actualiza antes de continuar.")
      } else if (!(cause instanceof ProjectRequestError) || cause.status >= 500) {
        if (action === "create") {
          setRetryTitle(title.trim())
          setError(
            "No pudimos confirmar el resultado. Puedes reintentar esta misma creación sin duplicarla.",
          )
        } else {
          setNeedsReview(true)
          setError(
            "No pudimos confirmar el resultado. Actualiza para comprobar el estado del proyecto.",
          )
        }
      } else {
        setError("No pudimos guardar. Revisa el título o vuelve a abrir el proyecto.")
      }
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending.current) onClose()
      }}
    >
      <DialogContent
        className="marea-surface min-w-0"
        showCloseButton={!busy}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocus()
        }}
      >
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>{info}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="min-w-0 space-y-5">
          {editingTitle && (
            <div className="space-y-2">
              <Label htmlFor={titleId}>Título del proyecto</Label>
              <Input
                id={titleId}
                required
                maxLength={120}
                value={title}
                className={controls}
                onChange={(event) => setTitle(event.target.value)}
                readOnly={busy || !!retryTitle}
              />
            </div>
          )}
          {error && (
            <Feedback tone="error" title="Revisa el resultado">
              {error}
            </Feedback>
          )}
          <DialogFooter>
            <Button
              className={controls}
              variant="outline"
              type="button"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </Button>
            {needsReview && onRefresh ? (
              <Button className={controls} type="button" onClick={onRefresh}>
                Actualizar proyecto
              </Button>
            ) : (
              <Button
                className={controls}
                disabled={busy || needsReview || (editingTitle && !title.trim())}
              >
                {busy ? "Guardando…" : retryTitle ? "Reintentar creación" : submitLabel}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ProjectRows({
  page,
  view,
  onPage,
}: {
  page: ProjectPage
  view: ProjectView
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(page.total / page.pageSize))
  if (!page.items.length && page.page === 1) {
    return (
      <div className="rounded-2xl border border-dashed p-6">
        <h2 className="font-semibold">
          {view === "visible" ? "Aún no tienes proyectos" : "No hay proyectos archivados"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {view === "visible"
            ? "Crea uno para darle un lugar propio a una obra, una compra grande o una temporada de regalos."
            : "Los proyectos que archives aparecerán aquí."}
        </p>
      </div>
    )
  }
  return (
    <>
      <ul className="divide-y border-y">
        {page.items.map((project) => (
          <li key={project.id}>
            <Link
              href={`/projects/${project.id}`}
              className="group flex min-h-16 items-center gap-4 rounded-sm py-3 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium [overflow-wrap:anywhere]">{project.title}</p>
                <ProjectRowMetadata project={project} />
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      {(pages > 1 || page.page > 1) && (
        <nav aria-label="Páginas de proyectos" className="flex flex-wrap items-center gap-3">
          <Button
            className={controls}
            variant="outline"
            onClick={() => onPage(page.page - 1)}
            disabled={page.page <= 1}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            {page.page} de {Math.max(page.page, pages)}
          </span>
          <Button
            className={controls}
            variant="outline"
            onClick={() => onPage(page.page + 1)}
            disabled={page.page >= pages}
          >
            Siguiente
          </Button>
        </nav>
      )}
    </>
  )
}

export function ProjectsList() {
  const [view, setView] = React.useState<ProjectView>("visible")
  const [page, setPage] = React.useState(1)
  const [create, setCreate] = React.useState(false)
  const router = useRouter()
  const createTrigger = React.useRef<HTMLButtonElement>(null)
  const load = React.useCallback(
    (signal: AbortSignal) => listProjects(view, page, signal),
    [view, page],
  )
  const { result: read, retry: refresh } = useProjectRead(load)
  const result = read?.data
  const error = read && "error" in read ? readMessage(read.error) : null
  function move(nextView: ProjectView, nextPage: number) {
    setView(nextView)
    setPage(nextPage)
    refresh()
  }
  return (
    <div className={surface}>
      <PageHeader
        title="Proyectos"
        description="Vincula movimientos para seguir el costo de cada proyecto."
      >
        <Button
          className={controls}
          ref={createTrigger}
          disabled={!result}
          onClick={() => setCreate(true)}
        >
          <Plus aria-hidden="true" />
          Nuevo proyecto
        </Button>
      </PageHeader>
      <div className="flex flex-wrap gap-x-3 gap-y-1" role="group" aria-label="Vista de proyectos">
        {(
          [
            ["visible", "Sin archivar"],
            ["archived", "Archivados"],
          ] as const
        ).map(([nextView, label]) => (
          <Button
            key={nextView}
            variant="ghost"
            className="relative min-h-11 px-3 text-muted-foreground after:pointer-events-none after:absolute after:inset-x-3 after:bottom-0 after:border-primary aria-pressed:text-primary aria-pressed:after:border-b-2"
            aria-pressed={view === nextView}
            onClick={() => {
              if (view !== nextView) move(nextView, 1)
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      {!read && <LoadingState>Cargando proyectos…</LoadingState>}
      {error && (
        <Feedback tone="error" title="Proyectos no disponible">
          {error}{" "}
          <Button className={controls} variant="outline" onClick={refresh}>
            Actualizar
          </Button>
        </Feedback>
      )}
      {result && <ProjectRows page={result} view={view} onPage={(value) => move(view, value)} />}
      {create && (
        <ProjectDialog
          action="create"
          returnFocus={() => createTrigger.current?.focus()}
          onClose={() => setCreate(false)}
          onSaved={(project) => {
            setCreate(false)
            router.push(`/projects/${project.id}`)
          }}
        />
      )}
    </div>
  )
}

export function ProjectDetail({ id }: { id: string }) {
  const [action, setAction] = React.useState<ProjectAction>()
  const [filter, setFilter] = React.useState<ProjectBreakdownFilter>()
  const movementHeadingId = React.useId()
  const heading = React.useRef<HTMLHeadingElement>(null)
  const actionTrigger = React.useRef<HTMLButtonElement>(null)
  const load = React.useCallback((signal: AbortSignal) => getProject(id, signal), [id])
  const { result: read, replace, retry: refresh } = useProjectRead(load)
  const project = read?.data
  const error = read && "error" in read ? readMessage(read.error) : null
  const available: ProjectAction[] = project?.archivedAt
    ? ["restore"]
    : project?.finalizedAt
      ? ["reopen", "archive"]
      : ["rename", "finalize", "archive"]
  return (
    <div className={surface}>
      <PageHeader
        title={project?.title ?? "Proyecto"}
        titleRef={heading}
        meta={
          project && (
            <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <div>
                <dt className="sr-only">Estado</dt>
                <dd className="font-medium text-foreground">
                  {states(project)}
                  {project.archivedAt ? " · Archivado" : ""}
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-1.5">
                <dt>Creado</dt>
                <dd className="text-foreground">
                  <ProjectDate value={project.createdAt} />
                </dd>
              </div>
              {project.finalizedAt && (
                <div className="flex flex-wrap gap-x-1.5">
                  <dt>Fecha de cierre</dt>
                  <dd className="text-foreground">
                    <ProjectDate value={project.finalizedAt} />
                  </dd>
                </div>
              )}
              {project.archivedAt && (
                <div className="flex flex-wrap gap-x-1.5">
                  <dt>Fecha de archivo</dt>
                  <dd className="text-foreground">
                    <ProjectDate value={project.archivedAt} />
                  </dd>
                </div>
              )}
            </dl>
          )
        }
      >
        {project && <ProjectPdfDownload key={project.id} id={project.id} />}
      </PageHeader>
      {!read && <LoadingState>Cargando proyecto…</LoadingState>}
      {error && (
        <Feedback tone="error" title="Proyecto no disponible">
          {error}{" "}
          <Button className={controls} variant="outline" onClick={refresh}>
            Actualizar
          </Button>
        </Feedback>
      )}
      {project && (
        <>
          <ProjectAnalysisPanel
            key={project.id}
            project={project}
            filter={filter}
            movementHeadingId={movementHeadingId}
            onSelect={(next) => {
              setFilter(next)
              if (next)
                requestAnimationFrame(() => document.getElementById(movementHeadingId)?.focus())
            }}
          />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Acciones del proyecto">
            {available.map((item) => (
              <Button
                key={item}
                className={controls}
                variant={
                  item === "rename" || item === "restore" || item === "reopen"
                    ? "default"
                    : "outline"
                }
                onClick={(event) => {
                  actionTrigger.current = event.currentTarget
                  setAction(item)
                }}
              >
                {actions[item][0]}
              </Button>
            ))}
          </div>
          <ProjectMovements
            key={`${project.id}:${filter?.currency ?? "all"}:${filter?.categoryId ?? "none"}`}
            project={project}
            filter={filter}
            headingId={movementHeadingId}
            onClearFilter={() => {
              setFilter(undefined)
              requestAnimationFrame(() => document.getElementById(movementHeadingId)?.focus())
            }}
            onProject={replace}
            onRefresh={refresh}
          />
          {action && (
            <ProjectDialog
              action={action}
              project={project}
              returnFocus={() => {
                if (actionTrigger.current?.isConnected) actionTrigger.current.focus()
                else heading.current?.focus()
              }}
              onClose={() => setAction(undefined)}
              onSaved={(value) => {
                replace(value)
                setAction(undefined)
              }}
              onRefresh={() => {
                setAction(undefined)
                refresh()
              }}
            />
          )}
        </>
      )}
    </div>
  )
}
