import { cn } from "@/lib/utils"

interface BalanceBadgeProps {
  amount: number
  currency: string
  className?: string
  showSign?: boolean
}

/**
 * Reusable component for displaying balance with color coding
 * Green for positive, red for negative
 */
export function BalanceBadge({ amount, currency, className, showSign = true }: BalanceBadgeProps) {
  const isPositive = amount >= 0

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: currency === "CRC" ? 0 : 2,
    }).format(Math.abs(amt))
  }

  return (
    <span className={cn("font-semibold", isPositive ? "text-success" : "text-error", className)}>
      {showSign && amount > 0 ? "+" : ""}
      {formatCurrency(amount)}
    </span>
  )
}
