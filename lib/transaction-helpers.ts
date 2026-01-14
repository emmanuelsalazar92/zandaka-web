export interface TransactionLine {
  accountId: number
  envelopeId: number
  amount: number
}

export interface Transaction {
  id: number
  date: string
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT"
  description: string
  lines: TransactionLine[]
}

/**
 * Validate a transaction based on type
 */
export function validateTransaction(transaction: Partial<Transaction>): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!transaction.date) errors.push("Date is required")
  if (!transaction.description) errors.push("Description is required")
  if (!transaction.lines || transaction.lines.length === 0) {
    errors.push("At least one line is required")
  }

  if (transaction.type === "TRANSFER") {
    if (!transaction.lines || transaction.lines.length !== 2) {
      errors.push("Transfers must have exactly 2 lines")
    }
    const sum = (transaction.lines || []).reduce((acc, line) => acc + line.amount, 0)
    if (Math.abs(sum) > 0.01) {
      errors.push("Transfer lines must sum to 0")
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Calculate the sum of all transaction lines
 */
export function calculateTransactionSum(lines: TransactionLine[]): number {
  return lines.reduce((acc, line) => acc + line.amount, 0)
}

/**
 * Group transactions by date
 */
export function groupTransactionsByDate(
  transactions: Transaction[],
): Record<string, Transaction[]> {
  return transactions.reduce(
    (acc, transaction) => {
      if (!acc[transaction.date]) {
        acc[transaction.date] = []
      }
      acc[transaction.date].push(transaction)
      return acc
    },
    {} as Record<string, Transaction[]>,
  )
}

/**
 * Get transaction type color for UI display
 */
export function getTransactionTypeColor(type: string): string {
  const colorMap: Record<string, string> = {
    INCOME: "bg-success",
    EXPENSE: "bg-error",
    TRANSFER: "bg-primary",
    ADJUSTMENT: "bg-warning",
  }
  return colorMap[type] || "bg-muted"
}
