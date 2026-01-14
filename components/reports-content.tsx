"use client"

import { AlertTriangle, AlertCircle } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

// Mock data for reports
const monthlyExpenses = [
  { category: "Groceries", amount: 125000, currency: "CRC" },
  { category: "Utilities", amount: 80000, currency: "CRC" },
  { category: "Transportation", amount: 85000, currency: "CRC" },
  { category: "Entertainment", amount: 180, currency: "USD" },
  { category: "Dining Out", amount: 95000, currency: "CRC" },
]

const accountTotals = [
  { account: "Main Checking", balance: 1250000, currency: "CRC" },
  { account: "Credit Card", balance: 2340, currency: "USD" },
  { account: "Savings", balance: 500000, currency: "CRC" },
  { account: "Cash Wallet", balance: 50000, currency: "CRC" },
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

export function ReportsContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Reports</h2>
        <p className="text-muted-foreground">View your financial summaries and analysis</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Monthly Expenses by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Expenses by Category</CardTitle>
            <CardDescription>Top spending categories this month</CardDescription>
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
                {monthlyExpenses.map((exp, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{exp.category}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-error font-semibold">
                        {formatCurrency(exp.amount, exp.currency)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Account Totals */}
        <Card>
          <CardHeader>
            <CardTitle>Totals by Account</CardTitle>
            <CardDescription>Current balance per account</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountTotals.map((acc, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{acc.account}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "font-semibold",
                          acc.balance >= 0 ? "text-success" : "text-error",
                        )}
                      >
                        {formatCurrency(acc.balance, acc.currency)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Negative Envelopes Report */}
      {negativeEnvelopes.length > 0 && (
        <Alert className="border-error/50 bg-error/5">
          <AlertTriangle className="h-4 w-4 text-error" />
          <AlertTitle className="text-error">Negative Envelopes Report</AlertTitle>
          <AlertDescription>
            <div className="mt-3 space-y-2">
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

      {/* Inconsistencies Report */}
      {inconsistencies.length > 0 && (
        <Alert className="border-warning/50 bg-warning/5">
          <AlertCircle className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">Reconciliation Inconsistencies</AlertTitle>
          <AlertDescription>
            <div className="mt-3 space-y-2">
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
