import { sumMoney } from "@/lib/money"
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

  if (!transaction.date) errors.push("Elige una fecha")
  if (!transaction.description) errors.push("Introduce una descripción")
  if (!transaction.lines || transaction.lines.length === 0) {
    errors.push("Añade al menos un detalle")
  }

  if (transaction.type === "TRANSFER") {
    if (!transaction.lines || transaction.lines.length !== 2) {
      errors.push("Las transferencias requieren exactamente dos detalles")
    }
    const sum = sumMoney((transaction.lines || []).map((line) => line.amount))
    if (sum !== 0) {
      errors.push("Los importes de una transferencia deben sumar cero")
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
  return sumMoney(lines.map((line) => line.amount))
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
