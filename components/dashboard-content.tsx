"use client"

import { AlertTriangle, TrendingDown, Wallet, AlertCircle } from "lucide-react"
import * as React from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency } from "@/lib/currency-formatter"
import { cn } from "@/lib/utils"

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "")
const API_BASE_URL = `${API_ROOT}/api`

const topCategories = [
  { name: "Groceries", amount: 125000, currency: "CRC" },
  { name: "Transportation", amount: 85000, currency: "CRC" },
  { name: "Entertainment", amount: 180, currency: "USD" },
  { name: "Utilities", amount: 65000, currency: "CRC" },
]

const recentTransactions = [
  {
    date: "2026-01-02",
    description: "Supermarket purchase",
    account: "Main Checking",
    category: "Groceries",
    amount: -45000,
    currency: "CRC",
  },
  {
    date: "2026-01-02",
    description: "Salary deposit",
    account: "Main Checking",
    category: "Income",
    amount: 500000,
    currency: "CRC",
  },
  {
    date: "2026-01-01",
    description: "Gas station",
    account: "Main Checking",
    category: "Transportation",
    amount: -25000,
    currency: "CRC",
  },
  {
    date: "2026-01-01",
    description: "Restaurant",
    account: "Credit Card",
    category: "Entertainment",
    amount: -75,
    currency: "USD",
  },
]

const negativeEnvelopes = [
  { account: "Main Checking", category: "Transportation", balance: -15000, currency: "CRC" },
  { account: "Credit Card", category: "Entertainment", balance: -50, currency: "USD" },
]

const inconsistencies = [{ account: "Main Checking", difference: 5000, currency: "CRC" }]

type CurrencyCode = "CRC" | "USD"

type ExchangeRateResponse = {
  compra: number
  venta: number
  fecha: string
}

export function DashboardContent() {
  const [totals, setTotals] = React.useState({
    CRC: 0,
    USD: 0,
  })
  const [negativeEnvelopeCount, setNegativeEnvelopeCount] = React.useState(0)
  const [activeInconsistenciesCount, setActiveInconsistenciesCount] = React.useState(0)
  const [preferredCurrency, setPreferredCurrency] = React.useState<CurrencyCode | null>(null)
  const [exchangeRate, setExchangeRate] = React.useState<ExchangeRateResponse | null>(null)
  const [summaryLoading, setSummaryLoading] = React.useState(true)
  const [summaryError, setSummaryError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchDashboardSummary = async () => {
      try {
        setSummaryLoading(true)
        setSummaryError(null)

        const today = new Date()
        const day = today.getDate()
        const month = today.getMonth() + 1
        const year = today.getFullYear()

        const [
          crcRes,
          usdRes,
          activeInconsistenciesRes,
          negativeEnvelopesRes,
          preferredCurrencyRes,
          exchangeRateRes,
        ] = await Promise.all([
          fetch(`${API_BASE_URL}/reports/envelope-total?currency=CRC`, {
            headers: { Accept: "application/json" },
          }),
          fetch(`${API_BASE_URL}/reports/envelope-total?currency=USD`, {
            headers: { Accept: "application/json" },
          }),
          fetch(`${API_BASE_URL}/reports/active-inconsistencies`, {
            headers: { Accept: "application/json" },
          }),
          fetch(`${API_BASE_URL}/reports/negative-envelopes`, {
            headers: { Accept: "application/json" },
          }),
          fetch(`${API_BASE_URL}/users/preferred-currency`, {
            headers: { Accept: "application/json" },
          }),
          fetch(`${API_BASE_URL}/exchange-rate/${day}/${month}/${year}`, {
            headers: { Accept: "application/json" },
          }),
        ])

        if (
          !crcRes.ok ||
          !usdRes.ok ||
          !negativeEnvelopesRes.ok ||
          !activeInconsistenciesRes.ok ||
          !preferredCurrencyRes.ok ||
          !exchangeRateRes.ok
        ) {
          throw new Error("Failed to load dashboard summary")
        }

        const [
          crcData,
          usdData,
          activeInconsistenciesData,
          negativeEnvelopesData,
          preferredCurrencyData,
          exchangeRateData,
        ] = (await Promise.all([
          crcRes.json(),
          usdRes.json(),
          activeInconsistenciesRes.json(),
          negativeEnvelopesRes.json(),
          preferredCurrencyRes.json(),
          exchangeRateRes.json(),
        ])) as [
          { currency: string; total: number },
          { currency: string; total: number },
          Array<{
            accountId: number
            accountName: string
            reconciliationDate: string
            realBalance: number
            calculatedBalance: number
            difference: number
          }>,
          Array<{ envelopeId: number }>,
          { userId: number; baseCurrency: CurrencyCode },
          ExchangeRateResponse,
        ]

        setTotals({
          CRC: crcData.total ?? 0,
          USD: usdData.total ?? 0,
        })
        setNegativeEnvelopeCount(negativeEnvelopesData.length)
        setActiveInconsistenciesCount(activeInconsistenciesData.length)
        setPreferredCurrency(preferredCurrencyData.baseCurrency.toUpperCase() as CurrencyCode)
        setExchangeRate(exchangeRateData)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load dashboard summary"
        setSummaryError(message)
        setTotals({
          CRC: 0,
          USD: 0,
        })
        setNegativeEnvelopeCount(0)
        setActiveInconsistenciesCount(0)
        setPreferredCurrency(null)
        setExchangeRate(null)
      } finally {
        setSummaryLoading(false)
      }
    }

    fetchDashboardSummary()
  }, [])

  const consolidatedCurrency = preferredCurrency ?? "CRC"
  const consolidatedTotal =
    preferredCurrency === "USD"
      ? totals.USD + (exchangeRate ? totals.CRC / exchangeRate.venta : 0)
      : totals.CRC + (exchangeRate ? totals.USD * exchangeRate.compra : 0)
  const exchangeRateMessage = exchangeRate
    ? `Today's exchange rate (${exchangeRate.fecha}): buy at ${formatCurrency(exchangeRate.compra, "CRC")} and sell at ${formatCurrency(exchangeRate.venta, "CRC")} per USD.`
    : summaryLoading
      ? "Loading today's exchange rate..."
      : "Today's exchange rate is unavailable."
  const consolidatedDescription =
    preferredCurrency === null
      ? "Loading your preferred currency."
      : preferredCurrency === "USD"
        ? "Calculated using today's sell rate because your preferred currency is USD."
        : "Calculated using today's buy rate because your preferred currency is CRC."

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total (CRC)</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.CRC, "CRC")}</div>
            <p className="text-xs text-muted-foreground">
              {summaryLoading ? "Loading total..." : "Active envelopes in CRC"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total (USD)</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.USD, "USD")}</div>
            <p className="text-xs text-muted-foreground">
              {summaryLoading ? "Loading total..." : "Active envelopes in USD"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Negative Envelopes</CardTitle>
            <TrendingDown className="h-4 w-4 text-error" />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", negativeEnvelopeCount > 0 && "text-error")}>
              {negativeEnvelopeCount}
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
              className={cn("text-2xl font-bold", activeInconsistenciesCount > 0 && "text-warning")}
            >
              {activeInconsistenciesCount}
            </div>
            <p className="text-xs text-muted-foreground">Open reconciliation issues</p>
          </CardContent>
        </Card>
      </div>

      {/* Net Worth Calculator */}
      <Card>
        <CardHeader>
          <CardTitle>Net Worth (Consolidated)</CardTitle>
          <CardDescription>
            Using today&apos;s exchange rate and your preferred currency
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium">Today&apos;s Exchange Rate</p>
              <p className="text-sm text-muted-foreground">{exchangeRateMessage}</p>
              <p className="text-xs text-muted-foreground">
                Preferred currency:{" "}
                {preferredCurrency ?? (summaryLoading ? "Loading..." : "Unavailable")}
              </p>
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">
                Consolidated Total ({consolidatedCurrency})
              </p>
              <p className="text-3xl font-bold">
                {formatCurrency(consolidatedTotal, consolidatedCurrency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{consolidatedDescription}</p>
            </div>
          </div>
          {summaryError && <p className="mt-3 text-sm text-error">{summaryError}</p>}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Spending Categories */}
        <Card>
          <CardHeader>
            <CardTitle>Top Spending Categories This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCategories.map((category, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-error">
                        {formatCurrency(category.amount, category.currency)}
                      </span>
                      <Badge variant="outline" className="ml-2">
                        {category.currency}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentTransactions.map((tx, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex-1">
                    <p className="font-medium">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {tx.date} • {tx.account}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn("font-semibold", tx.amount > 0 ? "text-success" : "text-error")}
                    >
                      {tx.amount > 0 ? "+" : ""}
                      {formatCurrency(Math.abs(tx.amount), tx.currency)}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {tx.currency}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {negativeEnvelopes.length > 0 && (
        <Alert className="border-error/50 bg-error/5">
          <AlertTriangle className="h-4 w-4 text-error" />
          <AlertTitle className="text-error">Negative Envelopes</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-1">
              {negativeEnvelopes.map((env, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium">{env.account}</span> / {env.category}:{" "}
                  <span className="font-semibold text-error">
                    {formatCurrency(env.balance, env.currency)}
                  </span>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {inconsistencies.length > 0 && (
        <Alert className="border-warning/50 bg-warning/5">
          <AlertCircle className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">Inconsistencies</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-1">
              {inconsistencies.map((inc, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium">{inc.account}</span>: Difference of{" "}
                  <span className="font-semibold text-warning">
                    {formatCurrency(inc.difference, inc.currency)}
                  </span>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
