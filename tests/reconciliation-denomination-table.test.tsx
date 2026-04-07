import { fireEvent, render, screen } from "@testing-library/react"
import * as React from "react"
import { describe, expect, it } from "vitest"

import { ReconciliationDenominationTable } from "@/components/reconciliation-denomination-table"
import { formatCurrency } from "@/lib/currency-formatter"
import type { CashDenomination } from "@/lib/settings-api"

const denominations: CashDenomination[] = [
  {
    id: 1,
    userId: 1,
    currency: "CRC",
    value: 2000,
    type: "BILL",
    label: "₡2000",
    sortOrder: 1,
    isActive: true,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: 2,
    userId: 1,
    currency: "CRC",
    value: 500,
    type: "COIN",
    label: "₡500",
    sortOrder: 2,
    isActive: true,
    createdAt: "",
    updatedAt: "",
  },
]

function Harness({ items = denominations }: { items?: CashDenomination[] }) {
  const [quantities, setQuantities] = React.useState<Record<number, string>>({})

  return (
    <ReconciliationDenominationTable
      currency="CRC"
      denominations={items}
      quantities={quantities}
      onQuantityChange={(denominationId, nextValue) =>
        setQuantities((current) => ({
          ...current,
          [denominationId]: nextValue,
        }))
      }
    />
  )
}

describe("ReconciliationDenominationTable", () => {
  it("renders the empty state when there are no denominations", () => {
    render(<Harness items={[]} />)

    expect(screen.getByTestId("cash-denomination-empty")).toBeInTheDocument()
  })

  it("renders denomination rows and updates subtotals and total in real time", () => {
    render(<Harness />)

    fireEvent.change(screen.getByLabelText("Quantity for ₡2000"), {
      target: { value: "2" },
    })
    fireEvent.change(screen.getByLabelText("Quantity for ₡500"), {
      target: { value: "3" },
    })

    const normalize = (value: string) => value.replace(/\s/g, " ").trim()

    expect(normalize(screen.getByTestId("subtotal-1").textContent ?? "")).toBe(
      normalize(formatCurrency(4000, "CRC")),
    )
    expect(normalize(screen.getByTestId("subtotal-2").textContent ?? "")).toBe(
      normalize(formatCurrency(1500, "CRC")),
    )
    expect(normalize(screen.getByTestId("denomination-counted-total").textContent ?? "")).toBe(
      normalize(formatCurrency(5500, "CRC")),
    )
  })
})
