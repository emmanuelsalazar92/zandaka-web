import { assertMoney } from "@/lib/money"
export type ImportTransactionType = "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT"

export interface ImportTransactionRow {
  sourceAmountText?: string
  id: string
  date: string
  description: string
  amount: number
  currency: string
  type: ImportTransactionType
  accountId: string
  envelopeId: string
}

export interface ImportAccountOption {
  id: number
  currency: string
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
      sourceAmountText?: string
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
  if (accountId === null) return "Elige una cuenta"

  const accountExists = accounts.some((account) => account.id === accountId)
  if (!accountExists) return "La cuenta seleccionada ya no está disponible"

  const selectedAccount = accounts.find((account) => account.id === accountId)
  if (selectedAccount && selectedAccount.currency.toUpperCase() !== row.currency.toUpperCase()) {
    return `Transaction currency ${row.currency} does not match account currency ${selectedAccount.currency}`
  }

  const envelopeId = parsePositiveInteger(row.envelopeId)
  if (envelopeId === null) return "Elige un sobre"

  const envelopeExists = (envelopesByAccount[row.accountId] ?? []).some(
    (envelope) => envelope.id === envelopeId,
  )
  if (!envelopeExists) return "El sobre seleccionado ya no está disponible"

  if (!row.date || !ISO_DATE_ONLY_PATTERN.test(row.date)) {
    return "Elige una fecha"
  }

  try {
    assertMoney(row.amount, row.currency)
  } catch {
    return "Revisa el rango y la cantidad de decimales del importe"
  }

  if (row.amount === 0) return "El importe debe ser distinto de cero"

  return null
}

export function buildTransactionImportPayload(
  row: ImportTransactionRow,
  userId: number,
): TransactionImportPayload {
  const accountId = parsePositiveInteger(row.accountId)
  const envelopeId = parsePositiveInteger(row.envelopeId)

  if (accountId === null || envelopeId === null) {
    throw new Error("Elige cuenta y sobre antes de guardar el movimiento")
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
        amount: assertMoney(row.amount, row.currency),
        ...(row.sourceAmountText ? { sourceAmountText: row.sourceAmountText } : {}),
      },
    ],
  }
}
