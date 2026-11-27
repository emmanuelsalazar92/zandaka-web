import Link from "next/link"
import { useEffect, useState } from "react"

import { TransferComposer } from "@/components/transfers/transfer-composer"
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
import {
  loadMonthStartMovement,
  requestMonthStart,
  type MonthStart,
  type MonthStartStep,
} from "@/lib/budget-month-start"
import { PLAN_USER_ID, PlanApiError, type PlanOptions } from "@/lib/budget-plan-api"
import { formatPlanMoney as money, planDecimal } from "@/lib/budget-plan-view"
import { formatIsoDateOnly, getAccountingDate } from "@/lib/date-only"
import { detailAmount, type TransactionDetail } from "@/lib/transaction-detail"
import { pendingTransferExists } from "@/lib/transfer"

export function useMonthStart(planId: string, revision: number) {
  const [result, setResult] = useState<{ revision: number; data: MonthStart | null } | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!revision) return
    const controller = new AbortController()
    requestMonthStart(planId, revision, undefined, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ revision, data })
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ revision, data: null })
      })
    return () => controller.abort()
  }, [planId, revision, attempt])
  return {
    data: result?.revision === revision ? result.data : null,
    unavailable: result?.revision === revision && !result.data,
    refresh: () => setAttempt((value) => value + 1),
    update: (data: MonthStart) => setResult({ revision: data.revision, data }),
  }
}

function LinkMovement({
  step,
  data,
  onClose,
  onConfirmed,
  expectedCredit,
}: {
  step: MonthStartStep
  data: MonthStart
  onClose: () => void
  onConfirmed: (value: MonthStart) => void
  expectedCredit: string | null
}) {
  const previous = step.evidence?.movements ?? []
  const [debit, setDebit] = useState(previous[0] ? String(previous[0].id) : "")
  const [credit, setCredit] = useState(
    step.kind === "fx" && previous[1] ? String(previous[1].id) : "",
  )
  const [review, setReview] = useState<TransactionDetail[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [uncertain, setUncertain] = useState(false)
  const ids = (step.kind === "fx" ? [debit, credit] : [debit]).map((value) => Number(value))
  const valid =
    ids.every((id) => Number.isSafeInteger(id) && id > 0) && new Set(ids).size === ids.length
  const inspect = async () => {
    setBusy(true)
    setError("")
    try {
      setReview(
        await Promise.all(ids.map((id) => loadMonthStartMovement(id, AbortSignal.timeout(15_000)))),
      )
    } catch {
      setError("No pudimos consultar los movimientos seleccionados. Comprueba los identificadores.")
    } finally {
      setBusy(false)
    }
  }
  const confirm = async () => {
    if (!review) return
    setBusy(true)
    setError("")
    try {
      const result = await requestMonthStart(data.planId, data.revision, {
        step,
        movementIds: review.map((movement) => movement.id),
      })
      onConfirmed(result)
    } catch (cause) {
      const pending = cause instanceof PlanApiError && cause.uncertain
      setUncertain(pending)
      setError(
        pending
          ? "Resultado por confirmar. Reintenta con estos mismos movimientos o cierra y actualiza la guía."
          : cause instanceof PlanApiError && cause.status === 409
            ? "Actualiza el presupuesto. El paso cambió o el movimiento ya está vinculado."
            : "El movimiento no coincide con el tipo, la cuenta, el sobre o la moneda del paso.",
      )
    } finally {
      setBusy(false)
    }
  }
  const first = review?.[0]?.lines.find((line) => line.amount < 0)
  const second = (step.kind === "fx" ? review?.[1] : review?.[0])?.lines.find(
    (line) => line.amount > 0,
  )
  const validDebit =
    first &&
    (first.accountId === step.fromAccountId || first.accountId === step.alternateFromAccountId) &&
    first.accountCurrency === step.currency &&
    (step.fromEnvelopeId === null || first.envelopeId === step.fromEnvelopeId)
  const compatible =
    validDebit &&
    (step.kind === "transfer"
      ? review?.[0].type === "TRANSFER" &&
        review[0].lines.length === 2 &&
        second?.accountId === step.toAccountId &&
        second.envelopeId === step.toEnvelopeId &&
        second.accountCurrency === step.currency &&
        second.amount === -first.amount
      : review?.[0].type === "EXPENSE" &&
        review[0].lines.length === 1 &&
        (step.kind === "payment" ||
          (review[1]?.type === "INCOME" &&
            review[1].lines.length === 1 &&
            second?.accountCurrency === "CRC" &&
            second.accountId !== first.accountId)))
  const differs =
    compatible &&
    (!planDecimal(step.planned).eq(-first.amount) ||
      (step.kind === "fx" &&
        second &&
        expectedCredit !== null &&
        !planDecimal(expectedCredit).eq(second.amount)))
  const fxRate =
    compatible && step.kind === "fx" && second
      ? planDecimal(String(second.amount))
          .abs()
          .div(planDecimal(String(first.amount)).abs())
          .toFixed(6)
      : null
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent className="marea-surface sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Vincular movimiento · {step.label}</DialogTitle>
          <DialogDescription>
            {step.kind === "fx"
              ? "Si ya hiciste el cambio en el banco, revisa la salida USD y la entrada CRC registradas."
              : "Revisa el movimiento registrado en Zandaka antes de vincularlo."}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm">
          Previsto · {money(step.planned, step.currency)}
          {step.kind === "fx" && expectedCredit !== null && ` → ${money(expectedCredit, "CRC")}`}
        </p>
        {error && (
          <Feedback tone="warning" title="Revisa la vinculación">
            {error}
          </Feedback>
        )}
        {review ? (
          <ul className="space-y-3 text-sm">
            {review.map((movement) => (
              <li key={movement.id} className="rounded-xl border p-3">
                <p className="font-semibold">
                  #{movement.id} · {movement.description || "Sin descripción"}
                </p>
                <p>
                  {formatIsoDateOnly(movement.date)} ·{" "}
                  {
                    {
                      INCOME: "Ingreso",
                      EXPENSE: "Gasto",
                      TRANSFER: "Transferencia",
                      ADJUSTMENT: "Ajuste",
                    }[movement.type]
                  }
                </p>
                {movement.lines.map((line) => (
                  <p key={line.id}>
                    {line.accountName ?? "Cuenta por verificar"} ·{" "}
                    {line.categoryName ?? "Sobre por verificar"} ·{" "}
                    {detailAmount(line.amount, line.accountCurrency)}
                  </p>
                ))}
              </li>
            ))}
            {fxRate !== null && (
              <li>
                Tasa según los importes seleccionados ·{" "}
                {Number(fxRate).toLocaleString("es-CR", { maximumFractionDigits: 6 })} CRC por USD
              </li>
            )}
            {differs && (
              <li>Los importes reales difieren del plan. Revisa los montos antes de confirmar.</li>
            )}
            {!compatible && (
              <li>
                La selección no coincide con el tipo, la cuenta, el sobre o la moneda de este paso.
              </li>
            )}
          </ul>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="month-start-debit">
                {step.kind === "fx" ? "ID de salida en USD" : "ID del movimiento"}
              </Label>
              <Input
                id="month-start-debit"
                inputMode="numeric"
                value={debit}
                onChange={(event) => setDebit(event.target.value)}
              />
            </div>
            {step.kind === "fx" && (
              <div className="space-y-1">
                <Label htmlFor="month-start-credit">ID de entrada en CRC</Label>
                <Input
                  id="month-start-credit"
                  inputMode="numeric"
                  value={credit}
                  onChange={(event) => setCredit(event.target.value)}
                />
              </div>
            )}
            <Link
              className="text-sm text-primary underline"
              href={`/transactions?source=account-context&accountId=${step.fromAccountId}`}
              target="_blank"
              rel="noopener"
            >
              Buscar en Movimientos
            </Link>
            {step.kind === "fx" && (
              <Link
                className="block text-sm text-primary underline"
                href="/transactions"
                target="_blank"
                rel="noopener"
              >
                Buscar la entrada en CRC
              </Link>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cerrar
          </Button>
          {review ? (
            <>
              <Button
                variant="ghost"
                disabled={busy || uncertain}
                onClick={() => {
                  setReview(null)
                  setError("")
                }}
              >
                Cambiar selección
              </Button>
              <Button disabled={busy || !compatible} onClick={() => void confirm()}>
                {uncertain ? "Reintentar vínculo" : "Confirmar vínculo"}
              </Button>
            </>
          ) : (
            <Button disabled={busy || !valid} onClick={() => void inspect()}>
              Revisar movimientos
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PlanMonthStartActions({
  data,
  options,
  dirty,
  refresh,
  update,
  expectedCredit,
}: {
  data: MonthStart
  options: PlanOptions
  dirty: boolean
  refresh: () => void
  update: (value: MonthStart) => void
  expectedCredit: string | null
}) {
  const [active, setActive] = useState<{ type: "link" | "create"; step: MonthStartStep } | null>(
    null,
  )
  const [, setPending] = useState(false)
  const close = () => {
    setActive(null)
    refresh()
  }
  const account = (id: number) =>
    options.accounts.find((item) => item.id === id)?.name ?? `Cuenta #${id}`
  const actions = [...data.steps].sort((a, b) => {
    const order = { fx: 0, transfer: 1, payment: 2 }
    return order[a.kind] - order[b.kind]
  })
  return (
    <div className="space-y-3 border-t pt-4">
      <h3 className="font-semibold">Movimientos de inicio de mes</h3>
      {dirty && (
        <p className="text-sm text-muted-foreground">
          Guarda los cambios del plan para revisar sus movimientos.
        </p>
      )}
      {data.detachedCount > 0 && (
        <p className="text-sm text-muted-foreground">
          Hay vínculos de pasos anteriores por revisar. Sus movimientos siguen en el historial.
        </p>
      )}
      {actions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Completa el ingreso, la tasa y los destinos para revisar los movimientos.
        </p>
      )}
      <ul className="divide-y">
        {actions.map((step) => {
          const pending =
            step.kind === "transfer" &&
            pendingTransferExists(PLAN_USER_ID, `${data.planId}.${data.revision}.${step.key}`)
          return (
            <li key={step.key} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {step.kind === "payment" ? `Pago · ${step.label}` : step.label}
                </p>
                <p className="text-sm text-muted-foreground">
                  {account(step.fromAccountId)}
                  {step.alternateFromAccountId && ` o ${account(step.alternateFromAccountId)}`}
                  {step.toAccountId && ` → ${account(step.toAccountId)}`} ·{" "}
                  {money(step.planned, step.currency)} previstos
                </p>
                <p className="text-sm">
                  {pending
                    ? "Resultado por confirmar"
                    : step.evidence?.current && !dirty
                      ? "Confirmado"
                      : step.evidence
                        ? "Por revisar"
                        : "Por verificar"}
                </p>
                {step.evidence?.movements.map((item, index) => (
                  <p key={`${item.id}.${index}`} className="text-sm text-muted-foreground">
                    <Link
                      className="text-primary underline"
                      href={`/transactions?movementId=${item.id}`}
                    >
                      Movimiento #{item.id}
                    </Link>
                    {" · "}
                    {item.accountName ?? account(item.accountId)} ·{" "}
                    {money(item.amount, item.currency)} · {formatIsoDateOnly(item.date)}
                  </p>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {!step.evidence?.current && !pending && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={dirty}
                    onClick={() => setActive({ type: "link", step })}
                  >
                    {step.evidence ? "Revisar vínculo" : "Vincular movimiento"}
                  </Button>
                )}
                {step.kind === "transfer" && (!step.evidence || pending) && (
                  <Button
                    size="sm"
                    disabled={dirty}
                    onClick={() => setActive({ type: "create", step })}
                  >
                    {pending ? "Recuperar transferencia" : "Preparar transferencia"}
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {active?.type === "link" && (
        <LinkMovement
          step={active.step}
          data={data}
          expectedCredit={expectedCredit}
          onClose={close}
          onConfirmed={(value) => {
            update(value)
            setActive(null)
          }}
        />
      )}
      {active?.type === "create" &&
        active.step.fromEnvelopeId &&
        active.step.toAccountId &&
        active.step.toEnvelopeId && (
          <Dialog
            open
            onOpenChange={(open) => {
              if (!open) close()
            }}
          >
            <DialogContent className="marea-surface sm:max-w-3xl">
              <TransferComposer
                accounts={options.accounts}
                accountsLoading={false}
                accountsError={null}
                initialDate={getAccountingDate()}
                initialDescription="Traslado de fondos de inicio de mes"
                userId={PLAN_USER_ID}
                budgetStep={{
                  planId: data.planId,
                  revision: data.revision,
                  step: active.step.key,
                  from: {
                    accountId: active.step.fromAccountId,
                    envelopeId: active.step.fromEnvelopeId,
                  },
                  to: { accountId: active.step.toAccountId, envelopeId: active.step.toEnvelopeId },
                  planned: active.step.planned,
                }}
                onTypeChange={() => {}}
                onClose={close}
                onConfirmed={close}
                onPendingChange={setPending}
                onRefreshAccounts={() => {}}
              />
            </DialogContent>
          </Dialog>
        )}
    </div>
  )
}
