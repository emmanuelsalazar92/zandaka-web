import { assertMoney, decimalText, MoneyError, tryDecimalInput } from "@/lib/money"
import type { TransactionType } from "@/lib/transaction-timeline"

// Preserve exactly what is being edited. Invalid input must remain visible and
// fail validation, rather than have letters/exponents silently stripped.
export function sanitizeAmountInput(value: string): string {
  return value
}

export function parseAmountInput(value: string): number {
  const text = value.trim()
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return Number.NaN
  return tryDecimalInput(text)
}

export function applyTypeSign(type: TransactionType, amount: number): number {
  if (type === "EXPENSE") return -Math.abs(amount)
  if (type === "INCOME") return Math.abs(amount)
  return amount
}

export function normalizeAmountInput(value: string, type: TransactionType): string {
  const amount = parseAmountInput(value)
  return Number.isFinite(amount) ? decimalText(applyTypeSign(type, amount)) : value
}

export function transactionAmount(value: string, type: TransactionType, currency: string): number {
  const amount = assertMoney(applyTypeSign(type, parseAmountInput(value)), currency)
  if (amount === 0) throw new MoneyError("Introduce un importe distinto de cero")
  return amount
}
