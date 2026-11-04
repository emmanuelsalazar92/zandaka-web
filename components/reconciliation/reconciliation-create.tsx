"use client"

import * as React from "react"

import { ReconciliationComparison } from "@/components/reconciliation/reconciliation-comparison"
import styles from "@/components/reconciliation/reconciliation.module.css"
import { useReconciliationRead } from "@/components/reconciliation/use-reconciliation-read"
import { ReconciliationDenominationTable } from "@/components/reconciliation-denomination-table"
import { AccessibleField, AccessibleFieldError } from "@/components/ui/accessible-field"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getAccountingDate } from "@/lib/date-only"
import { subtractMoney } from "@/lib/money"
import {
  createReconciliation,
  fetchCashDenominationsForAccount,
  fetchExpectedTotalForAccount,
  ReconciliationApiError,
  type ReconciliationAccount,
  type ReconciliationCountMethod,
  type ReconciliationRecord,
} from "@/lib/reconciliation-api"
import {
  definitiveReconciliationError,
  reconciliationManualAmount,
  reconciliationQuantities,
  supportedReconciliationCurrency,
  validReconciliationDate,
} from "@/lib/reconciliation-review"
import { cn } from "@/lib/utils"

export function ReconciliationCreate({
  account,
  onClose,
  onCreated,
  onReview,
  onReturnFocus,
}: {
  account: ReconciliationAccount
  onClose: () => void
  onCreated: (record: ReconciliationRecord) => void
  onReview: () => void
  onReturnFocus: () => void
}) {
  const [date, setDate] = React.useState(getAccountingDate),
    [countMethod, setMethod] = React.useState<ReconciliationCountMethod>(
      account.type === "CASH" ? "DENOMINATION_COUNT" : "MANUAL_TOTAL",
    )
  const [manual, setManual] = React.useState(""),
    [quantities, setQuantities] = React.useState<Record<number, string>>({}),
    [note, setNote] = React.useState("")
  const [busy, setBusy] = React.useState(false),
    [uncertain, setUncertain] = React.useState(false),
    [error, setError] = React.useState<string | null>(null)
  const busyRef = React.useRef(false),
    mounted = React.useRef(true),
    title = React.useRef<HTMLHeadingElement>(null)
  React.useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const loadExpected = React.useCallback(
    (signal: AbortSignal) => fetchExpectedTotalForAccount(account.id, date, signal),
    [account.id, date],
  )
  const loadCatalog = React.useCallback(
    (signal: AbortSignal) => fetchCashDenominationsForAccount(account.id, signal),
    [account.id],
  )
  const expected = useReconciliationRead(
    validReconciliationDate(date) ? `expected:${account.id}:${date}` : null,
    loadExpected,
  )
  const catalog = useReconciliationRead(
    countMethod === "DENOMINATION_COUNT" ? `cash:${account.id}` : null,
    loadCatalog,
  )
  const manualResult = reconciliationManualAmount(manual, account.currency)
  const cashResult = catalog.data
    ? reconciliationQuantities(catalog.data.denominations, quantities)
    : null
  const hasQuantities = Object.values(quantities).some((value) => value !== "")
  const counted =
    countMethod === "MANUAL_TOTAL"
      ? manualResult.value
      : hasQuantities
        ? (cashResult?.total ?? null)
        : null
  const expectedTotal =
    expected.data?.currency === account.currency ? expected.data.expectedTotal : null
  const catalogMatches =
    countMethod !== "DENOMINATION_COUNT" || catalog.data?.currency === account.currency
  let difference: number | null = null
  try {
    if (counted !== null && expectedTotal !== null)
      difference = subtractMoney(counted, expectedTotal)
  } catch {
    /* An unsafe total is not a verified comparison. */
  }
  const ready =
    validReconciliationDate(date) &&
    supportedReconciliationCurrency(account.currency) &&
    account.active &&
    catalogMatches &&
    difference !== null &&
    (countMethod !== "DENOMINATION_COUNT" || Boolean(cashResult?.lines.length)) &&
    !expected.loading &&
    !catalog.loading
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!ready || busyRef.current || uncertain) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      const result = await createReconciliation({
        accountId: account.id,
        date,
        countMethod,
        countedTotal: counted ?? undefined,
        note,
        lines: countMethod === "DENOMINATION_COUNT" ? cashResult!.lines : undefined,
      })
      if (result.currency !== account.currency || result.countedTotal !== counted)
        throw new Error("Receipt mismatch")
      if (
        countMethod === "DENOMINATION_COUNT" &&
        (result.lines.length !== cashResult!.lines.length ||
          cashResult!.lines.some(
            (line) =>
              !result.lines.some(
                (saved) =>
                  saved.denominationId === line.denominationId && saved.quantity === line.quantity,
              ),
          ))
      )
        throw new Error("Count receipt mismatch")
      if (mounted.current) onCreated(result)
    } catch (error) {
      if (!mounted.current) return
      if (definitiveReconciliationError(error))
        setError(
          error instanceof ReconciliationApiError && error.code === "CONFLICT"
            ? "Ya puede existir una conciliación abierta para esta cuenta. Revisa el historial antes de crear otra."
            : "No se pudo registrar. Revisa los datos o actualiza la comparación; tu borrador se conserva.",
        )
      else {
        setUncertain(true)
        setError(
          "No pudimos confirmar si se registró. Revisa el historial antes de intentarlo de nuevo; no reenviaremos este borrador.",
        )
      }
    } finally {
      busyRef.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const close = () => {
    if (uncertain) onReview()
    else onClose()
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busyRef.current) close()
      }}
    >
      <DialogContent
        className={cn("marea-surface @container grid-cols-1 p-4 sm:max-w-3xl sm:p-6", styles.scope)}
        showCloseButton={!busy}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          title.current?.focus()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          onReturnFocus()
        }}
        onEscapeKeyDown={(event) => {
          if (busyRef.current) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (busyRef.current) event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle ref={title} tabIndex={-1}>
            Nueva conciliación
          </DialogTitle>
          <DialogDescription>
            Compara un saldo real con los movimientos registrados hasta una fecha de corte.
          </DialogDescription>
        </DialogHeader>
        <form className="min-w-0 space-y-5" onSubmit={submit}>
          {error && (
            <Feedback
              tone={uncertain ? "warning" : "error"}
              title={uncertain ? "Resultado por confirmar" : "No se pudo registrar"}
            >
              {error}
            </Feedback>
          )}
          <fieldset disabled={busy || uncertain} className="min-w-0 space-y-5">
            <legend className="mb-3 text-base font-semibold">1. Cuenta y fecha de corte</legend>
            <div className="min-w-0 rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">
              <p className="font-semibold">{account.name}</p>
              <p className="mt-1">
                {account.institution || "Institución no disponible"} · {account.currency}
              </p>
            </div>
            <AccessibleField className="space-y-2">
              <Label htmlFor="reconciliation-date">Fecha de corte</Label>
              <Input
                id="reconciliation-date"
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
              {!validReconciliationDate(date) && (
                <AccessibleFieldError>Elige una fecha de corte válida.</AccessibleFieldError>
              )}
            </AccessibleField>
            <h3 className="text-base font-semibold">2. Saldo real de esta cuenta</h3>
            {account.type === "CASH" && (
              <AccessibleField className="space-y-2">
                <Label htmlFor="reconciliation-method">Método de conteo</Label>
                <Select
                  value={countMethod}
                  onValueChange={(value) => setMethod(value as ReconciliationCountMethod)}
                >
                  <SelectTrigger
                    id="reconciliation-method"
                    className="w-full min-w-0 max-w-full whitespace-normal [&_[data-slot=select-value]]:line-clamp-none [&_[data-slot=select-value]]:[overflow-wrap:anywhere]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DENOMINATION_COUNT">Contar billetes y monedas</SelectItem>
                    <SelectItem value="MANUAL_TOTAL">Introducir saldo manual</SelectItem>
                  </SelectContent>
                </Select>
              </AccessibleField>
            )}
            {countMethod === "MANUAL_TOTAL" ? (
              <AccessibleField className="space-y-2">
                <Label htmlFor="reconciliation-counted-total">
                  Total contado en {account.currency}
                </Label>
                <Input
                  id="reconciliation-counted-total"
                  inputMode="decimal"
                  value={manual}
                  onChange={(event) => setManual(event.target.value)}
                  placeholder="Por ejemplo, 1234.56"
                />
                {manual.trim() && manualResult.error ? (
                  <AccessibleFieldError>{manualResult.error}</AccessibleFieldError>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Introduce el saldo del banco o el efectivo contado. Usa punto decimal, sin
                    separadores de miles.
                  </p>
                )}
              </AccessibleField>
            ) : catalog.loading ? (
              <LoadingState>Cargando billetes y monedas…</LoadingState>
            ) : catalog.error || !catalogMatches ? (
              <Feedback tone="error" title="Conteo no disponible">
                No pudimos verificar las denominaciones de esta cuenta.{" "}
                <Button type="button" variant="outline" onClick={catalog.reload}>
                  Volver a cargar denominaciones
                </Button>
              </Feedback>
            ) : catalog.data?.denominations.length ? (
              <ReconciliationDenominationTable
                currency={account.currency}
                denominations={catalog.data.denominations}
                quantities={quantities}
                onQuantityChange={(id, value) =>
                  setQuantities((current) => ({ ...current, [id]: value }))
                }
              />
            ) : (
              <Feedback title="Configura las denominaciones" role="note">
                No hay billetes o monedas configurados para {account.currency}. Puedes introducir un
                saldo manual o configurarlos en Ajustes.
              </Feedback>
            )}
            {countMethod === "DENOMINATION_COUNT" &&
              Boolean(catalog.data?.denominations.length) &&
              !cashResult?.lines.length && (
                <p className="text-sm text-muted-foreground">
                  Introduce al menos una cantidad mayor que cero. Si no tienes efectivo, puedes
                  registrar un saldo manual de 0.
                </p>
              )}
            <AccessibleField className="space-y-2">
              <Label htmlFor="reconciliation-note">Notas opcionales</Label>
              <Textarea
                id="reconciliation-note"
                rows={3}
                maxLength={1000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </AccessibleField>
            <h3 className="text-base font-semibold">3. Revisa la comparación</h3>
            {expected.loading ? (
              <LoadingState>Consultando el saldo al corte…</LoadingState>
            ) : expected.error || (expected.data && expected.data.currency !== account.currency) ? (
              <Feedback tone="error" title="Saldo calculado no disponible">
                No se puede confirmar la comparación.{" "}
                <Button type="button" variant="outline" onClick={expected.reload}>
                  Volver a consultar el saldo
                </Button>
              </Feedback>
            ) : null}
            <ReconciliationComparison
              currency={account.currency}
              expected={expectedTotal}
              counted={counted}
              difference={difference}
            />
            <p className="text-sm text-muted-foreground">
              {difference === null
                ? "Confirma los dos saldos antes de registrar."
                : difference === 0
                  ? "Si el servidor confirma estos importes, la conciliación quedará conciliada y cerrada."
                  : "La conciliación quedará abierta para revisar la diferencia. Registrar no crea movimientos ni ajusta saldos."}
            </p>
          </fieldset>
          {error && !uncertain && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                expected.reload()
                if (countMethod === "DENOMINATION_COUNT") catalog.reload()
              }}
            >
              Actualizar comparación
            </Button>
          )}
          <DialogFooter className="sticky bottom-0 border-t bg-card pt-3">
            <Button type="button" variant="outline" disabled={busy} onClick={close}>
              Cancelar
            </Button>
            {uncertain ? (
              <Button type="button" onClick={onReview}>
                Revisar historial
              </Button>
            ) : (
              <Button type="submit" loading={busy} disabled={!ready}>
                Crear conciliación
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
