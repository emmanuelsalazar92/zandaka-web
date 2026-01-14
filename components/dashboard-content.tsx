"use client"

import { AlertTriangle, TrendingDown, Wallet, AlertCircle } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

// Mock data for demonstration
const summaryData = {
  crc: {
    total: 1250000,
    spent: 342500,
  },
  usd: {
    total: 2340,
    spent: 450,
  },
  negativeEnvelopes: 2,
  inconsistencies: 1,
}

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

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: currency === "CRC" ? 0 : 2,
  }).format(amount)
}

export function DashboardContent() {
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
            <div className="text-2xl font-bold">{formatCurrency(summaryData.crc.total, "CRC")}</div>
            <p className="text-xs text-muted-foreground">
              Spent: {formatCurrency(summaryData.crc.spent, "CRC")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total (USD)</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summaryData.usd.total, "USD")}</div>
            <p className="text-xs text-muted-foreground">
              Spent: {formatCurrency(summaryData.usd.spent, "USD")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Negative Envelopes</CardTitle>
            <TrendingDown className="h-4 w-4 text-error" />
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                summaryData.negativeEnvelopes > 0 && "text-error",
              )}
            >
              {summaryData.negativeEnvelopes}
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
              className={cn(
                "text-2xl font-bold",
                summaryData.inconsistencies > 0 && "text-warning",
              )}
            >
              {summaryData.inconsistencies}
            </div>
            <p className="text-xs text-muted-foreground">Open reconciliation issues</p>
          </CardContent>
        </Card>
      </div>

      {/* Net Worth Calculator */}
      <Card>
        <CardHeader>
          <CardTitle>Net Worth (Optional Consolidated)</CardTitle>
          <CardDescription>Enter exchange rate to view consolidated total</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="exchange-rate">USD to CRC Exchange Rate</Label>
              <Input id="exchange-rate" type="number" placeholder="e.g., 530" defaultValue="530" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">Consolidated Total (CRC)</p>
              <p className="text-3xl font-bold">
                {formatCurrency(summaryData.crc.total + summaryData.usd.total * 530, "CRC")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Based on manual exchange rate</p>
            </div>
          </div>
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
