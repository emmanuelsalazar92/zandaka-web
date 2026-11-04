import { percentageFromAmount, sumMoney } from "@/lib/money"

/** ZA-111: shared fictional fixture. Never fetched from or posted to an API. */
export const referenceAccounts = [
  { id: 1, name: "Cuenta del día a día", institution: "Banco Horizonte", currency: "CRC" },
  { id: 2, name: "Fondo de viajes", institution: "Banco Horizonte", currency: "USD" },
] as const
export type ReferenceEnvelope = { id: number; name: string; balance: number | null; group: string }
export type ReferenceScenario = "complete" | "pending" | "empty" | "loading" | "error"
export const referenceEnvelopes: Readonly<Record<number, readonly ReferenceEnvelope[]>> = {
  1: [
    { id: 11, name: "Reserva de tranquilidad", balance: 600000, group: "Tu futuro" },
    { id: 12, name: "Casa", balance: 180000, group: "Tu día a día" },
    { id: 13, name: "Alimentación", balance: 85000, group: "Tu día a día" },
    { id: 14, name: "Transporte", balance: 24000, group: "Tu día a día" },
    { id: 15, name: "Tiempo libre", balance: 17500, group: "Para ti" },
    { id: 16, name: "Suscripciones", balance: -9000, group: "Para ti" },
    { id: 17, name: "Un nuevo propósito", balance: 0, group: "Para ti" },
  ],
  2: [
    { id: 21, name: "El próximo destino", balance: 4500.25, group: "Tu futuro" },
    { id: 22, name: "Experiencias", balance: 650.75, group: "Para ti" },
  ],
}

export function referenceContext(accountId: number, scenario: ReferenceScenario) {
  const account = referenceAccounts.find((a) => a.id === accountId) ?? referenceAccounts[0]
  const rows: ReferenceEnvelope[] =
    scenario === "empty" || scenario === "loading" || scenario === "error"
      ? []
      : referenceEnvelopes[account.id].map((row, index) => ({
          ...row,
          balance: scenario === "pending" && index === 0 ? null : row.balance,
        }))
  const known = !["loading", "error", "pending"].includes(scenario)
  const balance = known ? sumMoney(rows.map((row) => row.balance!)) : null
  const positive = known
    ? sumMoney(rows.filter((r) => r.balance! > 0).map((r) => r.balance!))
    : null
  const negative = rows.filter((r) => r.balance !== null && r.balance < 0)
  return { account, rows, balance, positive, negative }
}

/** Distribution describes positive balances, never health, a target or a mixed-currency total. */
export function referenceShare(balance: number | null, positive: number | null) {
  return balance !== null && balance > 0 && positive !== null && positive > 0
    ? percentageFromAmount(balance, positive)
    : null
}
