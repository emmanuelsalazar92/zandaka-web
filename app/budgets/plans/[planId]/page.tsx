import { BudgetPlanWorkspace } from "@/components/budgets/plan-workspace"
import { subscriptionChargeId } from "@/lib/budget-subscriptions"

export default async function BudgetPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>
  searchParams: Promise<{ subscriptionCharge?: string | string[] }>
}) {
  const [{ planId }, { subscriptionCharge }] = await Promise.all([params, searchParams])
  const charge = subscriptionChargeId(subscriptionCharge)
  return (
    <BudgetPlanWorkspace
      key={`${planId}.${charge ?? ""}`}
      planId={planId}
      subscriptionCharge={charge}
    />
  )
}
