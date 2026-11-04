import styles from "@/components/reconciliation/reconciliation.module.css"
import { reconciliationAmount } from "@/lib/reconciliation-review"

export function ReconciliationComparison({
  currency,
  expected,
  counted,
  difference,
  historical = false,
}: {
  currency: string
  expected: number | null
  counted: number | null
  difference: number | null
  historical?: boolean
}) {
  return (
    <section aria-label="Comparación de saldos" className="@container min-w-0 space-y-4">
      <dl className={styles.comparison}>
        <div>
          <dt className="text-sm text-muted-foreground">Saldo calculado al corte</dt>
          <dd className={styles.amount}>
            {expected === null ? "Por confirmar" : reconciliationAmount(expected, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">
            Saldo real {historical ? "registrado" : "contado"}
          </dt>
          <dd className={styles.amount}>
            {counted === null ? "Por confirmar" : reconciliationAmount(counted, currency)}
          </dd>
        </div>
      </dl>
      <div className="atlantic-hero min-w-0 p-4 sm:p-5">
        <p className="hero-caption text-sm">
          {historical ? "Diferencia registrada al guardar" : "Diferencia de esta comparación"}
        </p>
        <p className="mt-2 text-2xl font-semibold tabular-nums [overflow-wrap:anywhere]">
          {difference === null ? "Por confirmar" : reconciliationAmount(difference, currency, true)}
        </p>
        <p className="hero-caption mt-2 text-sm">
          {difference === null
            ? "Completa el saldo real y confirma el saldo calculado para comparar."
            : difference === 0
              ? "Los dos importes de esta comparación coinciden."
              : difference > 0
                ? "El saldo real de esta comparación es mayor que el calculado al corte."
                : "El saldo real de esta comparación es menor que el calculado al corte."}
        </p>
      </div>
    </section>
  )
}
