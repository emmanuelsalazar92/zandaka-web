import { Badge } from "@/components/ui/badge"

interface CurrencyBadgeProps {
  currency: string
}

/**
 * Reusable component for displaying currency badges
 */
export function CurrencyBadge({ currency }: CurrencyBadgeProps) {
  const currencyNames: Record<string, string> = {
    CRC: "CRC",
    USD: "USD",
  }

  return <Badge variant="outline">{currencyNames[currency] || currency}</Badge>
}
