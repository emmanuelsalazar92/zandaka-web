"use client"

import { ChevronDown, ChevronRight, Plus, RefreshCw } from "lucide-react"
import Link from "next/link"
import * as React from "react"

import { useContextRead } from "@/components/accounts/hooks/use-context-read"
import { PageHeader } from "@/components/page-header"
import { SettingsNavigation } from "@/components/settings/settings-navigation"
import styles from "@/components/settings/settings.module.css"
import { AccessibleField } from "@/components/ui/accessible-field"
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
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { contextRead, contextWrite, ContextWriteError } from "@/lib/account-context"
import {
  type CatalogCategory,
  type CatalogInstitution,
  catalogReturn,
  catalogSearch,
  categoryParentOptions,
  categoryPaths,
  parseCatalogCategories,
  parseCatalogInstitutions,
  parseInstitutionCounts,
  readCatalog,
} from "@/lib/settings-catalog"
import { cn } from "@/lib/utils"

const TYPES = { BANK: "Banco", CASH: "Efectivo", VIRTUAL: "Virtual" }
const loadInstitutions = async (signal: AbortSignal) =>
  parseCatalogInstitutions(await readCatalog("/institutions", signal))
const loadCategories = async (signal: AbortSignal) =>
  parseCatalogCategories(await readCatalog("/categories?activeOnly=true", signal))
const loadCounts = async (signal: AbortSignal) =>
  parseInstitutionCounts(await contextRead("/reports/account-balances?isActive=true", signal))
type Row = CatalogCategory | CatalogInstitution
type Editor = { mode: "create" | "edit" | "deactivate"; row: Row | null }

export function CatalogContent({ kind }: { kind: "institutions" | "categories" }) {
  const institutionMode = kind === "institutions"
  const catalog = useContextRead<Row[]>(kind, institutionMode ? loadInstitutions : loadCategories)
  const counts = useContextRead(institutionMode ? "institution-accounts" : null, loadCounts)
  const [query, setQuery] = React.useState("")
  const [selectedId, setSelectedId] = React.useState<number | null>(null)
  const [collapsed, setCollapsed] = React.useState<Set<number>>(new Set())
  const [editor, setEditor] = React.useState<Editor | null>(null)
  const [form, setForm] = React.useState({ name: "", type: "BANK", parentId: "none" })
  const [busy, setBusy] = React.useState(false)
  const [uncertain, setUncertain] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [returnTo, setReturnTo] = React.useState(catalogReturn(null))
  const origin = React.useRef<HTMLElement | null>(null)
  const writeLock = React.useRef(false)
  React.useEffect(() => {
    setReturnTo(catalogReturn(new URLSearchParams(window.location.search).get("returnTo")))
  }, [])
  const rows = catalog.data ?? []
  const paths = categoryPaths(institutionMode ? [] : (rows as CatalogCategory[]))
  const pathsById = new Map(paths.map((row) => [row.id, row]))
  const parentIds = new Set(paths.map((row) => row.parentId))
  const search = catalogSearch(query)
  const filtered = institutionMode
    ? (rows as CatalogInstitution[])
        .filter((row) =>
          catalogSearch(
            `${row.name} ${TYPES[row.type]} ${row.active ? "Activa" : "Inactiva"}`,
          ).includes(search),
        )
        .sort((a, b) => a.name.localeCompare(b.name, "es"))
    : paths.filter((row) =>
        search
          ? catalogSearch(row.path).includes(search)
          : !row.ancestors.some((parent) => collapsed.has(parent.id)),
      )
  const selected = filtered.find((row) => row.id === selectedId) ?? filtered[0] ?? null
  const hasChildren = (row: Row) => parentIds.has(row.id)
  const blocked = (row: Row) => {
    if ("active" in row) {
      if (!row.active) return "Esta institución ya está inactiva."
      if (counts.data === null)
        return "Verifica las cuentas vinculadas antes de desactivar esta institución."
      if ((counts.data[row.id] ?? 0) > 0)
        return "Desactiva las cuentas activas antes de desactivar esta institución."
    } else if (hasChildren(row))
      return "Desactiva las subcategorías activas antes de desactivar esta categoría."
    return null
  }
  const reload = () => {
    if (writeLock.current) return
    catalog.reload()
    counts.reload()
    setUncertain(false)
    setError(null)
  }
  const open = (
    event: React.MouseEvent<HTMLButtonElement>,
    mode: Editor["mode"],
    row: Row | null = null,
  ) => {
    origin.current = event.currentTarget
    setError(null)
    setNotice(null)
    setEditor({ mode, row })
    setForm({
      name: row?.name ?? "",
      type: row && "type" in row ? row.type : "BANK",
      parentId: row && "parentId" in row && row.parentId !== null ? String(row.parentId) : "none",
    })
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editor || writeLock.current || uncertain || catalog.loading || catalog.error) return
    const { mode, row } = editor
    if (mode === "deactivate" && (!row || blocked(row))) return
    if (mode !== "deactivate" && (!form.name.trim() || form.name.trim().length > 255)) {
      setError("Introduce un nombre de entre 1 y 255 caracteres.")
      return
    }
    const parentId = form.parentId === "none" ? null : Number(form.parentId)
    if (
      !institutionMode &&
      mode !== "deactivate" &&
      parentId !== null &&
      !categoryParentOptions(rows as CatalogCategory[], row?.id).some(
        (item) => item.id === parentId,
      )
    ) {
      setError(
        "Elige una categoría principal válida. Una categoría no puede depender de sí misma ni de sus descendientes.",
      )
      return
    }
    if (
      !institutionMode &&
      row &&
      "parentId" in row &&
      row.parentId === null &&
      hasChildren(row) &&
      parentId !== null &&
      mode === "edit"
    ) {
      setError("No puedes mover una categoría principal con subcategorías activas.")
      return
    }
    writeLock.current = true
    setBusy(true)
    setError(null)
    try {
      const suffix =
        mode === "create" ? "" : `/${row!.id}${mode === "deactivate" ? "/deactivate" : ""}`
      const body =
        mode === "deactivate"
          ? undefined
          : {
              ...(mode === "create" ? { userId: 1 } : {}),
              name: form.name.trim(),
              ...(institutionMode ? { type: form.type } : { parentId }),
            }
      const result = await contextWrite(
        `/${kind}${suffix}`,
        mode === "edit" ? "PATCH" : "POST",
        body,
      )
      if (mode !== "deactivate") {
        try {
          const parsed = institutionMode
            ? parseCatalogInstitutions([result])
            : parseCatalogCategories([result])
          if (parsed.length !== 1) throw new Error("Respuesta incompleta")
        } catch {
          throw new ContextWriteError(
            "El resultado está por confirmar. Actualiza el catálogo antes de volver a guardar.",
            true,
          )
        }
      }
      setEditor(null)
      setNotice(mode === "deactivate" ? "Desactivación confirmada." : "Cambios guardados.")
      catalog.reload()
      if (institutionMode) counts.reload()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "No pudimos completar la acción."
      const pending = cause instanceof ContextWriteError && cause.uncertain
      setError(
        mode === "deactivate" && !pending
          ? (institutionMode
              ? "Revisa las cuentas activas vinculadas. "
              : "Revisa las subcategorías y los sobres activos. ") + message
          : message,
      )
      if (cause instanceof ContextWriteError && cause.uncertain) setUncertain(true)
    } finally {
      writeLock.current = false
      setBusy(false)
    }
  }
  const singular = institutionMode ? "institución" : "categoría"
  return (
    <div
      className={cn(
        "marea-surface min-w-0 space-y-6 rounded-2xl bg-background p-3 sm:p-5",
        styles.page,
      )}
    >
      {returnTo.href !== "/settings" && (
        <Link
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
          href={returnTo.href}
        >
          {returnTo.label}
        </Link>
      )}
      <PageHeader
        title={institutionMode ? "Instituciones" : "Categorías"}
        description={
          institutionMode
            ? "Las entidades que dan contexto a tus cuentas."
            : "Cada concepto en su lugar, sin perder la jerarquía."
        }
      >
        <Button variant="outline" disabled={busy || catalog.loading} onClick={reload}>
          <RefreshCw aria-hidden="true" className="size-4" />
          Actualizar catálogo
        </Button>
        <Button
          disabled={busy || uncertain || catalog.loading || !!catalog.error}
          onClick={(event) => open(event, "create")}
        >
          <Plus aria-hidden="true" className="size-4" />
          Añadir {singular}
        </Button>
      </PageHeader>
      <SettingsNavigation current={kind} />
      <div className={styles.intro}>
        <p className="!mt-0 text-sm font-medium">
          Mantenimiento · {institutionMode ? "Instituciones" : "Categorías"}
        </p>
        <h2 className="mt-2">
          {institutionMode ? "Un lugar para cada cuenta." : "Orden que se entiende."}
        </h2>
        <p>
          {institutionMode
            ? "Administra bancos, efectivo y entidades virtuales. Las cuentas y sus saldos se consultan en Cuentas."
            : "Busca por nombre o por grupo. Cada resultado conserva la ruta de su categoría principal."}
        </p>
      </div>
      {notice && <Feedback tone="success" title={notice} />}
      {uncertain && (
        <Feedback tone="warning" title="Resultado por confirmar">
          Cierra el diálogo y actualiza el catálogo para verificar el estado antes de repetir la
          acción.
        </Feedback>
      )}
      {catalog.loading ? (
        <LoadingState>Cargando {institutionMode ? "instituciones" : "categorías"}…</LoadingState>
      ) : catalog.error ? (
        <Feedback tone="error" title="Catálogo no disponible">
          {catalog.error}
          <Button variant="outline" onClick={reload}>
            Reintentar
          </Button>
        </Feedback>
      ) : rows.length === 0 ? (
        <EmptyState title={`Todavía no hay ${institutionMode ? "instituciones" : "categorías"}`}>
          Añade tu primera {singular} para comenzar.
        </EmptyState>
      ) : (
        <>
          <div className={styles.toolbar}>
            <AccessibleField>
              <Label htmlFor={`${kind}-search`}>
                Buscar {institutionMode ? "instituciones" : "categorías"}
              </Label>
              <Input
                id={`${kind}-search`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  institutionMode ? "Nombre, tipo o estado" : "Nombre o ruta de categoría"
                }
              />
            </AccessibleField>
            {query && (
              <Button variant="outline" onClick={() => setQuery("")}>
                Limpiar búsqueda
              </Button>
            )}
            <p className="py-3 text-sm text-muted-foreground" role="status">
              {filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}
            </p>
          </div>
          <div className={styles.layout}>
            <section
              className={styles.list}
              aria-label={institutionMode ? "Lista de instituciones" : "Jerarquía de categorías"}
            >
              {filtered.length === 0 && (
                <EmptyState title="Sin coincidencias">
                  Prueba otro nombre o limpia la búsqueda.
                </EmptyState>
              )}
              <ul>
                {filtered.map((row) => {
                  const path = pathsById.get(row.id)
                  const children = !institutionMode && hasChildren(row)
                  return (
                    <li
                      key={row.id}
                      className={styles.row}
                      style={
                        path
                          ? { paddingInlineStart: `${Math.min(path.ancestors.length, 3) * 0.6}rem` }
                          : undefined
                      }
                    >
                      {children && !search && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`${collapsed.has(row.id) ? "Expandir" : "Contraer"} ${row.name}`}
                          aria-expanded={!collapsed.has(row.id)}
                          onClick={() =>
                            setCollapsed((current) => {
                              const next = new Set(current)
                              if (next.has(row.id)) next.delete(row.id)
                              else next.add(row.id)
                              return next
                            })
                          }
                        >
                          {collapsed.has(row.id) ? (
                            <ChevronRight aria-hidden="true" />
                          ) : (
                            <ChevronDown aria-hidden="true" />
                          )}
                        </Button>
                      )}
                      {!institutionMode && !search && !children && (
                        <span aria-hidden="true" className="w-11 shrink-0" />
                      )}
                      <button
                        type="button"
                        className={styles.rowButton}
                        aria-label={`Ver ${row.name}`}
                        aria-pressed={selected?.id === row.id}
                        onClick={() => setSelectedId(row.id)}
                      >
                        <strong>{row.name}</strong>
                        <span className={styles.meta}>
                          {"type" in row
                            ? `${TYPES[row.type]} · ${row.active ? "Activa" : "Inactiva"}`
                            : path?.unresolved
                              ? `${path.path} · Relación por revisar`
                              : path?.ancestors.length
                                ? path.path
                                : "Categoría principal"}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
            {selected && (
              <section
                className={cn(styles.detail, "space-y-4")}
                aria-label={`Detalle de ${selected.name}`}
              >
                <p className="text-sm text-muted-foreground">
                  {institutionMode ? "Institución seleccionada" : "Categoría seleccionada"}
                </p>
                <h2>{selected.name}</h2>
                {"type" in selected ? (
                  <p>
                    {TYPES[selected.type]} · {selected.active ? "Activa" : "Inactiva"}
                  </p>
                ) : (
                  <p>{pathsById.get(selected.id)?.path}</p>
                )}
                {institutionMode && (
                  <p>
                    {counts.data === null
                      ? "Cuentas vinculadas por confirmar."
                      : `${counts.data[selected.id] ?? 0} cuentas activas vinculadas.`}
                  </p>
                )}
                {institutionMode && counts.error && (
                  <Feedback tone="warning" title="No pudimos verificar las cuentas">
                    <Button variant="outline" onClick={counts.reload}>
                      Verificar cuentas
                    </Button>
                  </Feedback>
                )}
                <div className={styles.hint}>
                  {blocked(selected) ??
                    (institutionMode
                      ? "Sin cuentas activas vinculadas. Puedes editar o desactivar esta institución."
                      : "Solo puedes desactivar una categoría sin subcategorías ni sobres activos. La API comprueba las relaciones antes de confirmar.")}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={busy || uncertain}
                    aria-label={`Editar ${singular} ${selected.name}`}
                    onClick={(event) => open(event, "edit", selected)}
                  >
                    Editar
                  </Button>
                  {!("active" in selected) || selected.active ? (
                    <Button
                      variant="outline"
                      disabled={busy || uncertain || !!blocked(selected)}
                      aria-label={`Desactivar ${singular} ${selected.name}`}
                      onClick={(event) => open(event, "deactivate", selected)}
                    >
                      Desactivar
                    </Button>
                  ) : null}
                </div>
                <Link
                  className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline"
                  href={institutionMode ? "/accounts" : "/envelopes"}
                >
                  {institutionMode ? "Consultar cuentas" : "Consultar sobres"}
                </Link>
              </section>
            )}
          </div>
        </>
      )}
      <Dialog
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open && !writeLock.current) setEditor(null)
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            ;(origin.current?.isConnected
              ? origin.current
              : document.getElementById("main-content")
            )?.focus()
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {editor?.mode === "deactivate"
                ? "Desactivar"
                : editor?.mode === "edit"
                  ? "Editar"
                  : "Añadir"}{" "}
              {singular}
            </DialogTitle>
            <DialogDescription>
              {editor?.mode === "deactivate"
                ? `Vas a desactivar ${editor.row?.name}. Su historial se conserva.`
                : `Define el nombre y ${institutionMode ? "el tipo de entidad" : "su relación con otras categorías"}.`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void submit(event)} className="space-y-4">
            <fieldset disabled={busy || uncertain} className="space-y-4">
              {editor?.mode !== "deactivate" ? (
                <>
                  <AccessibleField>
                    <Label htmlFor="catalog-name">Nombre de la {singular}</Label>
                    <Input
                      id="catalog-name"
                      maxLength={255}
                      required
                      value={form.name}
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                    />
                  </AccessibleField>
                  <AccessibleField>
                    <Label htmlFor="catalog-relation">
                      {institutionMode ? "Tipo de institución" : "Categoría principal"}
                    </Label>
                    <SearchableSelect
                      id="catalog-relation"
                      value={institutionMode ? form.type : form.parentId}
                      onValueChange={(value) =>
                        setForm(
                          institutionMode ? { ...form, type: value } : { ...form, parentId: value },
                        )
                      }
                      searchLabel={institutionMode ? "Buscar tipo" : "Buscar categoría principal"}
                      options={
                        institutionMode
                          ? Object.entries(TYPES).map(([value, label]) => ({ value, label }))
                          : [
                              { value: "none", label: "Sin categoría principal" },
                              ...categoryParentOptions(
                                rows as CatalogCategory[],
                                editor?.row?.id,
                              ).map((row) => ({ value: String(row.id), label: row.path })),
                            ]
                      }
                    />
                  </AccessibleField>
                  {!institutionMode && editor?.row && hasChildren(editor.row) && (
                    <p className="text-sm text-muted-foreground">
                      Una categoría principal con subcategorías activas debe conservar su nivel.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm">
                  {institutionMode
                    ? "Las cuentas activas impiden esta acción."
                    : "Las subcategorías y los sobres activos impiden esta acción."}
                </p>
              )}
            </fieldset>
            {error && (
              <Feedback
                tone="error"
                title={uncertain ? "Resultado por confirmar" : "No se completó la acción"}
              >
                {error}
              </Feedback>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setEditor(null)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={busy}
                disabled={
                  uncertain ||
                  catalog.loading ||
                  !!catalog.error ||
                  (editor?.mode !== "deactivate" && !form.name.trim())
                }
              >
                {editor?.mode === "deactivate" ? "Confirmar desactivación" : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
