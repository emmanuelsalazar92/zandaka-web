"use client"

import Link from "next/link"
import * as React from "react"

import { ReconciliationComparison } from "@/components/reconciliation/reconciliation-comparison"
import styles from "@/components/reconciliation/reconciliation.module.css"
import { useReconciliationRead } from "@/components/reconciliation/use-reconciliation-read"
import { Badge } from "@/components/ui/badge"
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
import { formatAccountingTimestamp, formatIsoDateOnly } from "@/lib/date-only"
import {
  fetchReconciliation,
  ignoreReconciliation,
  type ReconciliationAccount,
} from "@/lib/reconciliation-api"
import {
  definitiveReconciliationError,
  reconciliationAmount,
  reconciliationMovementLink,
  reconciliationState,
} from "@/lib/reconciliation-review"
import { cn } from "@/lib/utils"

export function ReconciliationDetail({
  id,
  account,
  onClose,
  onChanged,
  onReturnFocus,
}: {
  id: number
  account: ReconciliationAccount
  onClose: () => void
  onChanged: () => void
  onReturnFocus: () => void
}) {
  const load = React.useCallback((signal: AbortSignal) => fetchReconciliation(id, signal), [id])
  const read = useReconciliationRead(`detail:${id}`, load)
  const record = read.data?.accountId === account.id ? read.data : null
  const state = record ? reconciliationState(record) : null
  const [confirm, setConfirm] = React.useState(false),
    [busy, setBusy] = React.useState(false),
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
  async function ignore() {
    if (!record || !state?.open || busyRef.current || uncertain) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      await ignoreReconciliation(record.id)
      if (mounted.current) {
        title.current?.focus({ preventScroll: true })
        setConfirm(false)
        read.reload()
        onChanged()
      }
    } catch (error) {
      if (mounted.current) {
        setError(
          definitiveReconciliationError(error)
            ? "No se pudo ignorar esta conciliación. Actualiza el estado antes de continuar."
            : "No pudimos confirmar el cierre. Actualiza el estado para comprobar el resultado antes de otra acción.",
        )
        setUncertain(true)
      }
    } finally {
      busyRef.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const movementLink = record ? reconciliationMovementLink(record.accountId, record.date) : null
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busyRef.current) onClose()
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
            Detalle de conciliación
          </DialogTitle>
          <DialogDescription>
            Revisión #{id} · {account.name} · {account.currency}
          </DialogDescription>
        </DialogHeader>
        {read.loading ? (
          <LoadingState>Cargando el registro guardado…</LoadingState>
        ) : read.error || !record ? (
          <Feedback tone="error" title="Registro no disponible">
            No pudimos verificar esta conciliación.{" "}
            <Button variant="outline" onClick={read.reload}>
              Volver a cargar detalle
            </Button>
          </Feedback>
        ) : (
          <>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge variant={state!.tone}>{state!.label}</Badge>
              <span className="text-sm text-muted-foreground">
                {record.isActive === 0 ? "Revisión cerrada" : "Revisión activa"}
              </span>
            </div>
            <dl className={styles.comparison}>
              <div>
                <dt className="text-sm text-muted-foreground">Fecha de corte</dt>
                <dd className="mt-1 font-semibold">{formatIsoDateOnly(record.date)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Fecha de cierre</dt>
                <dd className="mt-1 font-semibold">
                  {record.isActive === 1
                    ? "Todavía abierta"
                    : formatAccountingTimestamp(record.closedAt)}
                </dd>
              </div>
            </dl>
            <Feedback
              tone={state!.open ? "warning" : "info"}
              role="note"
              title={state!.open ? "Diferencia para investigar" : "Registro histórico"}
            >
              {state!.explanation}
            </Feedback>
            <ReconciliationComparison
              currency={record.currency}
              expected={record.expectedTotal}
              counted={record.countedTotal}
              difference={record.difference}
              historical
            />
            <p className="text-sm text-muted-foreground">
              Estos son los importes guardados al registrar. No se presentan como el saldo actual de
              la cuenta.
            </p>
            <dl className={styles.comparison}>
              <div>
                <dt className="text-sm text-muted-foreground">Cómo se contó</dt>
                <dd className="mt-1">
                  {record.countMethod === "DENOMINATION_COUNT"
                    ? "Billetes y monedas"
                    : "Saldo manual"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Fecha de registro</dt>
                <dd className="mt-1">{formatAccountingTimestamp(record.createdAt)}</dd>
              </div>
            </dl>
            {record.countMethod === "DENOMINATION_COUNT" && (
              <section aria-label="Desglose de efectivo guardado">
                <h3 className="font-semibold">Desglose de efectivo</h3>
                {record.lines.length ? (
                  <ol className={styles.cashList}>
                    {record.lines.map((line) => (
                      <li key={line.id} className={styles.cashRow}>
                        <div>
                          <p className="font-medium">
                            {line.denominationLabel ||
                              reconciliationAmount(line.denominationValue, record.currency)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {line.denominationType === "BILL" ? "Billete" : "Moneda"} ·{" "}
                            {reconciliationAmount(line.denominationValue, record.currency)}
                          </p>
                        </div>
                        <p>
                          Cantidad:{" "}
                          <span className="font-semibold tabular-nums">{line.quantity}</span>
                        </p>
                        <p>
                          <span className="text-sm text-muted-foreground">Subtotal guardado: </span>
                          <span className="font-semibold tabular-nums">
                            {reconciliationAmount(line.lineTotal, record.currency)}
                          </span>
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Este registro no tiene un desglose disponible. El saldo contado se conserva tal
                    como fue guardado.
                  </p>
                )}
              </section>
            )}
            <section aria-label="Notas de conciliación">
              <h3 className="font-semibold">Notas</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                {record.note || "Sin notas"}
              </p>
            </section>
            {movementLink && (
              <section aria-label="Investigar movimientos" className="space-y-2 border-t pt-4">
                <h3 className="font-semibold">Revisa los movimientos hasta el corte</h3>
                <p className="text-sm text-muted-foreground">
                  Abriremos esta cuenta hasta el {formatIsoDateOnly(record.date)}. No se deduce la
                  causa de la diferencia ni se crea un ajuste.
                </p>
                <Button asChild variant="outline">
                  <Link href={movementLink}>Revisar movimientos del corte</Link>
                </Button>
              </section>
            )}
            {error && (
              <Feedback tone="warning" title="Revisa el estado">
                {error}
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setError(null)
                    read.reload()
                    onChanged()
                    setConfirm(false)
                  }}
                >
                  Actualizar estado
                </Button>
              </Feedback>
            )}
            {state!.open && !confirm && !uncertain && (
              <div className="border-t pt-4">
                <Button variant="outline" onClick={() => setConfirm(true)}>
                  Ignorar conciliación
                </Button>
              </div>
            )}
            {confirm && (
              <section
                role="group"
                aria-label="Confirmar cierre sin resolver"
                className="space-y-3 rounded-xl border border-warning p-4"
              >
                <h3 className="font-semibold">¿Ignorar esta conciliación?</h3>
                <p className="text-sm">
                  La revisión quedará cerrada sin resolver la diferencia. No cambia los saldos ni
                  crea movimientos. Después podrás registrar otra conciliación.
                </p>
                <div className="flex min-w-0 flex-wrap gap-2">
                  <Button
                    autoFocus
                    variant="outline"
                    disabled={busy}
                    onClick={() => setConfirm(false)}
                  >
                    Seguir revisando
                  </Button>
                  <Button disabled={uncertain} loading={busy} onClick={() => void ignore()}>
                    Confirmar ignorar
                  </Button>
                </div>
              </section>
            )}
            {!state!.open && (
              <p className="text-sm text-muted-foreground">
                Consulta de solo lectura. Las conciliaciones cerradas conservan sus importes; no se
                editan ni se borran desde esta ficha.
              </p>
            )}
          </>
        )}
        <DialogFooter className="sticky bottom-0 border-t bg-card pt-3">
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Volver a conciliación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
