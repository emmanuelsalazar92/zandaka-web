import type { AutoAssignmentMatchType, AutoAssignmentRule } from "@/lib/settings-api"

export const matchLabels: Record<AutoAssignmentMatchType, string> = {
  CONTAINS: "Contiene",
  STARTS_WITH: "Empieza con",
  ENDS_WITH: "Termina con",
  EXACT: "Coincidencia exacta",
  REGEX: "Expresión regular",
}
export function ruleDestination(rule: AutoAssignmentRule) {
  const account = rule.accountName ?? (rule.accountId ? `Cuenta #${rule.accountId}` : null)
  const envelope =
    rule.accountEnvelopeLabel ??
    rule.categoryName ??
    (rule.accountEnvelopeId ? `Sobre #${rule.accountEnvelopeId}` : null)
  return [account, envelope].filter(Boolean).join(" · ") || "Destino por confirmar"
}
export function rulePriority(value: string) {
  if (!/^-?\d+$/.test(value.trim())) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}
