"use client"

import { AlertCircle, ArrowDownLeft, ArrowRight, ArrowUpRight, Plus, Upload } from "lucide-react"
import Link from "next/link"
import * as React from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatSignedCurrency } from "@/lib/currency-formatter"
import {
  fetchDashboardMonthlyExpenses,
  fetchDashboardSummary,
  type DashboardMonthlyExpense,
  type DashboardSummary,
} from "@/lib/dashboard-api"
import { consolidatedDashboardBalance } from "@/lib/dashboard-summary"
import { formatIsoDateOnly, getAccountingDate } from "@/lib/date-only"
import { cn } from "@/lib/utils"

function SpendingByMonth({
  dashboard,
  loading,
}: {
  dashboard: DashboardSummary | null
  loading: boolean
}) {
  const [currentMonth] = React.useState(() => getAccountingDate().slice(0, 7))
  const [month, setMonth] = React.useState(currentMonth)
  const [expenses, setExpenses] = React.useState<DashboardMonthlyExpense[]>([])
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    if (month === currentMonth) return
    let active = true
    void fetchDashboardMonthlyExpenses(month)
      .then((values) => {
        if (active) setExpenses(values)
      })
      .catch(() => {
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setPending(false)
      })
    return () => {
      active = false
    }
  }, [month, currentMonth])

  const values = (month === currentMonth ? (dashboard?.monthlyExpenses ?? []) : expenses)
    .slice()
    .sort((left, right) => Math.abs(right.total) - Math.abs(left.total))
    .slice(0, 5)

  return (
    <Card className="min-w-0 shadow-none">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle>En qué se fue tu dinero</CardTitle>
          <div className="space-y-1">
            <Label htmlFor="dashboard-month" className="text-xs text-muted-foreground">
              Mes de los gastos
            </Label>
            <Input
              id="dashboard-month"
              type="month"
              value={month}
              className="w-auto"
              onChange={(event) => {
                if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) return
                setPending(event.target.value !== currentMonth)
                setError(false)
                setExpenses([])
                setMonth(event.target.value)
              }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent aria-live="polite" aria-busy={pending || loading}>
        {loading || pending ? (
          <Skeleton className="h-40 w-full" />
        ) : error || (month === currentMonth && !dashboard?.monthlyExpensesAvailable) ? (
          <p role="alert" className="text-sm text-error">
            No pudimos cargar este período. Elige otro mes para volver a consultar.
          </p>
        ) : values.length === 0 ? (
          <div className="space-y-3 py-6">
            <p className="font-medium">Este mes empieza con una página en blanco.</p>
            <p className="text-sm text-muted-foreground">
              Elige otro período o incorpora tus movimientos.
            </p>
            <Button asChild variant="outline">
              <Link href="/transactions/import">
                <Upload />
                Importar movimientos
              </Link>
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {values.map((category) => (
              <div
                key={category.categoryId + "-" + category.currency}
                className="flex items-center justify-between gap-4 py-4 first:pt-0"
              >
                <span className="min-w-0 break-words text-sm">{category.categoryName}</span>
                <span className="shrink-0 text-right text-sm font-semibold tabular-nums">
                  {formatCurrency(Math.abs(category.total), category.currency)}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {category.currency}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function DashboardContent() {
  const [dashboard, setDashboard] = React.useState<DashboardSummary | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [refresh, setRefresh] = React.useState(0)

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
  const negatives = dashboard?.negativeEnvelopes ?? []
  const inconsistencies = dashboard?.inconsistencies ?? []
  const rate = dashboard?.exchangeRate
  const recent = dashboard?.recentTransactions ?? []
  const refreshSummary = () => {
    setLoading(true)
    setRefresh((value) => value + 1)
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Tu panorama financiero
          </p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Todo en perspectiva.
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/transactions/import">
              <Upload />
              Importar
            </Link>
          </Button>
          <Button asChild>
            <Link href="/transactions?new=1">
              <Plus />
              Nuevo movimiento
            </Link>
          </Button>
        </div>
      </div>

      <section
        className="atlantic-hero p-6 md:p-9"
        aria-label="Saldo consolidado"
        aria-busy={loading}
      >
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="hero-caption text-sm">Saldo consolidado · {currency}</p>
            {loading ? (
              <Skeleton className="my-5 h-14 w-64 max-w-full bg-white/20" />
            ) : (
              <p className="hero-amount mt-3">
                {consolidated === null ? "Por confirmar" : formatCurrency(consolidated, currency)}
              </p>
            )}
            <p className="hero-caption mt-3 max-w-lg text-sm leading-relaxed">
              Saldos de los sobres activos.{" "}
              {consolidated === null && !loading
                ? "Falta información para mostrar un total completo."
                : "Tus monedas, reunidas en una sola vista."}
            </p>
          </div>
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:gap-8">
            {(["CRC", "USD"] as const).map((code) => (
              <div key={code}>
                <dt className="hero-caption text-xs">Saldo original · {code}</dt>
                <dd className="mt-1 text-xl font-medium tabular-nums">
                  {loading
                    ? "—"
                    : dashboard?.balancesAvailable
                      ? formatCurrency(dashboard.totals[code], code)
                      : "No disponible"}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="hero-caption mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-white/20 pt-4 text-xs">
          <p>
            {rate
              ? "Última cotización disponible: " +
                rate.fecha +
                ". Compra " +
                formatCurrency(rate.compra, "CRC") +
                " · venta " +
                formatCurrency(rate.venta, "CRC") +
                " por 1 USD."
              : "Cotización no disponible."}
          </p>
          {rate ? <p>Conversión con tasa de {currency === "CRC" ? "compra" : "venta"}.</p> : null}
        </div>
      </section>

      {dashboard && dashboard.warnings.length > 0 ? (
        <Alert>
          <AlertCircle />
          <AlertTitle>La información está incompleta</AlertTitle>
          <AlertDescription>
            <p>
              Algunas fuentes no respondieron. Los datos faltantes no representan un saldo cero.
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={refreshSummary}>
              Volver a consultar
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/envelopes"
          className={cn(
            "flex items-center justify-between gap-4 rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40",
            negatives.length > 0 && "border-error/30",
          )}
        >
          <div>
            <p className="text-sm font-medium">Sobres por revisar</p>
            <p className="mt-1 text-xs text-muted-foreground">Saldos por debajo de cero</p>
          </div>
          <span
            className={cn(
              "text-2xl font-semibold tabular-nums",
              negatives.length > 0 && "text-error",
            )}
          >
            {loading || !dashboard?.negativeEnvelopesAvailable ? "—" : negatives.length}
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link
          href="/reconciliation"
          className={cn(
            "flex items-center justify-between gap-4 rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40",
            inconsistencies.length > 0 && "border-warning/30",
          )}
        >
          <div>
            <p className="text-sm font-medium">Conciliaciones pendientes</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Diferencias abiertas en tus cuentas
            </p>
          </div>
          <span
            className={cn(
              "text-2xl font-semibold tabular-nums",
              inconsistencies.length > 0 && "text-warning",
            )}
          >
            {loading || !dashboard?.inconsistenciesAvailable ? "—" : inconsistencies.length}
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <SpendingByMonth dashboard={dashboard} loading={loading} />
        <Card className="min-w-0 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Últimos movimientos</CardTitle>
            <Link href="/transactions" className="text-sm font-medium text-primary">
              Ver todos
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : recent.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                Tus próximos movimientos aparecerán aquí.
              </p>
            ) : (
              <div className="divide-y">
                {recent.map((transaction) => {
                  const accountCurrency = transaction.accountCurrency
                  const positive = transaction.amount > 0
                  return (
                    <Link
                      key={transaction.id}
                      href="/transactions"
                      className="flex flex-wrap items-center gap-3 py-4 first:pt-0"
                    >
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                        aria-hidden="true"
                      >
                        {positive ? (
                          <ArrowDownLeft className="size-4" />
                        ) : (
                          <ArrowUpRight className="size-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {transaction.description || "Movimiento sin descripción"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatIsoDateOnly(transaction.date)}
                        </p>
                      </div>
                      <p
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          transaction.amount < 0 && "text-error",
                        )}
                      >
                        {accountCurrency
                          ? formatSignedCurrency(transaction.amount, accountCurrency)
                          : "Varias monedas"}
                      </p>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
