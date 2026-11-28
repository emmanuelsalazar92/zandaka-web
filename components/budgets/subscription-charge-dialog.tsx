import Link from "next/link"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Feedback } from "@/components/ui/feedback"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loadMonthStartMovement } from "@/lib/budget-month-start"
import { PlanApiError } from "@/lib/budget-plan-api"
import { formatPlanMoney as money, planDecimal } from "@/lib/budget-plan-view"
import {
  linkSubscriptionCharge,
  subscriptionChargeId,
  type SubscriptionOccurrence,
  type SubscriptionPlan,
} from "@/lib/budget-subscriptions"
import { formatIsoDateOnly } from "@/lib/date-only"
import { detailAmount, type TransactionDetail } from "@/lib/transaction-detail"

export function SubscriptionChargeDialog({
  occurrence,
  plan,
  chargeId,
  onClose,
  onConfirm,
}: {
  occurrence: SubscriptionOccurrence
  plan: SubscriptionPlan
  chargeId?: number
  onClose: () => void
  onConfirm: (plan: SubscriptionPlan) => void
}) {
  const original = occurrence.receipt
  const [transactionId, setTransactionId] = useState(
    String(original?.transactionId ?? chargeId ?? ""),
  )
  const [transaction, setTransaction] = useState<TransactionDetail | null>(null)
  const [lineId, setLineId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [error, setError] = useState("")
  const compatible = (line: TransactionDetail["lines"][number]) =>
    line.amount < 0 &&
    line.envelopeActive !== null &&
    line.accountId === occurrence.accountId &&
    line.accountCurrency === occurrence.currency &&
    (!original || original.transactionLineId === line.id)
  const inspect = async () => {
    const id = subscriptionChargeId(transactionId.trim())
    if (!id) return
    setBusy(true)
    setError("")
    try {
      const record = await loadMonthStartMovement(id, AbortSignal.timeout(15_000))
      setTransaction(record)
      const eligible = record.type === "EXPENSE" ? record.lines.filter(compatible) : []
      setLineId(eligible.length === 1 ? eligible[0].id : null)
    } catch {
      setError("No pudimos consultar ese movimiento. Verifica el identificador.")
    } finally {
      setBusy(false)
    }
  }
  const confirm = async () => {
    if (!transaction || lineId === null) return
    setBusy(true)
    setError("")
    try {
      onConfirm(await linkSubscriptionCharge(plan, occurrence.lineId, transaction.id, lineId))
    } catch (cause) {
      const pending = cause instanceof PlanApiError && cause.uncertain
      setUncertain(pending)
      setError(
        pending
          ? "Resultado por confirmar. Reintenta con el mismo cargo o vuelve a consultar la previsión."
          : cause instanceof PlanApiError && cause.status === 409
            ? "El cargo ya está vinculado o el presupuesto cambió. Actualiza y revisa."
            : "El cargo no coincide con la cuenta, la moneda o el tipo de movimiento requerido.",
      )
    } finally {
      setBusy(false)
    }
  }
  const chosen = transaction?.lines.find((line) => line.id === lineId)
  const difference =
    chosen && occurrence.planned !== null
      ? planDecimal(String(chosen.amount)).abs().minus(occurrence.planned).toFixed()
      : null
  const hasCandidate = transaction?.type === "EXPENSE" && transaction.lines.some(compatible)

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent className="marea-surface max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular cargo · {occurrence.name}</DialogTitle>
          <DialogDescription>
            Revisa el gasto registrado y selecciona su línea antes de confirmar.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm">
          Previsto · {money(occurrence.planned, occurrence.currency)} · {occurrence.accountName}
        </p>
        {error && (
          <Feedback tone="warning" title="Revisa el cargo">
            {error}
          </Feedback>
        )}
        {!transaction ? (
          <div className="space-y-2">
            <Label htmlFor="subscription-charge-id">ID del movimiento</Label>
            <Input
              id="subscription-charge-id"
              inputMode="numeric"
              value={transactionId}
              disabled={!!original || busy}
              onChange={(event) => setTransactionId(event.target.value)}
            />
            <Link
              href={`/transactions?source=account-context&accountId=${occurrence.accountId}`}
              className="text-sm text-primary underline"
              target="_blank"
              rel="noopener"
            >
              Buscar en Movimientos
            </Link>
          </div>
        ) : (
          <fieldset className="min-w-0 space-y-2 text-sm">
            <legend className="font-semibold">
              #{transaction.id} · {transaction.description || "Sin descripción"} ·{" "}
              {formatIsoDateOnly(transaction.date)}
            </legend>
            {transaction.lines.map((line) => (
              <label key={line.id} className="flex items-start gap-2 rounded-lg border p-3">
                <input
                  type="radio"
                  name="subscription-charge-line"
                  checked={lineId === line.id}
                  disabled={
                    busy || uncertain || transaction.type !== "EXPENSE" || !compatible(line)
                  }
                  onChange={() => setLineId(line.id)}
                />
                <span>
                  {line.accountName ?? "Cuenta por verificar"} ·{" "}
                  {line.categoryName ?? "Sobre por verificar"} ·{" "}
                  {detailAmount(line.amount, line.accountCurrency)}
                </span>
              </label>
            ))}
            {!hasCandidate && (
              <p>El gasto debe tener un débito en la cuenta prevista y en {occurrence.currency}.</p>
            )}
            {difference !== null && <p>Diferencia · {money(difference, occurrence.currency)}</p>}
          </fieldset>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cerrar
          </Button>
          {transaction ? (
            <>
              <Button
                variant="ghost"
                disabled={busy || uncertain}
                onClick={() => {
                  setTransaction(null)
                  setError("")
                }}
              >
                Cambiar selección
              </Button>
              <Button disabled={busy || lineId === null} onClick={() => void confirm()}>
                {uncertain ? "Reintentar vínculo" : "Confirmar cargo"}
              </Button>
            </>
          ) : (
            <Button
              disabled={busy || !subscriptionChargeId(transactionId.trim())}
              onClick={() => void inspect()}
            >
              Revisar cargo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
