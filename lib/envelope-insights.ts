export type EnvelopeVisualStatus = "healthy" | "low" | "empty" | "critical"

export type EnvelopeInsightInput = {
  id: number
  accountId: number
  categoryId: number
  category: string
  balance: number
  currency: string
  active: boolean
}

export type EnvelopeInsight = EnvelopeInsightInput & {
  percentageOfAccount: number
  barPercentage: number
  statusVisual: EnvelopeVisualStatus
}

const LOW_BALANCE_SHARE_THRESHOLD = 0.05

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const toSafeNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0

export function calculateEnvelopePercentage(balance: number, totalAccountBalance: number) {
  const safeBalance = toSafeNumber(balance)
  const safeTotal = toSafeNumber(totalAccountBalance)
  if (Math.abs(safeTotal) < 0.000001) return 0
  return safeBalance / safeTotal
}

export function getEnvelopeBarPercentage(percentageOfAccount: number) {
  return clamp(Math.abs(percentageOfAccount) * 100, 0, 100)
}

export function getEnvelopeVisualStatus(
  balance: number,
  totalAccountBalance: number,
): EnvelopeVisualStatus {
  const safeBalance = toSafeNumber(balance)

  if (safeBalance < 0) return "critical"
  if (Math.abs(safeBalance) < 0.000001) return "empty"

  const share = Math.abs(calculateEnvelopePercentage(safeBalance, totalAccountBalance))
  if (share > 0 && share < LOW_BALANCE_SHARE_THRESHOLD) return "low"

  return "healthy"
}

export function buildEnvelopeInsights(
  envelopes: EnvelopeInsightInput[],
  totalAccountBalance: number,
): EnvelopeInsight[] {
  return envelopes.map((envelope) => {
    const percentageOfAccount = calculateEnvelopePercentage(envelope.balance, totalAccountBalance)

    return {
      ...envelope,
      percentageOfAccount,
      barPercentage: getEnvelopeBarPercentage(percentageOfAccount),
      statusVisual: getEnvelopeVisualStatus(envelope.balance, totalAccountBalance),
    }
  })
}

export function summarizeEnvelopeInsights(
  envelopes: EnvelopeInsightInput[],
  totalAccountBalance: number,
) {
  const insights = buildEnvelopeInsights(envelopes, totalAccountBalance)
  const totalEnvelopeBalance = insights.reduce(
    (sum, envelope) => sum + toSafeNumber(envelope.balance),
    0,
  )
  const activeEnvelopes = insights.filter((envelope) => envelope.active)
  const positiveEnvelopes = activeEnvelopes.filter((envelope) => envelope.balance > 0)
  const negativeEnvelopes = activeEnvelopes.filter((envelope) => envelope.balance < 0)
  const largestEnvelope =
    [...activeEnvelopes].sort((left, right) => right.balance - left.balance)[0] ?? null
  const smallestPositiveEnvelope =
    [...positiveEnvelopes].sort((left, right) => left.balance - right.balance)[0] ?? null

  const assignedPercentage =
    Math.abs(totalAccountBalance) < 0.000001
      ? 0
      : clamp((totalEnvelopeBalance / totalAccountBalance) * 100, -999, 999)

  return {
    insights,
    totalEnvelopeBalance,
    availableDelta: totalAccountBalance - totalEnvelopeBalance,
    assignedPercentage,
    activeEnvelopesCount: activeEnvelopes.length,
    negativeEnvelopesCount: negativeEnvelopes.length,
    largestEnvelope,
    smallestPositiveEnvelope,
  }
}
