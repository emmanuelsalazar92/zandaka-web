"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  calculateDenominationCountedTotal,
  calculateDenominationLineTotal,
  parseQuantity,
  sanitizeQuantityInput,
  type DenominationQuantityMap,
} from "@/lib/cash-denomination-helpers"
import { formatCurrency } from "@/lib/currency-formatter"
import type { CashDenomination } from "@/lib/settings-api"

type ReconciliationDenominationTableProps = {
  currency: string
  denominations: CashDenomination[]
  quantities: DenominationQuantityMap
  onQuantityChange: (denominationId: number, nextValue: string) => void
  readOnly?: boolean
}

export function ReconciliationDenominationTable({
  currency,
  denominations,
  quantities,
  onQuantityChange,
  readOnly = false,
}: ReconciliationDenominationTableProps) {
  const countedTotal = React.useMemo(
    () => calculateDenominationCountedTotal(denominations, quantities),
    [denominations, quantities],
  )

  if (denominations.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground"
        data-testid="cash-denomination-empty"
      >
        No denominations are configured for this currency yet.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Quantity</TableHead>
              <TableHead>Denomination</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {denominations.map((denomination) => {
              const quantity = parseQuantity(quantities[denomination.id] ?? "")
              const subtotal = calculateDenominationLineTotal(denomination.value, quantity)

              return (
                <TableRow key={denomination.id}>
                  <TableCell>
                    <Input
                      aria-label={`Quantity for ${denomination.label || formatCurrency(denomination.value, denomination.currency)}`}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={quantities[denomination.id] ?? ""}
                      onChange={(event) =>
                        onQuantityChange(denomination.id, sanitizeQuantityInput(event.target.value))
                      }
                      disabled={readOnly}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {denomination.label ||
                      formatCurrency(denomination.value, denomination.currency)}
                  </TableCell>
                  <TableCell>{denomination.type === "BILL" ? "Bill" : "Coin"}</TableCell>
                  <TableCell
                    className="text-right font-mono"
                    data-testid={`subtotal-${denomination.id}`}
                  >
                    {formatCurrency(subtotal, currency)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <div className="rounded-lg border px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Counted Total</p>
          <p className="font-mono text-lg font-semibold" data-testid="denomination-counted-total">
            {formatCurrency(countedTotal, currency)}
          </p>
        </div>
      </div>
    </div>
  )
}
