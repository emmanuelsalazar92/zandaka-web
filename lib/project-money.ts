import { formatCurrency, formatSignedCurrency } from "@/lib/currency-formatter"
import { currencyDigits, decimal, decimalNumber } from "@/lib/money"

export function formatProjectAmount(value: string, currency: string, signed = false) {
  try {
    if (decimal(value).dp() <= currencyDigits(currency)) {
      const format = signed ? formatSignedCurrency : formatCurrency
      return format(decimalNumber(value), currency)
    }
  } catch {
    // Older amounts may exceed the scale or range of the numeric display formatter.
  }
  return `${currency} ${signed && Number(value) > 0 ? "+" : ""}${value}`
}
