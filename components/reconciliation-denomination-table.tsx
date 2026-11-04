"use client"

import * as React from "react"

import styles from "@/components/reconciliation/reconciliation.module.css"
import { AccessibleField, AccessibleFieldError } from "@/components/ui/accessible-field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { DenominationQuantityMap } from "@/lib/cash-denomination-helpers"
import { reconciliationAmount, reconciliationQuantities } from "@/lib/reconciliation-review"
import type { CashDenomination } from "@/lib/settings-api"

type Props = {
  currency: string
  denominations: CashDenomination[]
  quantities: DenominationQuantityMap
  onQuantityChange: (id: number, value: string) => void
  readOnly?: boolean
}
export function ReconciliationDenominationTable({
  currency,
  denominations,
  quantities,
  onQuantityChange,
  readOnly = false,
}: Props) {
  const prefix = React.useId()
  const calculation = reconciliationQuantities(denominations, quantities)
  if (!denominations.length)
    return (
      <p
        className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
        data-testid="cash-denomination-empty"
      >
        Todavía no hay denominaciones configuradas para esta moneda.
      </p>
    )
  return (
    <div className="@container min-w-0 space-y-4">
      <p className="text-sm text-muted-foreground">
        Indica cuántas unidades tienes de cada billete o moneda. Deja vacío o escribe 0 si no
        tienes; las cantidades deben ser enteras.
      </p>
      <ol className={styles.cashList}>
        {denominations.map((item) => {
          const name = item.label || reconciliationAmount(item.value, item.currency),
            fieldId = prefix + "-" + item.id
          const subtotal = calculation.subtotals[item.id]
          return (
            <li key={item.id} className={styles.cashRow}>
              <div>
                <p className="font-medium">{name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.type === "BILL" ? "Billete" : "Moneda"} ·{" "}
                  {reconciliationAmount(item.value, item.currency)}
                </p>
              </div>
              <AccessibleField className="min-w-0 space-y-2">
                <Label htmlFor={fieldId}>Cantidad de {name}</Label>
                <Input
                  id={fieldId}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={quantities[item.id] ?? ""}
                  onChange={(event) => onQuantityChange(item.id, event.target.value)}
                  disabled={readOnly}
                />
                {calculation.errors[item.id] && (
                  <AccessibleFieldError>{calculation.errors[item.id]}</AccessibleFieldError>
                )}
              </AccessibleField>
              <div>
                <p className="text-xs text-muted-foreground">Subtotal</p>
                <p className="mt-1 font-semibold tabular-nums" data-testid={"subtotal-" + item.id}>
                  {subtotal === null ? "Por confirmar" : reconciliationAmount(subtotal, currency)}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
      <div className="border-t pt-4">
        <p className="text-sm text-muted-foreground">Total contado</p>
        <p className={styles.amount} data-testid="denomination-counted-total">
          {calculation.total === null || !Object.values(quantities).some((value) => value !== "")
            ? "Por confirmar"
            : reconciliationAmount(calculation.total, currency)}
        </p>
        {calculation.error && <p className="mt-2 text-sm text-error">{calculation.error}</p>}
      </div>
    </div>
  )
}
