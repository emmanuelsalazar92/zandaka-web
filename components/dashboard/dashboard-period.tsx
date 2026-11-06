"use client"

import Link from "next/link"
import * as React from "react"

import { TransactionTimeline } from "@/components/transaction-timeline"
import { TransactionDetailDialog } from "@/components/transactions/transaction-detail-dialog"
import { Button } from "@/components/ui/button"
import { EmptyState, Feedback, LoadingState } from "@/components/ui/feedback"
import { formatCurrency } from "@/lib/currency-formatter"
import type { DashboardPeriod as Period } from "@/lib/dashboard-api"
import {
  dashboardHistoryLink,
  dashboardMonthLabel,
  dashboardSpending,
} from "@/lib/dashboard-period"
import { groupTransactionsForTimeline } from "@/lib/transaction-timeline"

import styles from "./dashboard.module.css"

export function DashboardActivity({
  data,
  month,
  loading,
  retry,
}: {
  data: Period | null
  month: string
  loading: boolean
  retry: () => void
}) {
  const [detailId, setDetailId] = React.useState<number | null>(null)
  const trigger = React.useRef<HTMLButtonElement | null>(null)
  const heading = React.useRef<HTMLHeadingElement>(null)
  const groups = groupTransactionsForTimeline(data?.transactions ?? [])
  return (
    <section aria-labelledby="dashboard-activity-title" className={styles.activity}>
      <div className={styles.sectionHeading}>
        <div>
          <h2 id="dashboard-activity-title" ref={heading} tabIndex={-1} className={styles.title}>
            Actividad del período
          </h2>
          <p className={styles.caption}>
            Hasta cinco movimientos recientes · {dashboardMonthLabel(month)}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={dashboardHistoryLink({ month })}>Ver movimientos del período</Link>
        </Button>
      </div>
      <div aria-busy={loading}>
        {loading ? (
          <LoadingState>Cargando actividad del período…</LoadingState>
        ) : data?.transactions === null || !data ? (
          <Feedback tone="error" title="Actividad por confirmar">
            <p>La consulta no se completó. No significa que no haya movimientos.</p>
            <Button className="mt-3" variant="outline" onClick={retry}>
              Reintentar período
            </Button>
          </Feedback>
        ) : groups.length === 0 ? (
          <EmptyState
            title="Este período aún no tiene movimientos."
            action={
              <Button asChild variant="outline">
                <Link href="/transactions?new=1">Registrar un movimiento</Link>
              </Button>
            }
          >
            Elige otro mes o incorpora un ingreso, gasto o transferencia.
          </EmptyState>
        ) : (
          <TransactionTimeline
            groups={groups}
            density="comfortable"
            appearance="open"
            onOpen={(id, button) => {
              trigger.current = button
              setDetailId(id)
            }}
          />
        )}
      </div>
      {detailId !== null && (
        <TransactionDetailDialog
          key={detailId}
          transactionId={detailId}
          userId={1}
          returnFocus={trigger}
          onClose={() => {
            setDetailId(null)
            if (!trigger.current?.isConnected) heading.current?.focus()
          }}
        />
      )}
    </section>
  )
}

export function DashboardSpending({
  data,
  month,
  loading,
  retry,
}: {
  data: Period | null
  month: string
  loading: boolean
  retry: () => void
}) {
  const groups = dashboardSpending(data?.expenses ?? [])
  return (
    <section aria-labelledby="dashboard-spending-title" className={styles.spending}>
      <div className={styles.sectionHeading}>
        <div>
          <h2 id="dashboard-spending-title" className={styles.title}>
            En qué gastaste
          </h2>
          <p className={styles.caption}>
            {dashboardMonthLabel(month)} · Solo gastos; sin transferencias.
          </p>
        </div>
      </div>
      <div aria-busy={loading}>
        {loading ? (
          <LoadingState>Cargando distribución…</LoadingState>
        ) : data?.expenses === null || !data ? (
          <Feedback tone="error" title="Gastos por confirmar">
            <p>Tu actividad puede consultarse por separado.</p>
            <Button className="mt-3" variant="outline" onClick={retry}>
              Reintentar período
            </Button>
          </Feedback>
        ) : groups.length === 0 ? (
          <p className="py-5 text-sm text-muted-foreground">
            No hay gastos registrados en este mes. Las transferencias no se cuentan como gasto.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.currency} className={styles.currencyGroup}>
              <div className={styles.sectionHeading}>
                <h3 className="text-sm font-semibold">Gastos en {group.currency}</h3>
                <p className="font-semibold tabular-nums">
                  {formatCurrency(group.total, group.currency)}
                </p>
              </div>
              <p className={styles.caption}>
                Participación del gasto en {group.currency}; sin conversión.
              </p>
              <ol className={styles.list}>
                {group.rows.slice(0, 5).map((row) => (
                  <li key={row.categoryId} className={styles.spendRow}>
                    <div>
                      <span>{row.categoryName}</span>
                      <strong>{formatCurrency(row.amount, group.currency)}</strong>
                    </div>
                    <div className={styles.bar} aria-hidden="true">
                      <span style={{ width: `${row.share}%` }} />
                    </div>
                    <span className={styles.caption}>
                      {row.share.toLocaleString("es-CR")}% del gasto en {group.currency}
                    </span>
                  </li>
                ))}
              </ol>
              {group.rows.length > 5 && (
                <p className={styles.caption}>
                  Cinco categorías principales de {group.rows.length}. El total y los porcentajes
                  incluyen todas.
                </p>
              )}
            </div>
          ))
        )}
      </div>
      <Button asChild variant="ghost" className="mt-4">
        <Link href={dashboardHistoryLink({ month, type: "EXPENSE" })}>Ver gastos del período</Link>
      </Button>
    </section>
  )
}
