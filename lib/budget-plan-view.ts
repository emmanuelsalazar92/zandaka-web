import { formatCurrency } from "@/lib/currency-formatter"
import { decimal } from "@/lib/money"

/** Formatting is the last step; displayed cents are never fed back into plan calculations. */
export function formatPlanMoney(value: string | null, currency = "USD"): string {
  if (value === null) return "Por confirmar"
  try {
    return formatCurrency(Number(decimal(value).toFixed(2)), currency)
  } catch {
    return "Por confirmar"
  }
}
