"use client"

import { ArrowRight, Plus, RefreshCw, Upload } from "lucide-react"
import Link from "next/link"
import * as React from "react"

import { DashboardAttention } from "@/components/dashboard/dashboard-attention"
import { DashboardActivity, DashboardSpending } from "@/components/dashboard/dashboard-period"
import styles from "@/components/dashboard/dashboard.module.css"
import { useDashboardPeriod } from "@/components/dashboard/use-dashboard-period"
import { PageHeader } from "@/components/page-header"
import { AccessibleField } from "@/components/ui/accessible-field"
import { Button } from "@/components/ui/button"
import { Feedback } from "@/components/ui/feedback"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/currency-formatter"
import { fetchDashboardSummary, type DashboardSummary } from "@/lib/dashboard-api"
import { dashboardMonthLabel, dashboardMonthRange } from "@/lib/dashboard-period"
import { consolidatedDashboardBalance } from "@/lib/dashboard-summary"
import { getAccountingDate } from "@/lib/date-only"
import { exchangeRateInfo } from "@/lib/exchange-rate-info"
import { cn } from "@/lib/utils"

export function DashboardContent() {
  const [dashboard, setDashboard] = React.useState<DashboardSummary | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [refresh, setRefresh] = React.useState(0)
  const [currentMonth] = React.useState(() => getAccountingDate().slice(0, 7))
  const [month, setMonth] = React.useState(currentMonth)
  const period = useDashboardPeriod(month)
  React.useEffect(() => {
    let active = true
    void fetchDashboardSummary()
      .then((summary) => {
        if (active) setDashboard(summary)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [refresh])
  const consolidated = dashboard ? consolidatedDashboardBalance(dashboard) : null
  const currency = dashboard?.preferredCurrency ?? "CRC"
  const rate = dashboard?.exchangeRate
  const info = exchangeRateInfo(rate ?? null)
  const retrySummary = () => {
    setLoading(true)
    setRefresh((value) => value + 1)
  }
  const attentionKnown = dashboard?.negativeEnvelopesAvailable && dashboard.inconsistenciesAvailable
  const count =
    (dashboard?.negativeEnvelopes.length ?? 0) + (dashboard?.inconsistencies.length ?? 0)
  return (
    <div
      className={cn(
        "marea-surface min-w-0 space-y-7 rounded-2xl bg-background p-3 sm:p-5",
        styles.page,
      )}
    >
      <PageHeader
        title="Todo en perspectiva."
        eyebrow="Tu panorama financiero"
        actionsLabel="Acciones del resumen"
      >
        <div className={styles.actions}>
          <Button asChild>
            <Link href="/transactions?new=1">
              <Plus />
              Nuevo movimiento
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/transactions/import">
              <Upload />
              Importar
            </Link>
          </Button>
        </div>
      </PageHeader>
      <section className={styles.hero} aria-label="Saldo consolidado" aria-busy={loading}>
        <div className="min-w-0">
          <p className={styles.heroCaption}>
            Saldo consolidado · {dashboard?.settingsAvailable ? currency : "Moneda por confirmar"}
          </p>
          {loading ? (
            <Skeleton className="my-4 h-14 w-64 max-w-full bg-white/20" />
          ) : (
            <p className={styles.heroAmount}>
              {consolidated === null ? "Por confirmar" : formatCurrency(consolidated, currency)}
            </p>
          )}
          <p className={styles.heroCaption}>
            Saldos registrados de los sobres activos. No es el saldo bancario conciliado ni el saldo
            al cierre del mes seleccionado.
          </p>
          {!loading && consolidated === null && (
            <p className={styles.heroCaption}>
              Falta información para mostrar un total completo. Conservamos las monedas conocidas
              por separado.
            </p>
          )}
          <dl className={styles.originals}>
            {(["CRC", "USD"] as const).map((code) => (
              <div key={code}>
                <dt className={styles.heroCaption}>Saldo original · {code}</dt>
                <dd>
                  {loading
                    ? "—"
                    : dashboard?.currencyAvailable[code]
                      ? formatCurrency(dashboard.totals[code], code)
                      : "Por confirmar"}
                </dd>
              </div>
            ))}
          </dl>
          <a href="#dashboard-attention" className={styles.heroLink}>
            {loading
              ? "Consultando atención"
              : !attentionKnown
                ? "Atención por confirmar"
                : count > 0
                  ? `${count} ${count === 1 ? "incidencia para revisar" : "incidencias para revisar"}`
                  : "Ver revisión de tus cuentas"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </a>
        </div>
        <div className={styles.rate}>
          <p className={styles.heroCaption}>Conversión de referencia</p>
          {loading ? (
            <p className={styles.heroCaption}>Consultando cotización…</p>
          ) : (
            <>
              <p className="mt-2 text-sm font-semibold">
                {rate ? `Última cotización disponible: ${info.date}` : "Cotización no disponible"}
              </p>
              <p className={styles.heroCaption}>
                {rate ? `${info.ageLabel}.` : "Los saldos originales no necesitan una conversión."}
              </p>
              <details className="mt-2">
                <summary>Alcance y cotización</summary>
                <div className="space-y-2 pt-2">
                  <p className={styles.heroCaption}>
                    Cambiar el período actualiza gastos y actividad. Este saldo conserva el estado
                    registrado de los sobres.
                  </p>
                  {rate && (
                    <p className={styles.heroCaption}>
                      Compra {formatCurrency(rate.compra, "CRC")} · venta{" "}
                      {formatCurrency(rate.venta, "CRC")} por 1 USD. Fuente: {info.source}.
                    </p>
                  )}
                  <p className={styles.heroCaption}>
                    {info.usable
                      ? `Conversión con tasa de ${currency === "CRC" ? "compra" : "venta"}. Es una referencia, no la cotización de tu banco ni una operación de cambio.`
                      : "No se utiliza una cotización ausente o inválida para consolidar monedas."}
                  </p>
                </div>
              </details>
            </>
          )}
        </div>
      </section>
      {dashboard && dashboard.warnings.length > 0 && (
        <Feedback tone="warning" title="Parte del panorama está por confirmar">
          <p>
            Una fuente no respondió o no pudo verificarse. Los datos faltantes no equivalen a cero
            ni a ausencia de incidencias.
          </p>
          <Button className="mt-3" variant="outline" onClick={retrySummary}>
            Volver a consultar panorama
          </Button>
        </Feedback>
      )}
      <div className={styles.period}>
        <div>
          <h2 className={styles.title}>Tu mes, en movimiento.</h2>
          <p className={styles.caption}>
            Gastos y actividad de {dashboardMonthLabel(month)}. El saldo y la atención conservan su
            alcance registrado.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <AccessibleField className="w-full min-w-0 max-w-full space-y-1 sm:w-auto">
            <Label htmlFor="dashboard-month">Período de gastos y actividad</Label>
            <Input
              id="dashboard-month"
              type="month"
              value={month}
              min="1000-01"
              max="9999-12"
              className="w-full sm:w-auto"
              onChange={(event) => {
                try {
                  dashboardMonthRange(event.target.value)
                  setMonth(event.target.value)
                } catch {
                  /* Incomplete native month input; preserve the applied period. */
                }
              }}
            />
          </AccessibleField>
          {month !== currentMonth && (
            <Button variant="outline" onClick={() => setMonth(currentMonth)}>
              Mes actual
            </Button>
          )}
          <Button variant="ghost" onClick={period.reload} disabled={period.loading}>
            <RefreshCw className="size-4" />
            Actualizar período
          </Button>
        </div>
        <p role="status" className="sr-only">
          {period.loading
            ? `Consultando ${dashboardMonthLabel(month)}.`
            : `Consulta de ${dashboardMonthLabel(month)} terminada.`}
        </p>
      </div>
      <div className={styles.body}>
        <DashboardActivity
          key={month}
          month={month}
          data={period.data}
          loading={period.loading}
          retry={period.reload}
        />
        <div className={styles.aside}>
          <DashboardSpending
            month={month}
            data={period.data}
            loading={period.loading}
            retry={period.reload}
          />
          <DashboardAttention summary={dashboard} loading={loading} retry={retrySummary} />
        </div>
      </div>
    </div>
  )
}
