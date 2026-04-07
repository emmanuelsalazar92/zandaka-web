"use client"

import { formatCurrency } from "@/lib/currency-formatter"
import { cn } from "@/lib/utils"

type MoneyDisplayProps = {
  amount: number | null | undefined
  currency: string
  size?: "sm" | "md" | "lg"
  tone?: "default" | "muted" | "positive" | "negative"
  className?: string
}

const sizeClassName: Record<NonNullable<MoneyDisplayProps["size"]>, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl",
}

const toneClassName: Record<NonNullable<MoneyDisplayProps["tone"]>, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  positive: "text-emerald-200",
  negative: "text-rose-200",
}

export function MoneyDisplay({
  amount,
  currency,
  size = "md",
  tone = "default",
  className,
}: MoneyDisplayProps) {
  const safeAmount = typeof amount === "number" && Number.isFinite(amount) ? amount : 0

  return (
    <span
      className={cn(
        "tabular-nums font-medium tracking-tight",
        sizeClassName[size],
        toneClassName[tone],
        className,
      )}
    >
      {formatCurrency(safeAmount, currency)}
    </span>
  )
}
