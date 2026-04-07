"use client"

import { Loader2, Percent, ReceiptText } from "lucide-react"

import { MoneyDisplay } from "@/components/budgets/money-display"
import { ToggleRow } from "@/components/budgets/toggle-row"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { NetSalaryCalculation } from "@/lib/settings-api"

type AutomaticDeductionsCardProps = {
  currency: string
  payrollAvailable: boolean
  payrollLoading: boolean
  payrollError: string | null
  payrollRulesLabel: string | null
  preview: NetSalaryCalculation | null
  ccssEnabled: boolean
  taxEnabled: boolean
  onCcssToggle: (checked: boolean) => void
  onTaxToggle: (checked: boolean) => void
}

const renderCalculatedAmount = ({
  amount,
  currency,
  loading,
}: {
  amount: number
  currency: string
  loading: boolean
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Calculating
      </div>
    )
  }

  return (
    <>
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Calculated</p>
      <MoneyDisplay amount={amount} currency={currency} />
    </>
  )
}

export function AutomaticDeductionsCard({
  currency,
  payrollAvailable,
  payrollLoading,
  payrollError,
  payrollRulesLabel,
  preview,
  ccssEnabled,
  taxEnabled,
  onCcssToggle,
  onTaxToggle,
}: AutomaticDeductionsCardProps) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>2. Automatic Deductions</CardTitle>
          <CardDescription>Based on payroll rules for the selected month.</CardDescription>
        </div>
        <CardAction>
          {payrollRulesLabel ? (
            <Badge variant="outline">Using payroll rules: {payrollRulesLabel}</Badge>
          ) : null}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {!payrollAvailable ? (
          <div className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
            Automatic payroll deductions are currently available only for CRC budgets.
          </div>
        ) : null}

        {payrollAvailable && payrollError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {payrollError}
          </div>
        ) : null}

        <ToggleRow
          id="budget-apply-ccss"
          checked={ccssEnabled}
          onCheckedChange={onCcssToggle}
          disabled={!payrollAvailable}
          title="CCSS Worker Contribution"
          description="Uses official payroll rules over gross salary."
          hint="Rate and amount are resolved by the backend preview."
          meta={
            preview ? (
              <Badge variant="outline" className="gap-1.5">
                <Percent className="h-3 w-3" />
                {(preview.ccssWorkerRate * 100).toFixed(2)}%
              </Badge>
            ) : null
          }
          amount={renderCalculatedAmount({
            amount: preview?.ccssWorkerAmount ?? 0,
            currency,
            loading: payrollLoading && !preview,
          })}
        />

        <ToggleRow
          id="budget-apply-income-tax"
          checked={taxEnabled}
          onCheckedChange={onTaxToggle}
          disabled={!payrollAvailable}
          title="Income Tax"
          description="Progressive tax brackets applied over gross salary."
          hint="The backend computes the tax amount and bracket breakdown from gross salary."
          meta={
            preview ? (
              <Badge variant="outline" className="gap-1.5">
                <ReceiptText className="h-3 w-3" />
                Gross salary base
              </Badge>
            ) : null
          }
          amount={renderCalculatedAmount({
            amount: preview?.incomeTaxAmount ?? 0,
            currency,
            loading: payrollLoading && !preview,
          })}
        />
      </CardContent>
    </Card>
  )
}
