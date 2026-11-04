"use client"

import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, LockKeyhole } from "lucide-react"
import * as React from "react"

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
import { ACCOUNTING_TIME_ZONE, formatAccountingTimestamp } from "@/lib/date-only"
import {
  detailAmount,
  detailTotals,
  parseTransactionDetail,
  type TransactionDetail,
} from "@/lib/transaction-detail"
import { formatTransactionFullDate, getTransactionTypeMeta } from "@/lib/transaction-timeline"

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string; retry: boolean }
  | { kind: "ready"; detail: TransactionDetail }

export function TransactionDetailDialog({
  transactionId,
  userId,
  onClose,
  returnFocus,
}: {
  transactionId: number
  userId: number
  onClose: () => void
  returnFocus: React.RefObject<HTMLButtonElement | null>
}) {
  const [state, setState] = React.useState<State>({ kind: "loading" })
  const [attempt, setAttempt] = React.useState(0)
  const title = React.useRef<HTMLHeadingElement>(null)
  React.useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeout = setTimeout(() => controller.abort(), 15_000)
    async function load() {
      try {
        const response = await fetch(`/api/transactions/${transactionId}?userId=${userId}`, {
          signal: controller.signal,
          cache: "no-store",
          headers: { Accept: "application/json" },
        })
        if (!active) return
        if (!response.ok) {
          setState({
            kind: "error",
            retry: ![403, 404].includes(response.status),
            message:
              response.status === 404
                ? "Este movimiento no está disponible para el usuario actual. El historial se conserva sin cambios."
                : response.status === 403
                  ? "No tienes acceso a este movimiento. El historial se conserva sin cambios."
                  : "No pudimos cargar la ficha completa. Puedes volver a intentar sin cambiar el historial.",
          })
          return
        }
        const detail = parseTransactionDetail(await response.json(), transactionId, userId)
        if (active) setState({ kind: "ready", detail })
      } catch {
        if (active)
          setState({
            kind: "error",
            retry: true,
            message:
              "No pudimos verificar la ficha completa. Revisa la conexión y vuelve a intentar.",
          })
      } finally {
        clearTimeout(timeout)
      }
    }
    void load()
    return () => {
      active = false
      controller.abort()
      clearTimeout(timeout)
    }
  }, [transactionId, userId, attempt])

  const detail = state.kind === "ready" ? state.detail : null
  const totals = detail ? detailTotals(detail) : null
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        className="marea-surface grid-cols-1 gap-5 p-4 sm:max-w-2xl sm:p-6 [&_dd]:break-words [&_p]:break-words"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          title.current?.focus()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocus.current?.focus({ preventScroll: true })
        }}
      >
        <DialogHeader>
          <DialogTitle
            ref={title}
            tabIndex={-1}
            className="min-w-0 max-w-full rounded-sm text-xl leading-tight [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Detalle del movimiento
          </DialogTitle>
          <DialogDescription>
            Movimiento #{transactionId} · Consulta del registro completo.
          </DialogDescription>
        </DialogHeader>
        {state.kind === "loading" && <LoadingState>Cargando ficha completa…</LoadingState>}
        {state.kind === "error" && (
          <div className="min-w-0 space-y-3">
            <Feedback tone="error" title="Ficha no disponible">
              {state.message}
            </Feedback>
            {state.retry && (
              <Button
                variant="outline"
                onClick={() => {
                  setState({ kind: "loading" })
                  setAttempt((value) => value + 1)
                }}
              >
                Volver a cargar ficha
              </Button>
            )}
          </div>
        )}
        {detail && (
          <>
            <section
              aria-label="Resumen del movimiento"
              className="atlantic-hero min-w-0 p-4 sm:p-5"
            >
              <p className="hero-caption flex items-center gap-2 text-sm">
                {detail.type === "TRANSFER" ? (
                  <ArrowRightLeft aria-hidden="true" className="size-5 shrink-0" />
                ) : detail.type === "INCOME" ? (
                  <ArrowDownLeft aria-hidden="true" className="size-5 shrink-0" />
                ) : (
                  <ArrowUpRight aria-hidden="true" className="size-5 shrink-0" />
                )}
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {getTransactionTypeMeta(detail.type).label}
                </span>
              </p>
              <div className="mt-4 space-y-3">
                {totals ? (
                  totals.map((total) => (
                    <div key={`${total.currency}:${total.direction}`}>
                      <p className="hero-caption text-sm">
                        {total.direction === "out"
                          ? "Salida transferida"
                          : total.direction === "in"
                            ? "Entrada transferida"
                            : detail.type === "TRANSFER"
                              ? "Sin efecto monetario"
                              : "Total registrado"}
                      </p>
                      <p className="mt-1 text-xl font-semibold tabular-nums [overflow-wrap:anywhere] sm:text-2xl">
                        {detailAmount(total.amount, total.currency)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="hero-caption text-sm">
                    Consulta el importe y la moneda de cada línea. No hay un total verificable.
                  </p>
                )}
              </div>
              {detail.type === "TRANSFER" && (
                <p className="hero-caption mt-3 text-sm">
                  Traslado entre sobres o cuentas. No es un gasto; se muestran ambos extremos sin
                  netearlos.
                </p>
              )}
              {new Set(detail.lines.map((line) => line.accountCurrency)).size > 1 && (
                <p className="hero-caption mt-2 text-sm">Monedas separadas, sin conversión.</p>
              )}
            </section>
            <dl className="grid min-w-0 grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-muted-foreground">Fecha del movimiento</dt>
                <dd className="mt-1 font-medium">{formatTransactionFullDate(detail.date)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-muted-foreground">Fecha de registro</dt>
                <dd className="mt-1 font-medium">{formatAccountingTimestamp(detail.createdAt)}</dd>
                <dd className="mt-1 text-xs text-muted-foreground">
                  {ACCOUNTING_TIME_ZONE} · Puede diferir de la fecha contable.
                </dd>
              </div>
            </dl>
            <section aria-labelledby="movement-description-title" className="min-w-0">
              <h3 id="movement-description-title" className="text-base font-semibold">
                Descripción completa
              </h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">
                {detail.description || "Movimiento sin descripción"}
              </p>
            </section>
            <section aria-labelledby="movement-lines-title" className="min-w-0">
              <h3 id="movement-lines-title" className="text-base font-semibold">
                Desglose completo · {detail.lines.length}{" "}
                {detail.lines.length === 1 ? "línea" : "líneas"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Nombres actuales de cuentas y sobres; importes del registro.
              </p>
              {!detail.lines.length && (
                <Feedback
                  className="mt-3"
                  tone="warning"
                  role="note"
                  title="Registro sin líneas disponibles"
                >
                  No se deduce un importe cero de la falta de detalles.
                </Feedback>
              )}
              <ol className="mt-2 divide-y divide-border">
                {detail.lines.map((line, index) => (
                  <li key={line.id} className="min-w-0 py-4 [overflow-wrap:anywhere]">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Línea {index + 1} ·{" "}
                      {line.amount < 0
                        ? "Salida"
                        : line.amount > 0
                          ? "Entrada"
                          : "Sin efecto monetario"}
                    </p>
                    <dl className="mt-3 grid min-w-0 grid-cols-1 gap-3 text-sm">
                      <div className="min-w-0">
                        <dt className="text-muted-foreground">Cuenta</dt>
                        <dd className="mt-1 font-medium">
                          {line.accountName || `Cuenta sin identificar (#${line.accountId})`}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-muted-foreground">Institución</dt>
                        <dd className="mt-1">
                          {line.institutionName || "Institución no disponible"}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-muted-foreground">Sobre</dt>
                        <dd className="mt-1">
                          {line.categoryName || `Sobre sin identificar (#${line.envelopeId})`}
                        </dd>
                      </div>
                    </dl>
                    {line.envelopeActive === false && (
                      <Badge variant="secondary" className="mt-2">
                        Sobre inactivo · registro conservado
                      </Badge>
                    )}
                    <p className="mt-3 text-lg font-semibold tabular-nums">
                      {detailAmount(line.amount, line.accountCurrency)}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
            <div
              className="flex min-w-0 gap-3 border-t pt-4 text-sm text-muted-foreground"
              role="note"
            >
              <LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-foreground">Consulta de solo lectura</p>
                <p>
                  Editar o borrar no está disponible: todavía no existe un flujo de corrección
                  histórica con trazabilidad. Esta ficha no modifica saldos.
                </p>
              </div>
            </div>
          </>
        )}
        <DialogFooter className="sticky bottom-0 min-w-0 border-t bg-card pt-3">
          <Button variant="outline" onClick={onClose}>
            Volver al historial
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
