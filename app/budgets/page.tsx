import { BudgetPlansList } from "@/components/budgets/plan-list"
import { subscriptionChargeId } from "@/lib/budget-subscriptions"

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ subscriptionCharge?: string | string[] }>
}) {
  const { subscriptionCharge } = await searchParams
  return <BudgetPlansList subscriptionCharge={subscriptionChargeId(subscriptionCharge)} />
}
