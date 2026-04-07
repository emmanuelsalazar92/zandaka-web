"use client"

import { AlertCircle, AlertTriangle, TrendingDown, Wallet } from "lucide-react"
import * as React from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency } from "@/lib/currency-formatter"
import { fetchDashboardSummary, type DashboardSummary } from "@/lib/dashboard-api"
import { cn } from "@/lib/utils"

type CurrencyCode = "CRC" | "USD"

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

const formatTransactionDate = (value: string) => {
  if (!value) return "Unavailable"
  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed)
}

const resolveTransactionCurrency = (
  transaction: DashboardSummary["recentTransactions"][number],
) => {
  if (transaction.accountCurrency) return transaction.accountCurrency
  const uniqueCurrencies = Array.from(
    new Set(transaction.lines.map((line) => line.accountCurrency).filter(Boolean)),
  )
  return uniqueCurrencies.length === 1 ? uniqueCurrencies[0] : null
}

function DashboardCardsSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-28" />
          </CardContent>
        </Card>
      ))}
    </>
  )
}

export function DashboardContent() {
  const [dashboard, setDashboard] = React.useState<DashboardSummary | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true)
        setDashboard(await fetchDashboardSummary())
      } catch (cause) {
        setDashboard({
          totals: { CRC: 0, USD: 0 },
          preferredCurrency: "CRC",
          exchangeRate: null,
          monthlyExpenses: [],
          recentTransactions: [],
          negativeEnvelopes: [],
          inconsistencies: [],
          warnings: [messageOf(cause, "Failed to load dashboard summary.")],
        })
      } finally {
        setLoading(false)
      }
    }

    void loadDashboard()
  }, [])

  const totals = dashboard?.totals ?? { CRC: 0, USD: 0 }
  const negativeEnvelopes = dashboard?.negativeEnvelopes ?? []
  const inconsistencies = dashboard?.inconsistencies ?? []
  const monthlyExpenses = dashboard?.monthlyExpenses ?? []
  const recentTransactions = dashboard?.recentTransactions ?? []
  const preferredCurrency = dashboard?.preferredCurrency ?? "CRC"
  const exchangeRate = dashboard?.exchangeRate ?? null
  const warnings = dashboard?.warnings ?? []

  const consolidatedCurrency = preferredCurrency as CurrencyCode
  const consolidatedTotal =
    consolidatedCurrency === "USD"
      ? totals.USD + (exchangeRate ? totals.CRC / exchangeRate.venta : 0)
      : totals.CRC + (exchangeRate ? totals.USD * exchangeRate.compra : 0)

  const topSpendingCategories = monthlyExpenses
    .slice()
    .sort((left, right) => Math.abs(right.total) - Math.abs(left.total))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <DashboardCardsSkeleton />
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total (CRC)</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totals.CRC, "CRC")}</div>
                <p className="text-xs text-muted-foreground">Active envelopes in CRC</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total (USD)</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totals.USD, "USD")}</div>
                <p className="text-xs text-muted-foreground">Active envelopes in USD</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Negative Envelopes</CardTitle>
                <TrendingDown className="h-4 w-4 text-error" />
              </CardHeader>
              <CardContent>
                <div
                  className={cn("text-2xl font-bold", negativeEnvelopes.length > 0 && "text-error")}
                >
                  {negativeEnvelopes.length}
                </div>
                <p className="text-xs text-muted-foreground">Requires attention</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Inconsistencies</CardTitle>
                <AlertCircle className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div
                  className={cn("text-2xl font-bold", inconsistencies.length > 0 && "text-warning")}
                >
                  {inconsistencies.length}
                </div>
                <p className="text-xs text-muted-foreground">Open reconciliation issues</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Net Worth (Consolidated)</CardTitle>
          <CardDescription>
            Using today&apos;s exchange rate and your preferred currency
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium">Today&apos;s Exchange Rate</p>
              <p className="text-sm text-muted-foreground">
                {exchangeRate
                  ? `Today's exchange rate (${exchangeRate.fecha}): buy at ${formatCurrency(exchangeRate.compra, "CRC")} and sell at ${formatCurrency(exchangeRate.venta, "CRC")} per USD.`
                  : loading
                    ? "Loading today's exchange rate..."
                    : "Today's exchange rate is unavailable."}
              </p>
              <p className="text-xs text-muted-foreground">
                Preferred currency: {preferredCurrency}
              </p>
            </div>
            <div className="flex-1">
              <p className="mb-1 text-sm text-muted-foreground">
                Consolidated Total ({consolidatedCurrency})
              </p>
              <p className="text-3xl font-bold">
                {formatCurrency(consolidatedTotal, consolidatedCurrency)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {consolidatedCurrency === "USD"
                  ? "Calculated using today's sell rate because your preferred currency is USD."
                  : "Calculated using today's buy rate because your preferred currency is CRC."}
              </p>
            </div>
          </div>
          {warnings.length > 0 ? (
            <div className="mt-3 space-y-1">
              {warnings.map((warning, index) => (
                <p key={`${warning}-${index}`} className="text-sm text-warning">
                  {warning}
                </p>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Spending Categories This Month</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            ) : topSpendingCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No spending categories yet this month.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topSpendingCategories.map((category) => (
                    <TableRow key={`${category.categoryId}-${category.currency}`}>
                      <TableCell className="font-medium">{category.categoryName}</TableCell>
                      <TableCell className="text-right">
                        <span className="text-error">
                          {formatCurrency(Math.abs(category.total), category.currency)}
                        </span>
                        <Badge variant="outline" className="ml-2">
                          {category.currency}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            ) : recentTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent transactions available.</p>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((transaction) => {
                  const currency = resolveTransactionCurrency(transaction)
                  return (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between gap-4 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{transaction.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTransactionDate(transaction.date)}
                          {transaction.accountName ? ` • ${transaction.accountName}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            "font-semibold",
                            transaction.amount > 0 ? "text-success" : "text-error",
                          )}
                        >
                          {currency
                            ? `${transaction.amount > 0 ? "+" : "-"}${formatCurrency(
                                Math.abs(transaction.amount),
                                currency,
                              )}`
                            : transaction.amount.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {currency ?? "Mixed"}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {negativeEnvelopes.length > 0 ? (
        <Alert className="border-error/50 bg-error/5">
          <AlertTriangle className="h-4 w-4 text-error" />
          <AlertTitle className="text-error">Negative Envelopes</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-1">
              {negativeEnvelopes.map((envelope) => (
                <div key={envelope.envelopeId} className="text-sm">
                  <span className="font-medium">{envelope.accountName}</span> /{" "}
                  {envelope.categoryName}:{" "}
                  <span className="font-semibold text-error">
                    {formatCurrency(envelope.balance, envelope.currency)}
                  </span>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {inconsistencies.length > 0 ? (
        <Alert className="border-warning/50 bg-warning/5">
          <AlertCircle className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">Inconsistencies</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-1">
              {inconsistencies.map((item) => (
                <div key={`${item.accountId}-${item.reconciliationDate}`} className="text-sm">
                  <span className="font-medium">{item.accountName}</span>: Difference of{" "}
                  <span className="font-semibold text-warning">
                    {formatCurrency(item.difference, item.currency)}
                  </span>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
