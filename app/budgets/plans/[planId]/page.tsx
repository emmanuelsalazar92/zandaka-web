import { BudgetPlanWorkspace } from "@/components/budgets/plan-workspace"

export default async function BudgetPlanPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  return <BudgetPlanWorkspace planId={planId} />
}
