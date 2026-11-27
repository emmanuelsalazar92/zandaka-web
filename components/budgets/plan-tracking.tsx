import Link from "next/link"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Feedback, LoadingState } from "@/components/ui/feedback"
import { loadBudgetTracking, type BudgetTracking } from "@/lib/budget-plan-tracking"
import { formatPlanMoney as money, planDecimal } from "@/lib/budget-plan-view"
import { formatIsoDateOnly } from "@/lib/date-only"

type Row = BudgetTracking["rows"][number]

function TrackingRow({ row, month }: { row: Row; month: string }) {
  const { planned, assigned, spent, currency } = row
  const pending =
    planned !== null && assigned !== null
      ? money(planDecimal(planned).minus(assigned).clamp(0, planned).toFixed(), currency)
      : "—"
  const available = planned === null ? null : planDecimal(planned).minus(spent)
  const excess = assigned === null ? null : planDecimal(spent).minus(assigned)
  const href = `/transactions?${new URLSearchParams({
    source: "budget-tracking",
    month,
    accountId: String(row.accountId),
    accountEnvelopeId: String(row.envelopeId),
  })}`
  return (
    <li className="min-w-0 space-y-3 py-4 wrap-anywhere">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-semibold">{row.categoryName}</h4>
          <p className="text-sm text-muted-foreground">
            {row.accountName}
            {!row.active && " · Inactivo"}
          </p>
        </div>
        <Link
          href={href}
          className="text-sm text-primary underline underline-offset-4"
          aria-label={`Ver gastos de ${row.categoryName}, ${row.accountName}`}
        >
          Ver gastos
        </Link>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm @sm:grid-cols-3">
        {[
          ["Planeado", row.hasPlan ? money(planned, currency) : "Sin plan"],
          ["Asignado", assigned === null ? "Por verificar" : money(assigned, currency)],
          ["Gastado", money(spent, currency)],
          ["Falta asignar", pending],
          ["Restante del plan", available === null ? "—" : money(available.toFixed(), currency)],
          [
            "Exceso sobre lo asignado",
            excess === null ? "—" : money(excess.lt(0) ? "0" : excess.toFixed(), currency),
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </li>
  )
}

export function PlanTracking({
  planId,
  month,
  revision,
  dirty,
  onReload,
}: {
  planId: string
  month: string
  revision: number
  dirty: boolean
  onReload: () => void
}) {
  const [request, setRequest] = useState(0)
  const [result, setResult] = useState<{ request: number; data: BudgetTracking | null } | null>(
    null,
  )
  useEffect(() => {
    const controller = new AbortController()
    loadBudgetTracking(planId, month, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ request, data })
      },
      () => {
        if (!controller.signal.aborted) setResult({ request, data: null })
      },
    )
    return () => controller.abort()
  }, [planId, month, request])
  if (result?.request !== request) return <LoadingState>Consultando gastos del mes…</LoadingState>
  const data = result.data
  if (!data)
    return (
      <Feedback tone="warning" title="Seguimiento no disponible">
        <Button variant="outline" onClick={() => setRequest((value) => value + 1)}>
          Volver a consultar
        </Button>
      </Feedback>
    )
  if (data.revision !== revision)
    return (
      <Feedback tone="warning" title="El presupuesto cambió">
        <Button variant="outline" onClick={onReload}>
          Actualizar presupuesto
        </Button>
      </Feedback>
    )
  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Seguimiento por sobre</h2>
          <p className="text-sm text-muted-foreground">
            {formatIsoDateOnly(data.from)} al {formatIsoDateOnly(data.to)} · Fecha contable
          </p>
        </div>
        <Button variant="outline" onClick={() => setRequest((value) => value + 1)}>
          Actualizar seguimiento
        </Button>
      </div>
      {dirty && (
        <p className="text-sm text-muted-foreground">
          Los importes planeados corresponden a la revisión guardada.
        </p>
      )}
      {data.fundingStatus === "unverified" && (
        <Feedback tone="warning" title="Asignación por verificar">
          El recibo del plan no se pudo verificar.
        </Feedback>
      )}
      {data.fundingDate && (
        <p className="text-sm text-muted-foreground">
          Asignación registrada el {formatIsoDateOnly(data.fundingDate)}.
        </p>
      )}
      {data.unmappedCount > 0 && (
        <p className="text-sm text-muted-foreground">
          Líneas con destino por confirmar · {data.unmappedCount}
        </p>
      )}
      {data.rows.length === 0 && (
        <Feedback tone="info" title="Todavía no hay sobres para comparar">
          Agrega un destino al plan o registra un gasto del mes.
        </Feedback>
      )}
      {(["CRC", "USD"] as const).map((currency) => {
        const rows = data.rows.filter((row) => row.currency === currency)
        return (
          rows.length > 0 && (
            <section key={currency} aria-labelledby={`tracking-${currency}`}>
              <h3 id={`tracking-${currency}`} className="font-semibold">
                {currency === "CRC" ? "Colones · CRC" : "Dólares · USD"}
              </h3>
              <ul className="mt-2 divide-y border-y">
                {rows.map((row) => (
                  <TrackingRow key={row.envelopeId} row={row} month={month} />
                ))}
              </ul>
            </section>
          )
        )
      })}
      <p className="text-sm text-muted-foreground">
        El gasto es bruto. Las devoluciones, los ingresos y los traslados no se descuentan del
        gasto.
      </p>
    </div>
  )
}
