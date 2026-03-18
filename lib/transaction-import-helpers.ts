export type ImportTransactionType = "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT"

export interface ImportTransactionRow {
  id: string
  date: string
  description: string
  amount: number
  type: ImportTransactionType
  accountId: string
  envelopeId: string
}

export interface ImportAccountOption {
  id: number
}

export interface ImportEnvelopeOption {
  id: number
}

export interface TransactionImportPayload {
  userId: number
  date: string
  type: ImportTransactionType
  description: string
  lines: [
    {
      accountId: number
      envelopeId: number
      amount: number
    },
  ]
}

const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function parsePositiveInteger(value: string) {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export function getImportRowValidationError(
  row: ImportTransactionRow,
  accounts: ImportAccountOption[],
  envelopesByAccount: Record<string, ImportEnvelopeOption[]>,
) {
  const accountId = parsePositiveInteger(row.accountId)
  if (accountId === null) return "Account is required"

  const accountExists = accounts.some((account) => account.id === accountId)
  if (!accountExists) return "Selected account no longer exists"

  const envelopeId = parsePositiveInteger(row.envelopeId)
  if (envelopeId === null) return "Envelope is required"

  const envelopeExists = (envelopesByAccount[row.accountId] ?? []).some(
    (envelope) => envelope.id === envelopeId,
  )
  if (!envelopeExists) return "Selected envelope no longer exists"

  if (!row.date || !ISO_DATE_ONLY_PATTERN.test(row.date)) {
    return "Date is required"
  }

  if (row.amount === 0) return "Amount must not be 0"

  return null
}

export function buildTransactionImportPayload(
  row: ImportTransactionRow,
  userId: number,
): TransactionImportPayload {
  const accountId = parsePositiveInteger(row.accountId)
  const envelopeId = parsePositiveInteger(row.envelopeId)

  if (accountId === null || envelopeId === null) {
    throw new Error("Cannot build transaction payload without account and envelope")
  }

  return {
    userId,
    date: row.date,
    type: row.type,
    description: row.description,
    lines: [
      {
        accountId,
        envelopeId,
        amount: row.amount,
      },
    ],
  }
}
