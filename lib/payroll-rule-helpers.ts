import { formatIsoDateOnly } from "@/lib/date-only"
import type { PayrollIncomeTaxBracket, PayrollRuleSet } from "@/lib/settings-api"

export function getCostaRicaTodayDateValue(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

export function formatPayrollRate(rate: number) {
  return `${(rate * 100).toFixed(2)}%`
}

export function formatPayrollRuleWindow(
  rule: Pick<PayrollRuleSet, "effectiveFrom" | "effectiveTo">,
) {
  const start = formatIsoDateOnly(rule.effectiveFrom)
  const end = rule.effectiveTo ? formatIsoDateOnly(rule.effectiveTo) : "Open-ended"
  return `${start} to ${end}`
}

export function getPayrollTopTaxRate(brackets: PayrollIncomeTaxBracket[]) {
  return brackets.reduce((max, bracket) => Math.max(max, bracket.taxRate), 0)
}

export function formatIncomeTaxBracketRange(
  bracket: Pick<PayrollIncomeTaxBracket, "amountFrom" | "amountTo">,
) {
  const start = new Intl.NumberFormat("es-CR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(bracket.amountFrom)
  if (bracket.amountTo === null) {
    return `${start} and above`
  }

  const end = new Intl.NumberFormat("es-CR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(bracket.amountTo)

  return `${start} to ${end}`
}

export function createIncomeTaxBracketDraft(
  rangeOrder: number,
  amountFrom = 0,
): {
  rangeOrder: string
  amountFrom: string
  amountTo: string
  taxRate: string
  isExempt: boolean
} {
  return {
    rangeOrder: String(rangeOrder),
    amountFrom: amountFrom === 0 ? "0" : String(amountFrom),
    amountTo: "",
    taxRate: "0",
    isExempt: rangeOrder === 1,
  }
}
