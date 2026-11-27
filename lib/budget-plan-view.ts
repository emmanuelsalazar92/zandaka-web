import Decimal from "decimal.js"

import { formatCurrency } from "@/lib/currency-formatter"
import { decimal } from "@/lib/money"

/** Plan calculations can have more significant digits than user-entered amounts. */
export function planDecimal(value: string) {
  return decimal(new Decimal(value))
}

/** Formatting is the last step; displayed cents are never fed back into plan calculations. */
export function formatPlanMoney(value: string | null, currency = "USD"): string {
  if (value === null) return "Por confirmar"
  try {
    return formatCurrency(Number(planDecimal(value).toFixed(2)), currency)
  } catch {
    return "Por confirmar"
  }
}
