export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: currency === "CRC" ? 0 : 2,
  }).format(amount)
}

/**
 * Format currency for display with sign indication
 */
export function formatSignedCurrency(amount: number, currency: string): string {
  const formatted = formatCurrency(Math.abs(amount), currency)
  return amount > 0 ? `+${formatted}` : `-${formatted}`
}

/**
 * Get the currency code from an amount value (simple heuristic)
 */
export function detectCurrency(amount: number): string {
  return Math.abs(amount) > 10000 ? "CRC" : "USD"
}

/**
 * Format large numbers with abbreviations (e.g., 1.2M, 500K)
 */
export function formatCompactCurrency(amount: number, currency: string): string {
  const absAmount = Math.abs(amount)
  let formatted: string

  if (absAmount >= 1000000) {
    formatted = (absAmount / 1000000).toFixed(1) + "M"
  } else if (absAmount >= 1000) {
    formatted = (absAmount / 1000).toFixed(1) + "K"
  } else {
    formatted = absAmount.toFixed(2)
  }

  return (amount < 0 ? "-" : "") + formatted
}
