"use client"

import { Link2, Plus, Search } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState, Feedback, LoadingState } from "@/components/ui/feedback"
import { Input } from "@/components/ui/input"
import { formatSignedCurrency } from "@/lib/currency-formatter"
import { currencyDigits, decimal, decimalNumber } from "@/lib/money"
import {
  changeProjectMovements,
  listProjectMovements,
  projectMovementFilters,
  ProjectRequestError,
  searchProjectMovements,
  type LinkedProjectLine,
  type Project,
  type ProjectMovementSearch,
} from "@/lib/project-api"
import { useProjectRead } from "@/lib/use-project-read"

const limit = 100
const selectStyle =
  "border-control-border bg-background focus-visible:ring-ring h-11 w-full min-w-0 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
const initialSearch: ProjectMovementSearch = {
  q: "",
  kind: "expense",
  from: "",
  to: "",
  accountId: "",
  categoryId: "",
  currency: "",
}

function showAmount(amount: string, currency: string) {
  try {
    if (decimal(amount).dp() <= currencyDigits(currency))
      return formatSignedCurrency(decimalNumber(amount), currency)
  } catch {
    // Historical precision can exceed the numeric transport or currency display scale.
  }
  return `${currency} ${amount}`
}

function showDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : date
}

function Pager({
  info,
  onPage,
}: {
  info: { page: number; pageSize: number; total: number }
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(info.total / info.pageSize))
  if (info.page === 1 && pages === 1) return null
  return (
    <nav aria-label="Páginas de movimientos" className="flex flex-wrap items-center gap-2">
      <Button variant="outline" disabled={info.page <= 1} onClick={() => onPage(info.page - 1)}>
        Anterior
      </Button>
      <span className="text-sm text-muted-foreground">
        Página {info.page} de {pages}
      </span>
      <Button variant="outline" disabled={info.page >= pages} onClick={() => onPage(info.page + 1)}>
        Siguiente
      </Button>
    </nav>
  )
}

function ReadError({
  title,
  retry,
  children,
}: {
  title: string
  retry: () => void
  children?: React.ReactNode
}) {
  return (
    <Feedback
      tone="error"
      title={title}
      action={
        <Button variant="outline" onClick={retry}>
          Reintentar
        </Button>
      }
    >
      {children}
    </Feedback>
  )
}

function MovementSearch({
  project,
  onClose,
  onSaved,
  onRefresh,
  returnFocus,
}: {
  project: Project
  onClose: () => void
  onSaved: (project: Project) => void
  onRefresh: () => void
  returnFocus: () => void
}) {
  const [filters, setFilters] = React.useState(initialSearch)
  const [page, setPage] = React.useState(1)
  const [selected, setSelected] = React.useState<Set<number>>(() => new Set())
  const [formError, setFormError] = React.useState("")
  const [saveError, setSaveError] = React.useState("")
  const [conflict, setConflict] = React.useState(false)
  const [outcomeUnknown, setOutcomeUnknown] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const pending = React.useRef(false)
  const loadFilters = React.useCallback(
    (signal: AbortSignal) => projectMovementFilters(project.id, signal),
    [project.id],
  )
  const loadSearch = React.useCallback(
    (signal: AbortSignal) => searchProjectMovements(project.id, filters, page, signal),
    [project.id, filters, page],
  )
  const catalog = useProjectRead(loadFilters)
  const search = useProjectRead(loadSearch)
  const formId = React.useId()

  function searchFor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const next = { ...filters }
    for (const field of ["q", "from", "to", "accountId", "categoryId", "currency"] as const) {
      next[field] = String(data.get(field) ?? "").trim()
    }
    if (
      next.q.startsWith("#") &&
      (!/^#[1-9]\d*$/.test(next.q) || !Number.isSafeInteger(Number(next.q.slice(1))))
    ) {
      setFormError("Escribe un ID válido, por ejemplo #123.")
      return
    }
    if (next.from && next.to && next.from > next.to) {
      setFormError("La fecha inicial debe ser anterior o igual a la final.")
      return
    }
    setFormError("")
    setFilters(next)
    setPage(1)
  }

  function toggle(ids: number[]) {
    const next = new Set(selected)
    if (ids.every((id) => next.has(id))) {
      for (const id of ids) next.delete(id)
    } else {
      for (const id of ids) next.add(id)
    }
    if (next.size > limit) {
      setSaveError("Puedes vincular hasta 100 líneas por vez.")
      return
    }
    setSaveError("")
    setSelected(next)
  }

  async function save() {
    if (pending.current || !selected.size || conflict) return
    pending.current = true
    setBusy(true)
    setSaveError("")
    try {
      onSaved(await changeProjectMovements(project, [...selected], filters.kind))
    } catch (error) {
      if (error instanceof ProjectRequestError && error.status === 409) {
        setOutcomeUnknown(false)
        setConflict(true)
        setSaveError("El proyecto cambió. Actualízalo antes de vincular.")
      } else if (error instanceof ProjectRequestError && error.status === 400) {
        setOutcomeUnknown(false)
        setSaveError(
          "Alguna línea ya no se puede vincular. Repite la búsqueda y revisa tu selección.",
        )
        setSelected(new Set())
        search.retry()
      } else {
        setOutcomeUnknown(true)
        setSaveError("No pudimos confirmar el vínculo. Puedes reintentar la misma selección.")
      }
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  const dismiss = outcomeUnknown ? onRefresh : onClose
  const opts = catalog.result?.data
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending.current) dismiss()
      }}
    >
      <DialogContent
        className="marea-surface sm:max-w-2xl"
        showCloseButton={!busy}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocus()
        }}
      >
        <DialogHeader>
          <DialogTitle>Vincular movimientos</DialogTitle>
          <DialogDescription>
            Elige un movimiento completo o solo las líneas que pertenecen al proyecto.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={searchFor} className="space-y-3">
          <fieldset disabled={busy || conflict || outcomeUnknown} className="min-w-0 space-y-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_11rem]">
              <label className="space-y-1 text-sm font-medium">
                <span>Descripción o #ID</span>
                <Input name="q" placeholder="Materiales o #123" maxLength={1000} />
              </label>
              <label className="space-y-1 text-sm font-medium">
                <span>Tipo de vínculo</span>
                <select
                  name="kind"
                  className={selectStyle}
                  value={filters.kind}
                  onChange={(event) => {
                    setFilters({
                      ...filters,
                      kind: event.target.value === "refund" ? "refund" : "expense",
                    })
                    setSelected(new Set())
                    setPage(1)
                    setSaveError("")
                  }}
                >
                  <option value="expense">Gasto</option>
                  <option value="refund">Reembolso</option>
                </select>
              </label>
            </div>
            <details className="rounded-lg border px-3">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
                Filtrar por fecha, cuenta, categoría o moneda
              </summary>
              <div className="grid min-w-0 gap-3 py-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span>Desde</span>
                  <Input name="from" type="date" />
                </label>
                <label className="space-y-1 text-sm">
                  <span>Hasta</span>
                  <Input name="to" type="date" />
                </label>
                <label className="space-y-1 text-sm">
                  <span>Cuenta</span>
                  <select name="accountId" className={selectStyle} disabled={!opts}>
                    <option value="">Todas</option>
                    {opts?.accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} · {account.currency}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span>Categoría</span>
                  <select name="categoryId" className={selectStyle} disabled={!opts}>
                    <option value="">Todas</option>
                    {opts?.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span>Moneda</span>
                  <select name="currency" className={selectStyle} disabled={!opts}>
                    <option value="">Todas</option>
                    {opts?.currencies.map((currency) => (
                      <option key={currency}>{currency}</option>
                    ))}
                  </select>
                </label>
              </div>
            </details>
            <Button type="submit" variant="outline">
              <Search aria-hidden="true" />
              Buscar
            </Button>
          </fieldset>
          {formError && <Feedback tone="error" title={formError} />}
        </form>
        {catalog.result && "error" in catalog.result && (
          <ReadError title="No pudimos cargar los filtros de catálogo" retry={catalog.retry} />
        )}
        {!search.result && <LoadingState>Buscando movimientos…</LoadingState>}
        {search.result && "error" in search.result && (
          <ReadError title="No pudimos buscar movimientos" retry={search.retry} />
        )}
        {search.result?.data && (
          <section className="space-y-4" aria-label="Resultados de búsqueda">
            {search.result.data.items.length === 0 && (
              <EmptyState title="Sin coincidencias">
                Cambia la descripción, el ID o los filtros.
              </EmptyState>
            )}
            <ul className="divide-border divide-y">
              {search.result.data.items.map((item) => {
                const ids = item.lines
                  .filter((line) => !line.linkedKind)
                  .map(({ lineId }) => lineId)
                return (
                  <li key={item.id} className="space-y-2 py-3">
                    <div>
                      <p className="font-semibold break-words">
                        {item.description || "Movimiento sin descripción"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {showDate(item.date)} · #{item.id}
                      </p>
                    </div>
                    {item.lines.length > 1 && ids.length > 0 && (
                      <Button
                        variant="secondary"
                        disabled={busy || conflict || outcomeUnknown}
                        onClick={() => toggle(ids)}
                      >
                        {ids.every((id) => selected.has(id))
                          ? "Quitar selección del movimiento"
                          : "Seleccionar movimiento completo"}
                      </Button>
                    )}
                    <ul className="space-y-1">
                      {item.lines.map((line) => (
                        <li key={line.lineId}>
                          <label className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted">
                            <input
                              type="checkbox"
                              className="size-5 shrink-0 accent-primary"
                              checked={Boolean(line.linkedKind) || selected.has(line.lineId)}
                              disabled={
                                busy || conflict || outcomeUnknown || Boolean(line.linkedKind)
                              }
                              onChange={() => toggle([line.lineId])}
                            />
                            <span className="min-w-0 break-words text-sm">
                              <span className="font-medium tabular-nums">
                                {showAmount(line.amount, line.currency)}
                              </span>
                              <span className="block text-muted-foreground">
                                {line.accountName} · {line.categoryName ?? "Sin categoría"}
                              </span>
                              {line.linkedKind && (
                                <span className="block text-muted-foreground">
                                  Ya vinculado
                                  {line.linkedKind === "refund" ? " como reembolso" : ""}
                                </span>
                              )}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </li>
                )
              })}
            </ul>
            <Pager info={search.result.data} onPage={setPage} />
          </section>
        )}
        <div className="sticky bottom-0 space-y-2 border-t bg-card py-3">
          <p className="text-sm text-muted-foreground" id={formId} role="status">
            {selected.size} {selected.size === 1 ? "línea seleccionada" : "líneas seleccionadas"}
            {filters.kind === "refund" && " · Reembolso"}
          </p>
          {saveError && <Feedback tone="error" title={saveError} />}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={dismiss}>
              {outcomeUnknown ? "Cerrar y actualizar" : "Cancelar"}
            </Button>
            {conflict ? (
              <Button onClick={onRefresh}>Actualizar proyecto</Button>
            ) : (
              <Button aria-describedby={formId} disabled={busy || !selected.size} onClick={save}>
                {busy
                  ? "Vinculando…"
                  : filters.kind === "refund"
                    ? "Vincular como reembolso"
                    : "Vincular selección"}
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RemoveMovement({
  project,
  line,
  onClose,
  onSaved,
  onRefresh,
  returnFocus,
}: {
  project: Project
  line: LinkedProjectLine
  onClose: () => void
  onSaved: (project: Project) => void
  onRefresh: () => void
  returnFocus: () => void
}) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")
  const [conflict, setConflict] = React.useState(false)
  const [outcomeUnknown, setOutcomeUnknown] = React.useState(false)
  const pending = React.useRef(false)
  async function remove() {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError("")
    try {
      onSaved(await changeProjectMovements(project, [line.lineId]))
    } catch (error) {
      if (error instanceof ProjectRequestError && error.status === 409) {
        setOutcomeUnknown(false)
        setConflict(true)
        setError("El proyecto cambió. Actualízalo antes de quitar el vínculo.")
      } else {
        setOutcomeUnknown(true)
        setError("No pudimos confirmar el cambio. Intenta de nuevo.")
      }
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  const dismiss = outcomeUnknown ? onRefresh : onClose
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending.current) dismiss()
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocus()
        }}
      >
        <DialogHeader>
          <DialogTitle>Quitar vínculo</DialogTitle>
          <DialogDescription>
            Quitar {showAmount(line.amount, line.currency)} del movimiento #{line.transactionId} de
            este proyecto. El movimiento seguirá en tu historial.
          </DialogDescription>
        </DialogHeader>
        {error && <Feedback tone="error" title={error} />}
        <DialogFooter>
          <Button variant="outline" autoFocus disabled={busy} onClick={dismiss}>
            {outcomeUnknown ? "Cerrar y actualizar" : "Cancelar"}
          </Button>
          {conflict ? (
            <Button onClick={onRefresh}>Actualizar proyecto</Button>
          ) : (
            <Button disabled={busy} onClick={remove}>
              {busy ? "Quitando…" : "Quitar vínculo"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ProjectMovements({
  project,
  onProject,
  onRefresh,
}: {
  project: Project
  onProject: (value: Project) => void
  onRefresh: () => void
}) {
  const [page, setPage] = React.useState(1)
  const [dialog, setDialog] = React.useState<"search" | LinkedProjectLine>()
  const [notice, setNotice] = React.useState("")
  const heading = React.useRef<HTMLHeadingElement>(null)
  const trigger = React.useRef<HTMLButtonElement>(null)
  const id = React.useId()
  const load = React.useCallback(
    (signal: AbortSignal) => listProjectMovements(project.id, page, signal),
    [project.id, page],
  )
  const { result, retry } = useProjectRead(load, project.revision)
  const data = result?.data
  const canEdit = Boolean(data && !data.project.finalizedAt && !data.project.archivedAt)
  const returnFocus = () => {
    if (trigger.current?.isConnected) trigger.current.focus()
    else heading.current?.focus()
  }
  const saved = (value: Project) => {
    setNotice(dialog === "search" ? "Movimientos vinculados" : "Vínculo eliminado")
    onProject(value)
    setDialog(undefined)
    if (page !== 1) setPage(1)
    else retry()
  }
  const reload = () => {
    setDialog(undefined)
    onRefresh()
  }
  return (
    <section className="space-y-3 border-t pt-5" aria-labelledby={id}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 ref={heading} tabIndex={-1} id={id} className="text-lg font-semibold">
            Movimientos vinculados
          </h2>
          {data && (
            <p className="text-sm text-muted-foreground">
              {data.total} {data.total === 1 ? "línea vinculada" : "líneas vinculadas"}
            </p>
          )}
        </div>
        {canEdit && (
          <Button
            onClick={(event) => {
              trigger.current = event.currentTarget
              setNotice("")
              setDialog("search")
            }}
          >
            <Plus aria-hidden="true" />
            Vincular movimientos
          </Button>
        )}
      </div>
      {notice && <Feedback tone="success" title={notice} />}
      {!result && <LoadingState>Cargando vínculos…</LoadingState>}
      {result?.error instanceof ProjectRequestError && result.error.status === 503 ? (
        <Feedback title="Vínculos de movimientos aún no habilitados">
          Este entorno necesita preparar el almacenamiento de vínculos.
        </Feedback>
      ) : result?.error ? (
        <ReadError title="No pudimos cargar los vínculos" retry={retry} />
      ) : null}
      {data && (
        <>
          {data.items.length === 0 && (
            <EmptyState title="Sin movimientos en esta página">
              {canEdit
                ? "Usa Vincular movimientos para incluir gastos o reembolsos."
                : "Los movimientos vinculados aparecerán aquí."}
            </EmptyState>
          )}
          <ul className="divide-border divide-y">
            {data.items.map((line) => (
              <li
                key={line.lineId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <Link2 aria-hidden="true" className="mt-1 size-4 shrink-0 text-marea-teal-ink" />
                  <div className="min-w-0 break-words">
                    <p className="font-medium">
                      {line.description || "Movimiento sin descripción"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {showDate(line.date)} · #{line.transactionId} · {line.accountName} ·{" "}
                      {line.categoryName ?? "Sin categoría"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {line.kind === "refund" ? "Reembolso" : "Gasto"}
                      {!line.eligible && " · Ya no computa"}
                    </p>
                  </div>
                </div>
                <span className="font-semibold tabular-nums">
                  {showAmount(line.amount, line.currency)}
                </span>
                {canEdit && (
                  <Button
                    variant="ghost"
                    aria-label={`Quitar vínculo de la línea #${line.lineId}`}
                    onClick={(event) => {
                      trigger.current = event.currentTarget
                      setNotice("")
                      setDialog(line)
                    }}
                  >
                    Quitar
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <Pager info={data} onPage={setPage} />
        </>
      )}
      {dialog === "search" && data && (
        <MovementSearch
          project={data.project}
          onClose={() => setDialog(undefined)}
          onSaved={saved}
          onRefresh={reload}
          returnFocus={returnFocus}
        />
      )}
      {dialog && dialog !== "search" && data && (
        <RemoveMovement
          project={data.project}
          line={dialog}
          onClose={() => setDialog(undefined)}
          onSaved={saved}
          onRefresh={reload}
          returnFocus={returnFocus}
        />
      )}
    </section>
  )
}
