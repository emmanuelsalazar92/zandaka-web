import { sumMoney } from "@/lib/money"
import { transactionAmount } from "@/lib/transaction-amount"
import type { TimelineTransaction } from "@/lib/transaction-timeline"

export type MovementKind = "INCOME" | "EXPENSE"
export type MovementAccount = {
  id: number
  name: string
  currency: string
  institution?: string | null
}
export type MovementEnvelope = { id: number; name: string }
export type MovementLineDraft = {
  key: number
  accountId: string
  envelopeId: string
  amount: string
  notice: string
  candidate?: number
}
export type EnvelopeOptions = { status: "loading" | "ready" | "error"; items: MovementEnvelope[] }
export const emptyMovementLine = (key: number): MovementLineDraft => ({
  key,
  accountId: "",
  envelopeId: "",
  amount: "",
  notice: "",
})
export const movementAccountLabel = (a: MovementAccount) =>
  `${a.name} · ${a.institution || "Institución sin identificar"} · ${a.currency}`

export function selectMovementAccount(
  line: MovementLineDraft,
  value: string,
  accounts: MovementAccount[],
  candidate?: number,
): MovementLineDraft {
  if (line.accountId === value && !candidate) return line
  const before = accounts.find((a) => String(a.id) === line.accountId),
    after = accounts.find((a) => String(a.id) === value)
  // An account may disappear on refresh. Its former currency is then unknown;
  // never carry its amount into a newly selected currency by assuming equality.
  const currencyChanged = Boolean(
    line.accountId && (!before || before.currency !== after?.currency),
  )
  return {
    ...line,
    accountId: value,
    envelopeId: "",
    candidate,
    amount: currencyChanged ? "" : line.amount,
    notice: candidate
      ? "Comprobando el sobre de la propuesta reciente…"
      : currencyChanged
        ? "La moneda cambió o no se pudo confirmar: se borró el importe anterior. Selecciona un sobre e introduce el importe en la nueva moneda."
        : "Selecciona un sobre de esta cuenta; el sobre anterior no se conserva al cambiar cuenta.",
  }
}

export function movementLineState(
  line: MovementLineDraft,
  kind: MovementKind,
  accounts: MovementAccount[],
  options?: EnvelopeOptions,
) {
  const account = accounts.find((a) => String(a.id) === line.accountId)
  const envelope =
    options?.status === "ready"
      ? options.items.find((e) => String(e.id) === line.envelopeId)
      : undefined
  let amount: number | null = null,
    error: string | null = null
  if (line.amount.trim() && account) {
    try {
      amount = transactionAmount(line.amount, kind, account.currency)
    } catch {
      error = `Escribe un importe distinto de cero, con punto decimal y la precisión de ${account.currency}.`
    }
  }
  return {
    account,
    envelope,
    amount,
    error,
    ready: Boolean(account && envelope && amount !== null && !error && !line.candidate),
  }
}

export function movementTotals(
  lines: MovementLineDraft[],
  kind: MovementKind,
  accounts: MovementAccount[],
  options: Record<string, EnvelopeOptions>,
) {
  const states = lines.map((line) =>
    movementLineState(line, kind, accounts, options[line.accountId]),
  )
  if (!states.length || states.some((s) => !s.ready)) return null
  const grouped = new Map<string, number[]>()
  for (const state of states) {
    const currency = state.account!.currency
    grouped.set(currency, [...(grouped.get(currency) ?? []), state.amount!])
  }
  try {
    return [...grouped].map(([currency, values]) => ({ currency, amount: sumMoney(values) }))
  } catch {
    return null
  }
}

/** Only the loaded page of history; never persist financial history or silently select an option. */
export function recentMovementDestinations(
  history: TimelineTransaction[],
  kind: MovementKind,
  accounts: MovementAccount[],
) {
  const results: Array<{ accountId: number; envelopeId: number; label: string }> = [],
    seen = new Set<string>()
  for (const transaction of [...history]
    .filter((t) => t.type === kind)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id))
    for (const line of transaction.lines) {
      const account = accounts.find((a) => a.id === line.accountId),
        key = `${line.accountId}/${line.envelopeId}`
      if (
        !account ||
        !Number.isSafeInteger(line.envelopeId) ||
        line.envelopeId <= 0 ||
        seen.has(key)
      )
        continue
      seen.add(key)
      results.push({
        accountId: account.id,
        envelopeId: line.envelopeId,
        label: `${movementAccountLabel(account)} → ${line.envelope}`,
      })
      if (results.length === 3) return results
    }
  return results
}

export function validMovementDate(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`)
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  )
}

export type MovementPayload = {
  userId: number
  date: string
  description: string
  type: MovementKind
  lines: Array<{ accountId: number; envelopeId: number; amount: number }>
}
export function isMovementConfirmation(payload: MovementPayload, result: unknown) {
  if (!result || typeof result !== "object") return false
  const { transaction: t, lines } = result as {
    transaction?: Record<string, unknown>
    lines?: Array<Record<string, unknown>>
  }
  if (
    !t ||
    !Number.isSafeInteger(t.id) ||
    Number(t.id) <= 0 ||
    t.type !== payload.type ||
    (t.user_id ?? t.userId) !== payload.userId ||
    t.date !== payload.date ||
    t.description !== payload.description ||
    !Array.isArray(lines) ||
    lines.length !== payload.lines.length
  )
    return false
  const unmatched = [...lines]
  for (const expected of payload.lines) {
    const index = unmatched.findIndex(
      (l) =>
        l &&
        (l.account_id ?? l.accountId) === expected.accountId &&
        (l.envelope_id ?? l.envelopeId) === expected.envelopeId &&
        l.amount === expected.amount,
    )
    if (index < 0) return false
    unmatched.splice(index, 1)
  }
  return true
}
