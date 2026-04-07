"use client"

import { AlertCircle, CheckCircle2 } from "lucide-react"

import type { BudgetValidation } from "@/components/budgets/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/currency-formatter"

type BudgetValidationPanelProps = {
  validation: BudgetValidation | null
  currency: string
}

const formatPercentage = (value: number) => `${value.toFixed(2)}%`

export function BudgetValidationPanel({ validation, currency }: BudgetValidationPanelProps) {
  if (!validation) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Validation unavailable</AlertTitle>
        <AlertDescription>Budget validation could not be loaded right now.</AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert variant={validation.isValid ? "default" : "destructive"}>
      {validation.isValid ? (
        <CheckCircle2 className="h-4 w-4" />
      ) : (
        <AlertCircle className="h-4 w-4" />
      )}
      <AlertTitle>
        {validation.isValid ? "Budget is ready to finalize" : "Budget needs attention"}
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            Distributed: {formatCurrency(validation.distributedAmount, currency)}
          </Badge>
          <Badge variant="outline">
            Distributed %: {formatPercentage(validation.distributedPercentage)}
          </Badge>
          <Badge variant="outline">
            Remaining: {formatCurrency(validation.remainingAmount, currency)}
          </Badge>
          <Badge variant="outline">
            Remaining %: {formatPercentage(validation.remainingPercentage)}
          </Badge>
        </div>
        {!validation.isValid && validation.errors.length > 0 && (
          <ul className="list-disc space-y-1 pl-5">
            {validation.errors.map((issue, index) => (
              <li key={`${issue.field}-${index}`}>{issue.detail}</li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  )
}
