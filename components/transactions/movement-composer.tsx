"use client"

import { ArrowDownLeft, ArrowUpRight, Plus, Trash2 } from "lucide-react"
import * as React from "react"

import { useEnvelopeOptions } from "@/components/transactions/use-envelope-options"
import { AccessibleField, AccessibleFieldError } from "@/components/ui/accessible-field"
import { Button } from "@/components/ui/button"
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Feedback } from "@/components/ui/feedback"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency } from "@/lib/currency-formatter"
import {
  emptyMovementLine,
  isMovementConfirmation,
  movementAccountLabel,
  movementLineState,
  movementTotals,
  recentMovementDestinations,
  selectMovementAccount,
  validMovementDate,
  type MovementAccount,
  type MovementKind,
  type MovementLineDraft,
  type MovementPayload,
} from "@/lib/movement-draft"
import { publicErrorMessage } from "@/lib/public-error"
import { normalizeAmountInput } from "@/lib/transaction-amount"
import type { TimelineTransaction, TransactionType } from "@/lib/transaction-timeline"

export function MovementComposer({
  type,
  accounts,
  accountsLoading,
  accountsError,
  history,
  initialDate,
  initialDescription,
  userId,
  onTypeChange,
  onClose,
  onCreated,
  onReviewHistory,
  onRefreshAccounts,
  onBusyChange,
}: {
  type: MovementKind
  accounts: MovementAccount[]
  accountsLoading: boolean
  accountsError: string | null
  history: TimelineTransaction[]
  initialDate: string
  initialDescription: string
  userId: number
  onTypeChange: (type: TransactionType, metadata: { date: string; description: string }) => void
  onClose: () => void
  onCreated: () => void
  onReviewHistory: (metadata: { date: string; description: string; type: MovementKind }) => void
  onRefreshAccounts: () => void
  onBusyChange: (busy: boolean) => void
}) {
  const [date, setDate] = React.useState(initialDate),
    [description, setDescription] = React.useState(initialDescription)
  const [lines, setLines] = React.useState<MovementLineDraft[]>([emptyMovementLine(1)])
  const nextKey = React.useRef(2)
  const [advanced, setAdvanced] = React.useState(false),
    [busy, setBusy] = React.useState(false),
    [uncertain, setUncertain] = React.useState(false),
    [error, setError] = React.useState<string | null>(null)
  const busyRef = React.useRef(false),
    mounted = React.useRef(false)
  React.useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const { options, load } = useEnvelopeOptions()
  React.useEffect(() => {
    for (const id of new Set(lines.map((l) => l.accountId).filter(Boolean))) void load(id)
  }, [lines, load])
  React.useEffect(() => {
    setLines((previous) => {
      let changed = false
      const next = previous.map((line) => {
        const data = options[line.accountId]
        if (!line.candidate || data?.status !== "ready") return line
        changed = true
        const match = data.items.some((e) => e.id === line.candidate)
        return {
          ...line,
          candidate: undefined,
          envelopeId: match ? String(line.candidate) : "",
          notice: match
            ? "Propuesta reciente aplicada. Revisa cuenta, sobre e importe antes de guardar."
            : "El sobre reciente ya no está disponible en esta cuenta. Selecciona otro sobre.",
        }
      })
      return changed ? next : previous
    })
  }, [options, lines])
  const states = lines.map((l) => movementLineState(l, type, accounts, options[l.accountId]))
  const totals = movementTotals(lines, type, accounts, options)
  const ready = Boolean(
    totals &&
    validMovementDate(date) &&
    description.trim() &&
    description.length <= 1000 &&
    !accountsLoading &&
    !accountsError &&
    !uncertain,
  )
  const recent = recentMovementDestinations(history, type, accounts)
  const addLine = () => {
    const key = nextKey.current++
    setAdvanced(true)
    setLines((all) => [...all, emptyMovementLine(key)])
    requestAnimationFrame(() => document.getElementById(`movement-${key}-account`)?.focus())
  }
  const removeLine = (key: number, index: number) => {
    const target = lines[index > 0 ? index - 1 : 1]?.key
    setLines((all) => all.filter((r) => r.key !== key))
    requestAnimationFrame(() => document.getElementById(`movement-${target}-account`)?.focus())
  }
  const update = (key: number, change: Partial<MovementLineDraft>) => {
    setError(null)
    setLines((rows) => rows.map((r) => (r.key === key ? { ...r, ...change } : r)))
  }
  const chooseAccount = (key: number, value: string, candidate?: number) => {
    setError(null)
    setLines((rows) =>
      rows.map((line) => {
        if (line.key !== key || (line.accountId === value && !candidate)) return line
        return selectMovementAccount(line, value, accounts, candidate)
      }),
    )
  }
  const submit = async () => {
    if (!ready || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    onBusyChange(true)
    setError(null)
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 30_000)
    const payload: MovementPayload = {
      userId,
      date,
      description: description.trim(),
      type,
      lines: states.map((s) => ({
        accountId: s.account!.id,
        envelopeId: s.envelope!.id,
        amount: s.amount!,
      })),
    }
    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      const result: unknown = await response.json().catch(() => null)
      if (!mounted.current) return
      if (!response.ok) {
        const code = (result as { error?: { code?: string } } | null)?.error?.code
        const definite =
          response.status >= 400 &&
          response.status < 500 &&
          ["VALIDATION_ERROR", "NOT_FOUND", "FORBIDDEN", "INACTIVE_RESOURCE"].includes(code ?? "")
        if (!definite) setUncertain(true)
        setError(
          definite
            ? publicErrorMessage(result, "Revisa los datos del movimiento.")
            : "No pudimos confirmar el registro. Revisa tus movimientos antes de volver a registrarlo.",
        )
        return
      }
      if (!isMovementConfirmation(payload, result)) {
        setUncertain(true)
        setError(
          "No recibimos una confirmación válida. Revisa tus movimientos antes de volver a registrar la operación.",
        )
        return
      }
      onCreated()
    } catch {
      if (mounted.current) {
        setUncertain(true)
        setError(
          "La conexión se interrumpió y no sabemos si se guardó el movimiento. Revisa tus movimientos antes de volver a registrarlo.",
        )
      }
    } finally {
      clearTimeout(timeout)
      busyRef.current = false
      onBusyChange(false)
      if (mounted.current) setBusy(false)
    }
  }
  return (
    <>
      <DialogHeader className="min-w-0 pr-0 [overflow-wrap:anywhere]">
        <DialogTitle className="pr-8">Nuevo movimiento</DialogTitle>
        <DialogDescription>
          {type === "INCOME"
            ? "Registra lo que entra y el sobre al que pertenece."
            : "Registra lo que sale y el sobre que lo cubre."}{" "}
          Elige la cuenta para identificar su institución y moneda.
        </DialogDescription>
      </DialogHeader>
      <div className="min-w-0 space-y-5 [overflow-wrap:anywhere]">
        {error && (
          <Feedback tone="error" title="Revisa el movimiento">
            {error}
            {!uncertain && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  onRefreshAccounts()
                  for (const id of new Set(lines.map((l) => l.accountId).filter(Boolean)))
                    void load(id, true)
                }}
              >
                Actualizar opciones
              </Button>
            )}
          </Feedback>
        )}
        {accountsError && (
          <Feedback tone="error" title="Cuentas no disponibles">
            {accountsError}
            <Button type="button" variant="outline" onClick={onRefreshAccounts}>
              Volver a cargar cuentas
            </Button>
          </Feedback>
        )}
        <fieldset disabled={busy || uncertain} className="min-w-0 space-y-5">
          <legend className="sr-only">Datos del {type === "INCOME" ? "ingreso" : "gasto"}</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AccessibleField className="min-w-0 space-y-2">
              <Label htmlFor="movement-date">Fecha</Label>
              <Input
                autoFocus
                id="movement-date"
                required
                type="date"
                className="min-w-0 px-1"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </AccessibleField>
            <AccessibleField className="min-w-0 space-y-2">
              <Label htmlFor="movement-type">Tipo</Label>
              <Select
                value={type}
                onValueChange={(value) =>
                  onTypeChange(value as TransactionType, { date, description })
                }
              >
                <SelectTrigger id="movement-type" className="w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCOME">Ingreso</SelectItem>
                  <SelectItem value="EXPENSE">Gasto</SelectItem>
                  <SelectItem value="TRANSFER">Transferencia</SelectItem>
                  <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                </SelectContent>
              </Select>
            </AccessibleField>
          </div>
          <AccessibleField className="space-y-2">
            <Label htmlFor="movement-description">Descripción</Label>
            <Input
              id="movement-description"
              required
              maxLength={1000}
              placeholder="Por ejemplo, compra de alimentos"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </AccessibleField>
          {recent.length > 0 && (
            <section
              aria-label="Propuestas recientes"
              className="space-y-2 rounded-xl bg-secondary/50 p-3"
            >
              <p className="text-sm font-semibold">Usados recientemente</p>
              <p className="text-sm text-muted-foreground">
                De los movimientos cargados. Elige una propuesta para la primera línea; podrás
                revisarla antes de guardar.
              </p>
              <div className="flex flex-col items-start gap-2">
                {recent.map((r) => (
                  <Button
                    type="button"
                    key={`${r.accountId}/${r.envelopeId}`}
                    variant="outline"
                    className="h-auto text-left"
                    onClick={() => chooseAccount(lines[0].key, String(r.accountId), r.envelopeId)}
                  >
                    {r.label}
                  </Button>
                ))}
              </div>
            </section>
          )}
          <div className="space-y-4" id="movement-lines">
            {lines.map((line, index) => {
              const state = states[index],
                data = options[line.accountId],
                prefix = `movement-${line.key}`
              return (
                <fieldset key={line.key} className="min-w-0 space-y-4 rounded-xl border p-3 sm:p-4">
                  <legend className="px-2 text-sm font-semibold">
                    {advanced ? `Detalle ${index + 1}` : "Cuenta, sobre e importe"}
                  </legend>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <AccessibleField className="min-w-0 space-y-2">
                      <Label htmlFor={`${prefix}-account`}>Cuenta {index + 1}</Label>
                      <SearchableSelect
                        id={`${prefix}-account`}
                        value={line.accountId}
                        options={accounts.map((a) => ({
                          value: String(a.id),
                          label: movementAccountLabel(a),
                        }))}
                        onValueChange={(value) => chooseAccount(line.key, value)}
                        disabled={accountsLoading || !accounts.length}
                        placeholder={
                          accountsLoading
                            ? "Cargando cuentas…"
                            : accounts.length
                              ? "Elige una cuenta"
                              : "No hay cuentas activas"
                        }
                        searchLabel={`Buscar cuenta ${index + 1}`}
                      />
                    </AccessibleField>
                    <AccessibleField className="min-w-0 space-y-2">
                      <Label htmlFor={`${prefix}-envelope`}>Sobre {index + 1}</Label>
                      <SearchableSelect
                        id={`${prefix}-envelope`}
                        value={line.envelopeId}
                        options={
                          data?.items.map((e) => ({ value: String(e.id), label: e.name })) ?? []
                        }
                        onValueChange={(value) =>
                          update(line.key, { envelopeId: value, candidate: undefined, notice: "" })
                        }
                        disabled={!state.account || !data || data.status !== "ready"}
                        placeholder={
                          !state.account
                            ? "Elige primero una cuenta"
                            : data?.status === "error"
                              ? "No pudimos cargar los sobres"
                              : data?.status !== "ready"
                                ? "Cargando sobres…"
                                : !data.items.length
                                  ? "Esta cuenta no tiene sobres"
                                  : "Elige un sobre"
                        }
                        searchLabel={`Buscar sobre ${index + 1}`}
                      />
                      <AccessibleFieldError className="text-sm text-error">
                        {data?.status === "error"
                          ? "No pudimos cargar los sobres. Vuelve a cargar las opciones."
                          : null}
                      </AccessibleFieldError>
                    </AccessibleField>
                  </div>
                  {line.notice && (
                    <p role="status" className="text-sm text-muted-foreground">
                      {line.notice}
                    </p>
                  )}
                  {data?.status === "error" && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void load(line.accountId, true)}
                    >
                      Volver a cargar sobres {index + 1}
                    </Button>
                  )}
                  <AccessibleField className="space-y-2">
                    <Label htmlFor={`${prefix}-amount`}>
                      Importe {index + 1}
                      {state.account ? ` en ${state.account.currency}` : " · elige una cuenta"}
                    </Label>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span
                        className="rounded-md bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground"
                        aria-hidden="true"
                      >
                        {state.account?.currency ?? "Moneda por elegir"}
                      </span>
                      <Input
                        id={`${prefix}-amount`}
                        required
                        type="text"
                        inputMode="decimal"
                        className="min-w-0 flex-1 basis-40 tabular-nums"
                        disabled={!state.account}
                        value={line.amount}
                        placeholder="0.00"
                        aria-describedby={`${prefix}-help`}
                        onChange={(e) => update(line.key, { amount: e.target.value })}
                        onBlur={() =>
                          update(line.key, { amount: normalizeAmountInput(line.amount, type) })
                        }
                      />
                    </div>
                    <p id={`${prefix}-help`} className="text-sm text-muted-foreground">
                      {type === "EXPENSE"
                        ? "El gasto se guarda como salida."
                        : "El ingreso se guarda como entrada."}{" "}
                      Usa punto decimal, sin separadores de miles; por ejemplo, 1234.56.
                    </p>
                    <AccessibleFieldError className="text-sm text-error">
                      {state.error}
                    </AccessibleFieldError>
                  </AccessibleField>
                  {advanced && lines.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeLine(line.key, index)}
                      aria-label={`Quitar detalle ${index + 1}`}
                    >
                      <Trash2 aria-hidden="true" /> Quitar detalle
                    </Button>
                  )}
                </fieldset>
              )
            })}
          </div>
          {!advanced ? (
            <Button
              type="button"
              variant="outline"
              aria-expanded={false}
              aria-controls="movement-lines"
              onClick={addLine}
            >
              <Plus aria-hidden="true" /> Desglosar en varias líneas
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={addLine}>
                <Plus aria-hidden="true" /> Añadir detalle
              </Button>
              {lines.length === 1 && (
                <Button type="button" variant="ghost" onClick={() => setAdvanced(false)}>
                  Volver al registro simple
                </Button>
              )}
            </div>
          )}
        </fieldset>
        <section aria-label="Resumen del movimiento" className="atlantic-hero p-3 sm:p-5">
          <p className="hero-caption text-sm">
            {type === "INCOME" ? "Así entrará tu dinero" : "Así saldrá tu dinero"}
          </p>
          {totals ? (
            <div className="mt-3 space-y-2">
              <ul className="hero-caption space-y-1 text-sm">
                {states.map((state, index) => (
                  <li key={lines[index].key}>
                    {state.account!.name} ·{" "}
                    {state.account!.institution || "Institución sin identificar"} →{" "}
                    {state.envelope!.name}
                  </li>
                ))}
              </ul>
              {totals.map((t) => (
                <p
                  key={t.currency}
                  className="flex flex-wrap items-center gap-2 text-lg font-semibold tabular-nums sm:text-xl"
                >
                  {type === "INCOME" ? (
                    <ArrowDownLeft aria-hidden="true" />
                  ) : (
                    <ArrowUpRight aria-hidden="true" />
                  )}
                  <span className="inline-flex min-w-0 flex-wrap gap-x-2">
                    <span>{t.currency} </span>
                    <span>
                      {formatCurrency(t.amount, t.currency).replace(t.currency, "").trim()}
                    </span>
                  </span>
                </p>
              ))}
              <p className="hero-caption text-sm">
                {lines.length} {lines.length === 1 ? "detalle" : "detalles"}.{" "}
                {totals.length > 1
                  ? "Totales separados por moneda, sin conversión."
                  : "Moneda de las cuentas seleccionadas."}
              </p>
            </div>
          ) : (
            <p className="hero-caption mt-3 text-sm">
              Completa cuenta, sobre e importe en cada detalle para revisar el resultado.
            </p>
          )}
        </section>
        {uncertain && (
          <Feedback tone="warning" title="Resultado por confirmar">
            <p>
              El movimiento podría haberse guardado. Revisa el historial antes de registrar uno
              nuevo.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => onReviewHistory({ date, description: description.trim(), type })}
            >
              Revisar movimientos
            </Button>
          </Feedback>
        )}
      </div>
      <DialogFooter className="sticky bottom-0 z-10 min-w-0 border-t bg-card pt-3">
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="button"
          loading={busy}
          disabled={!ready || busy}
          onClick={() => void submit()}
        >
          {busy ? "Guardando movimiento" : type === "INCOME" ? "Guardar ingreso" : "Guardar gasto"}
        </Button>
      </DialogFooter>
    </>
  )
}
