import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/ui/feedback"
import { formatSignedCurrency } from "@/lib/currency-formatter"
import type { DashboardSummary } from "@/lib/dashboard-api"
import { dashboardHistoryLink } from "@/lib/dashboard-period"
import { formatIsoDateOnly } from "@/lib/date-only"

import styles from "./dashboard.module.css"

export function DashboardAttention({
  summary,
  loading,
  retry,
}: {
  summary: DashboardSummary | null
  loading: boolean
  retry: () => void
}) {
  const negatives = summary?.negativeEnvelopes ?? []
  const differences = summary?.inconsistencies ?? []
  return (
    <section
      id="dashboard-attention"
      aria-labelledby="dashboard-attention-title"
      className={styles.attention}
    >
      <p className={styles.eyebrow}>PARA REVISAR</p>
      <h2 id="dashboard-attention-title" className={styles.title}>
        Tu atención, donde importa.
      </h2>
      <p className={styles.caption}>
        Estado registrado, sin filtro de período. Cada diferencia conserva su fecha de corte.
      </p>
      {loading ? (
        <LoadingState>Consultando incidencias…</LoadingState>
      ) : (
        <>
          <h3 className="mt-5 text-sm font-semibold">Sobres con saldo negativo</h3>
          {!summary?.negativeEnvelopesAvailable ? (
            <p className={styles.caption}>Sobres por confirmar.</p>
          ) : negatives.length === 0 ? (
            <p className={styles.caption}>Ningún sobre activo tiene saldo negativo.</p>
          ) : (
            <ul className={styles.list}>
              {negatives.map((item) => (
                <li key={item.envelopeId}>
                  <Link
                    className={styles.attentionRow}
                    href={dashboardHistoryLink({
                      accountId: String(item.accountId),
                      categoryId: String(item.categoryId),
                    })}
                  >
                    <span>
                      <strong>{item.categoryName}</strong>
                      <span className={styles.caption}>
                        {item.accountName} · {item.currency}
                      </span>
                    </span>
                    <span className={styles.negative}>
                      {formatSignedCurrency(item.balance, item.currency)}
                      <span className={styles.caption}>Ver movimientos del sobre</span>
                    </span>
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-5 text-sm font-semibold">Diferencias abiertas</h3>
          {!summary?.inconsistenciesAvailable ? (
            <p className={styles.caption}>Conciliaciones por confirmar.</p>
          ) : differences.length === 0 ? (
            <p className={styles.caption}>Sin diferencias abiertas registradas.</p>
          ) : (
            <ul className={styles.list}>
              {differences.map((item) => (
                <li key={item.accountId}>
                  <Link
                    className={styles.attentionRow}
                    href={`/reconciliation?source=dashboard&accountId=${item.accountId}`}
                  >
                    <span>
                      <strong>{item.accountName}</strong>
                      <span className={styles.caption}>
                        Corte {formatIsoDateOnly(item.reconciliationDate)} · {item.currency}
                      </span>
                    </span>
                    <span>
                      {formatSignedCurrency(item.difference, item.currency)}
                      <span className={styles.caption}>Revisar conciliación</span>
                    </span>
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {(!summary?.negativeEnvelopesAvailable || !summary.inconsistenciesAvailable) && (
            <Button variant="outline" className="mt-4" onClick={retry}>
              Consultar atención de nuevo
            </Button>
          )}
        </>
      )}
    </section>
  )
}
