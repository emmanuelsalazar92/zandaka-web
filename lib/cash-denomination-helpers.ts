import { sumMoney, multiplyMoney } from "@/lib/money"
type DenominationLike = {
  id: number
  value: number
  sortOrder: number
}

export type DenominationQuantityMap = Record<number, string>

export function calculateDenominationLineTotal(value: number, quantity: number) {
  return multiplyMoney(value, Math.max(0, quantity))
}

export function calculateDenominationCountedTotal(
  denominations: DenominationLike[],
  quantities: DenominationQuantityMap,
) {
  return sumMoney(
    denominations.map((denomination) =>
      calculateDenominationLineTotal(
        denomination.value,
        parseQuantity(quantities[denomination.id] ?? ""),
      ),
    ),
  )
}

export function parseQuantity(value: string) {
  if (!value.trim()) return 0
  const parsed = Number.parseInt(value, 10)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0
}

export function sanitizeQuantityInput(value: string) {
  return value.replace(/[^\d]/g, "")
}

export function buildDenominationPayloadLines(
  denominations: DenominationLike[],
  quantities: DenominationQuantityMap,
) {
  return [...denominations]
    .sort((left, right) => left.sortOrder - right.sortOrder || right.value - left.value)
    .map((denomination) => ({
      denominationId: denomination.id,
      quantity: parseQuantity(quantities[denomination.id] ?? ""),
    }))
    .filter((line) => line.quantity > 0)
}

export function createEmptyQuantityMap(denominations: DenominationLike[]) {
  return denominations.reduce<DenominationQuantityMap>((accumulator, denomination) => {
    accumulator[denomination.id] = ""
    return accumulator
  }, {})
}
