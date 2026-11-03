"use client"

import { HandCoins } from "lucide-react"

import { MoneyDisplay } from "@/components/budgets/money-display"
import { ToggleRow } from "@/components/budgets/toggle-row"
import { AccessibleField, AccessibleFieldError } from "@/components/ui/accessible-field"
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
          <CardTitle>3. Ajustes manuales</CardTitle>
          <CardDescription>
            Añade ajustes opcionales que no dependen de las reglas de nómina.
          </CardDescription>
        </div>
        <CardAction>
          <Badge variant="outline" className="gap-1.5">
            <HandCoins className="h-3.5 w-3.5" />
            Opcional
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ToggleRow
          id="budget-apply-exchange-loss"
          checked={fxEnabled}
          onCheckedChange={onFxToggle}
          title="Reserva cambiaria"
          description="Reserva opcional para diferencias de conversión de moneda."
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
            <AccessibleField className="space-y-2">
              <Label htmlFor="budget-exchange-loss">Importe de la reserva</Label>
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
                <AccessibleFieldError className="text-sm text-destructive">
                  Introduce una reserva igual o mayor que cero.
                </AccessibleFieldError>
              ) : null}
            </AccessibleField>
          ) : null}
        </ToggleRow>
      </CardContent>
    </Card>
  )
}
