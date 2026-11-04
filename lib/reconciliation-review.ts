import {
  buildDenominationPayloadLines,
  calculateDenominationCountedTotal,
  calculateDenominationLineTotal,
  type DenominationQuantityMap,
} from "@/lib/cash-denomination-helpers"
import { formatCurrency, formatSignedCurrency } from "@/lib/currency-formatter"
import { assertMoney, currencyDigits, parseMoneyInput } from "@/lib/money"
import { ReconciliationApiError, type ReconciliationRecord } from "@/lib/reconciliation-api"
import type { CashDenomination } from "@/lib/settings-api"

export function reconciliationState(record: ReconciliationRecord) {
  if (record.status === "IGNORED")
    return {
      label: "Ignorada",
      tone: "secondary" as const,
      open: false,
      explanation:
        "Se cerró sin resolver la diferencia. Ignorar no modificó los saldos ni registró un ajuste.",
    }
  if (record.isActive === 1 && record.status === "OPEN")
    return {
      label: "Abierta",
      tone: "warning" as const,
      open: true,
      explanation:
        "La revisión sigue abierta. Investiga los movimientos y el saldo real antes de decidir qué hacer.",
    }
  if (record.isActive === 0 && record.status === "BALANCED")
    return {
      label: "Conciliada",
      tone: "success" as const,
      open: false,
      explanation:
        record.difference === 0
          ? "La revisión quedó conciliada y cerrada. Los importes mostrados son los guardados al registrar."
          : "La revisión se cerró al cuadrar los movimientos. La diferencia original se conserva como dato histórico; no es un problema abierto.",
    }
  return {
    label: record.isActive === 0 ? "Cerrada" : "Revisar estado",
    tone: "secondary" as const,
    open: false,
    explanation:
      "El importe corresponde al registro histórico. Actualiza la información antes de tomar una decisión.",
  }
}
export function reconciliationAmount(amount: number, currency: string, signed = false) {
  try {
    return signed ? formatSignedCurrency(amount, currency) : formatCurrency(amount, currency)
  } catch {
    return `${amount.toLocaleString("es-CR", { maximumFractionDigits: 20 })} · Moneda no disponible`
  }
}
export function validReconciliationDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + "T12:00:00Z")
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
export function reconciliationMovementLink(accountId: number, date: string) {
  if (!Number.isSafeInteger(accountId) || accountId <= 0 || !validReconciliationDate(date))
    return null
  return `/transactions?${new URLSearchParams({ accountId: String(accountId), to: date, source: "reconciliation" })}`
}
export function reconciliationManualAmount(
  value: string,
  currency: string,
): { value: number | null; error: string | null } {
  if (!value.trim()) return { value: null, error: "Introduce el saldo real para compararlo." }
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value.trim()))
    return {
      value: null,
      error: "Escribe un importe decimal sin separadores de miles, letras ni exponentes.",
    }
  try {
    return { value: parseMoneyInput(value.trim().replace(",", "."), currency), error: null }
  } catch {
    return {
      value: null,
      error:
        "Escribe un importe válido para esta moneda, sin separadores de miles ni decimales adicionales.",
    }
  }
}
export function reconciliationQuantities(
  denominations: CashDenomination[],
  quantities: DenominationQuantityMap,
) {
  const errors: Record<number, string> = {},
    subtotals: Record<number, number | null> = {}
  for (const denomination of denominations) {
    const raw = quantities[denomination.id] ?? "",
      q = raw === "" ? 0 : Number(raw)
    if (!/^\d*$/.test(raw) || !Number.isSafeInteger(q) || q < 0) {
      errors[denomination.id] = "Usa una cantidad entera de cero o más."
      subtotals[denomination.id] = null
      continue
    }
    try {
      subtotals[denomination.id] = assertMoney(
        calculateDenominationLineTotal(denomination.value, q),
        denomination.currency,
      )
    } catch {
      errors[denomination.id] = "La cantidad supera el importe admitido."
      subtotals[denomination.id] = null
    }
  }
  if (Object.keys(errors).length)
    return { total: null, subtotals, errors, error: "Revisa las cantidades indicadas.", lines: [] }
  try {
    const total = calculateDenominationCountedTotal(denominations, quantities)
    return {
      total,
      subtotals,
      errors,
      error: null,
      lines: buildDenominationPayloadLines(denominations, quantities),
    }
  } catch {
    return {
      total: null,
      subtotals,
      errors,
      error: "El total supera el rango admitido.",
      lines: [],
    }
  }
}
export function supportedReconciliationCurrency(currency: string) {
  try {
    currencyDigits(currency)
    return true
  } catch {
    return false
  }
}
export function definitiveReconciliationError(error: unknown) {
  return error instanceof ReconciliationApiError && [400, 403, 404, 409, 422].includes(error.status)
}
