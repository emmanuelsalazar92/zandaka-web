export interface ReconciliationRecord {
  id: number
  accountId: number
  date: string
  calculatedBalance: number
  realBalance: number
  difference: number
}

/**
 * Calculate reconciliation difference
 */
export function calculateReconciliationDifference(calculatedBalance: number, realBalance: number): number {
  return realBalance - calculatedBalance
}

/**
 * Check if account is reconciled (difference is zero)
 */
export function isAccountReconciled(record: ReconciliationRecord): boolean {
  return Math.abs(record.difference) < 0.01
}

/**
 * Get accounts that need reconciliation (with differences)
 */
export function getUnreconciledAccounts(records: ReconciliationRecord[]): ReconciliationRecord[] {
  return records.filter((record) => !isAccountReconciled(record))
}

/**
 * Get the latest reconciliation record per account
 */
export function getLatestReconciliationPerAccount(
  records: ReconciliationRecord[],
): Record<number, ReconciliationRecord> {
  return records.reduce(
    (acc, record) => {
      if (!acc[record.accountId] || new Date(record.date) > new Date(acc[record.accountId].date)) {
        acc[record.accountId] = record
      }
      return acc
    },
    {} as Record<number, ReconciliationRecord>,
  )
}
