import { BudgetDetailContent } from "@/components/budgets/budget-detail-content"

export default async function BudgetDetailPage({
  params,
}: {
  params: Promise<{ budgetId: string }>
}) {
  const { budgetId } = await params

  return <BudgetDetailContent budgetId={budgetId} />
}
