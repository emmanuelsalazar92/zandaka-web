"use client"

import { HandCoins } from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type ManualAdjustmentsCardProps = {
  currency: string
  fxEnabled: boolean
  fxAmountInput: string
  fxAmount: number
  isFxAmountValid: boolean
  onFxToggle: (checked: boolean) => void
  onFxAmountChange: (value: string) => void
}

export function ManualAdjustmentsCard({
  currency,
  fxEnabled,
  fxAmountInput,
  fxAmount,
  isFxAmountValid,
  onFxToggle,
  onFxAmountChange,
}: ManualAdjustmentsCardProps) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>3. Manual Adjustments</CardTitle>
          <CardDescription>
            Add optional adjustments that do not come from payroll rules.
          </CardDescription>
        </div>
        <CardAction>
          <Badge variant="outline" className="gap-1.5">
            <HandCoins className="h-3.5 w-3.5" />
            Optional
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ToggleRow
          id="budget-apply-exchange-loss"
          checked={fxEnabled}
          onCheckedChange={onFxToggle}
          title="Exchange Rate Reserve"
          description="Optional reserve if you expect currency conversion loss."
          hint="This amount is fully manual and only applies when enabled."
          amount={
            <>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Manual
              </p>
              <MoneyDisplay amount={fxEnabled ? fxAmount : 0} currency={currency} />
            </>
          }
        >
          {fxEnabled ? (
            <div className="space-y-2">
              <Label htmlFor="budget-exchange-loss">Reserve amount</Label>
              <Input
                id="budget-exchange-loss"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={fxAmountInput}
                onChange={(event) => onFxAmountChange(event.target.value)}
              />
              {!isFxAmountValid ? (
                <p className="text-sm text-destructive">
                  Enter a reserve amount that is zero or greater.
                </p>
              ) : null}
            </div>
          ) : null}
        </ToggleRow>
      </CardContent>
    </Card>
  )
}
