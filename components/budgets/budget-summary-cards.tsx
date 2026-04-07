"use client"

import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/currency-formatter"

type BudgetSummaryCardsProps = {
  currency: string
  totalIncome: number
  distributedAmount: number
  distributedPercentage: number
  remainingAmount: number
  remainingPercentage: number
}

const formatPercentage = (value: number) => `${value.toFixed(2)}%`

export function BudgetSummaryCards({
  currency,
  totalIncome,
  distributedAmount,
  distributedPercentage,
  remainingAmount,
  remainingPercentage,
}: BudgetSummaryCardsProps) {
  const items = [
    {
      label: "Total Income",
      value: formatCurrency(totalIncome, currency),
      tone: "text-foreground",
    },
    {
      label: "Distributed Amount",
      value: formatCurrency(distributedAmount, currency),
      tone: "text-foreground",
    },
    {
      label: "Distributed Percentage",
      value: formatPercentage(distributedPercentage),
      tone: "text-foreground",
    },
    {
      label: "Remaining Amount",
      value: formatCurrency(remainingAmount, currency),
      tone:
        remainingAmount === 0
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Remaining Percentage",
      value: formatPercentage(remainingPercentage),
      tone:
        remainingPercentage === 0
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-amber-600 dark:text-amber-400",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="space-y-2 p-5">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className={`text-2xl font-semibold tracking-tight ${item.tone}`}>{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
