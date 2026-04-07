import type { BudgetStatus } from "@/components/budgets/types"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STATUS_LABELS: Record<BudgetStatus, string> = {
  draft: "Draft",
  finalized: "Finalized",
  funded: "Funded",
}

const STATUS_STYLES: Record<BudgetStatus, string> = {
  draft:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  finalized:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200",
  funded:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
}

export function BudgetStatusBadge({ status }: { status: BudgetStatus }) {
  return (
    <Badge variant="outline" className={cn("capitalize", STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
