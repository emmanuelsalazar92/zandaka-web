import { TransactionsContent } from "@/components/transactions-content"

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ movementId?: string | string[] }>
}) {
  const { movementId } = await searchParams
  const id =
    typeof movementId === "string" && /^[1-9][0-9]*$/.test(movementId) ? Number(movementId) : 0
  return (
    <TransactionsContent
      key={id}
      initialMovementId={Number.isSafeInteger(id) && id > 0 ? id : undefined}
    />
  )
}
