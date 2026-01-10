export interface Envelope {
  id: number
  accountId: number
  categoryId: number
  balance: number
  active: boolean
}

/**
 * Calculate total balance across envelopes
 */
export function calculateEnvelopesTotalBalance(envelopes: Envelope[]): number {
  return envelopes.reduce((sum, envelope) => sum + envelope.balance, 0)
}

/**
 * Get envelopes with negative balances
 */
export function getNegativeEnvelopes(envelopes: Envelope[]): Envelope[] {
  return envelopes.filter((envelope) => envelope.balance < 0)
}

/**
 * Get envelopes by account
 */
export function getEnvelopesByAccount(envelopes: Envelope[], accountId: number): Envelope[] {
  return envelopes.filter((envelope) => envelope.accountId === accountId)
}

/**
 * Check if envelope can be unlinked (must have zero balance)
 */
export function canUnlinkEnvelope(envelope: Envelope): boolean {
  return envelope.balance === 0
}

/**
 * Get envelope balance status for UI
 */
export function getEnvelopeStatus(balance: number): "positive" | "negative" | "empty" {
  if (balance > 0) return "positive"
  if (balance < 0) return "negative"
  return "empty"
}
