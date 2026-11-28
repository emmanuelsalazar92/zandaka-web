import Link from "next/link"
import { useEffect, useState } from "react"

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
import { PlanApiError } from "@/lib/budget-plan-api"
import { formatPlanMoney as money } from "@/lib/budget-plan-view"
import {
  loadSubscriptionCatalog,
  loadSubscriptionPlan,
  saveSubscriptionDefinition,
  type SubscriptionCatalogItem,
  type SubscriptionOccurrence,
  type SubscriptionPlan,
} from "@/lib/budget-subscriptions"
import { formatIsoDateOnly } from "@/lib/date-only"
import { secureUuid } from "@/lib/uuid"

import { AmountField, PlanField } from "./plan-fields"
import styles from "./plan.module.css"
import { SubscriptionChargeDialog } from "./subscription-charge-dialog"

const emptyDefinition = () =>
  ({
    id: secureUuid(),
    revision: 0,
    definition: {
      name: "",
      amount: "",
      currency: "USD",
      payCurrency: "CRC",
      iva: "13",
      roundUsd: "up",
    },
  }) satisfies SubscriptionCatalogItem

function DefinitionEditor({
  item,
  onClose,
  onSaved,
}: {
  item: SubscriptionCatalogItem
  onClose: () => void
  onSaved: () => void
}) {
  const [definition, setDefinition] = useState(item.definition)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [uncertain, setUncertain] = useState(false)
  const save = async () => {
    setBusy(true)
    setError("")
    try {
      await saveSubscriptionDefinition({
        ...item,
        definition: { ...definition, name: definition.name.trim() },
      })
      onSaved()
    } catch (cause) {
      const pending = cause instanceof PlanApiError && cause.uncertain
      setUncertain(pending)
      setError(
        pending
          ? "No se confirmó el resultado. Puedes reintentar los mismos datos."
          : cause instanceof PlanApiError && cause.status === 409
            ? "La suscripción cambió. Cierra y actualiza el catálogo."
            : "Revisa el nombre, el precio positivo y el IVA entre 0 y 100 %. El precio admite dos decimales.",
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent className="marea-surface max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item.revision ? "Editar suscripción" : "Nueva suscripción"}</DialogTitle>
          <DialogDescription>
            El catálogo se copia al incorporar el servicio a un mes. Los presupuestos guardados
            conservan sus importes.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <Feedback tone="warning" title="Revisa la suscripción">
            {error}
          </Feedback>
        )}
        <fieldset disabled={busy || uncertain} className="space-y-4">
          <PlanField label="Nombre del servicio">
            <Input
              maxLength={80}
              value={definition.name}
              onChange={(e) => setDefinition({ ...definition, name: e.target.value })}
            />
          </PlanField>
          <AmountField
            label="Precio original"
            value={definition.amount}
            onChange={(amount) => setDefinition({ ...definition, amount })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <PlanField label="Moneda de origen">
              <select
                className={styles.select}
                value={definition.currency}
                onChange={(e) => {
                  const currency = e.target.value as "USD" | "CRC"
                  setDefinition({
                    ...definition,
                    currency,
                    payCurrency: currency === "CRC" ? "CRC" : definition.payCurrency,
                  })
                }}
              >
                <option value="USD">USD</option>
                <option value="CRC">CRC</option>
              </select>
            </PlanField>
            <PlanField label="Moneda de cobro">
              <select
                className={styles.select}
                value={definition.payCurrency}
                onChange={(e) =>
                  setDefinition({ ...definition, payCurrency: e.target.value as "USD" | "CRC" })
                }
              >
                <option value="CRC">CRC</option>
                {definition.currency === "USD" && <option value="USD">USD</option>}
              </select>
            </PlanField>
            <AmountField
              label="IVA · %"
              value={definition.iva}
              onChange={(iva) => setDefinition({ ...definition, iva })}
            />
            {definition.payCurrency === "CRC" && (
              <PlanField
                label="Reserva USD"
                help="El cobro CRC se redondea al múltiplo de 50 más cercano."
              >
                <select
                  className={styles.select}
                  value={definition.roundUsd}
                  onChange={(e) =>
                    setDefinition({ ...definition, roundUsd: e.target.value as "none" | "up" })
                  }
                >
                  <option value="up">Al dólar superior</option>
                  <option value="none">Sin redondeo adicional</option>
                </select>
              </PlanField>
            )}
          </div>
        </fieldset>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cerrar
          </Button>
          <Button
            disabled={
              busy || !definition.name.trim() || !definition.amount || definition.iva === ""
            }
            onClick={() => void save()}
          >
            {uncertain ? "Reintentar guardado" : "Guardar suscripción"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PlanSubscriptions({
  planId,
  revision,
  chargeId,
  blocked,
  canAdd,
  onAdd,
  onReload,
}: {
  planId: string
  revision: number
  chargeId?: number
  blocked: boolean
  canAdd: boolean
  onAdd: (item: SubscriptionCatalogItem) => void
  onReload: () => void
}) {
  const [request, setRequest] = useState(0)
  const [result, setResult] = useState<{
    request: number
    items: SubscriptionCatalogItem[]
    plan: SubscriptionPlan | null
  } | null>(null)
  const [failed, setFailed] = useState(-1)
  const [editing, setEditing] = useState<SubscriptionCatalogItem | null>(null)
  const [selected, setSelected] = useState<SubscriptionOccurrence | null>(null)
  const refresh = () => setRequest((value) => value + 1)
  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      loadSubscriptionCatalog(controller.signal),
      revision ? loadSubscriptionPlan(planId, controller.signal) : null,
    ]).then(
      ([items, plan]) => {
        if (!controller.signal.aborted) setResult({ request, items, plan })
      },
      () => {
        if (!controller.signal.aborted) setFailed(request)
      },
    )
    return () => controller.abort()
  }, [planId, revision, request])
  if (failed === request)
    return (
      <Feedback tone="warning" title="Suscripciones no disponibles">
        <Button variant="outline" onClick={refresh}>
          Volver a consultar
        </Button>
      </Feedback>
    )
  if (result?.request !== request) return <LoadingState>Consultando suscripciones…</LoadingState>
  const { plan, items } = result
  if (plan && plan.revision !== revision)
    return (
      <Feedback tone="warning" title="El presupuesto cambió">
        <Button variant="outline" onClick={onReload}>
          Actualizar presupuesto
        </Button>
      </Feedback>
    )
  return (
    <div className="min-w-0 space-y-6 wrap-anywhere">
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Previsión y cargos</h2>
        {chargeId && (
          <p className="text-sm text-muted-foreground">
            Selecciona la previsión para vincular el movimiento #{chargeId}.
          </p>
        )}
        {blocked && (
          <p className="text-sm text-muted-foreground">
            Guarda o resuelve los cambios del presupuesto antes de confirmar cargos.
          </p>
        )}
        {!plan?.occurrences.length && (
          <p className="text-sm text-muted-foreground">
            Las suscripciones aparecen aquí después de guardar el mes.
          </p>
        )}
        {!!plan?.detachedCount && (
          <p className="text-sm text-muted-foreground">
            Este mes tiene vínculos de líneas anteriores. Los cargos siguen en Movimientos.
          </p>
        )}
        {!!plan?.occurrences.length && (
          <ul className="divide-y border-y">
            {plan.occurrences.map((item) => {
              const receipt = item.receipt
              const hasCurrent = receipt?.current === true
              return (
                <li key={item.lineId} className="space-y-3 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{item.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {item.accountName ?? "Cuenta por confirmar"}
                        {item.categoryName && ` · ${item.categoryName}`}
                      </p>
                    </div>
                    {!hasCurrent && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={blocked || item.planned === null || !item.accountId}
                        onClick={() => setSelected(item)}
                      >
                        {receipt ? "Revisar vínculo" : "Vincular cargo"}
                      </Button>
                    )}
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm @sm:grid-cols-3">
                    <div>
                      <dt className="text-muted-foreground">Previsto</dt>
                      <dd className="font-semibold tabular-nums">
                        {money(item.planned, item.currency)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Cargo real</dt>
                      <dd className="font-semibold tabular-nums">
                        {hasCurrent
                          ? money(receipt.amount, item.currency)
                          : receipt
                            ? "Por revisar"
                            : "Pendiente"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Diferencia</dt>
                      <dd className="font-semibold tabular-nums">
                        {hasCurrent ? money(receipt.difference, item.currency) : "—"}
                      </dd>
                    </div>
                  </dl>
                  {receipt && (
                    <div className="text-sm text-muted-foreground">
                      <Link
                        href={`/transactions?movementId=${receipt.transactionId}`}
                        className="text-primary underline"
                      >
                        Movimiento #{receipt.transactionId}
                      </Link>
                      {" · "}
                      {formatIsoDateOnly(receipt.date)}
                      {receipt.description && ` · ${receipt.description}`}
                      {!hasCurrent && (
                        <p>Vínculo anterior · {money(receipt.amount, receipt.forecast.currency)}</p>
                      )}
                    </div>
                  )}
                  <details className="text-sm">
                    <summary className="cursor-pointer font-medium">
                      Ver fórmula de {item.name}
                    </summary>
                    <p className="mt-2 text-muted-foreground">
                      {money(item.originalAmount, item.originalCurrency)} · IVA {item.iva} %
                      {item.source && ` · Versión de catálogo ${item.source.revision}`}
                    </p>
                    {item.currency === "CRC" && item.quoteSource && (
                      <p className="text-muted-foreground">
                        Cotización de planificación · {item.quoteSource}
                        {item.quoteDate && ` · ${formatIsoDateOnly(item.quoteDate)}`}
                      </p>
                    )}
                    <ul className="space-y-1">
                      {item.explanation.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </details>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-lg font-semibold">Catálogo de suscripciones</h2>
          <Button variant="outline" onClick={() => setEditing(emptyDefinition())}>
            Nueva suscripción
          </Button>
        </div>
        {!items.length && (
          <p className="text-sm text-muted-foreground">
            Guarda los servicios que quieras reutilizar en otros meses.
          </p>
        )}
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <h3 className="font-medium">{item.definition.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {money(item.definition.amount, item.definition.currency)} · IVA{" "}
                  {item.definition.iva} % · Cobro en {item.definition.payCurrency}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Editar suscripción ${item.definition.name}`}
                  onClick={() => setEditing(item)}
                >
                  Editar
                </Button>
                {canAdd && (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Añadir ${item.definition.name} al mes`}
                    onClick={() => onAdd(item)}
                  >
                    Añadir al mes
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
      {editing && (
        <DefinitionEditor
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}
      {selected && plan && (
        <SubscriptionChargeDialog
          occurrence={selected}
          plan={plan}
          chargeId={chargeId}
          onClose={() => {
            setSelected(null)
            refresh()
          }}
          onConfirm={(next) => {
            setSelected(null)
            setResult({ request, items, plan: next })
          }}
        />
      )}
    </div>
  )
}
