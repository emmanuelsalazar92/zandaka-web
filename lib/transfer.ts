import { transactionAmount } from "@/lib/transaction-amount"

export type TransferAccount = { id: number; name: string; currency: string }
export type TransferEnvelope = { id: number; name: string }
export type TransferDraft = {
  date: string
  description: string
  fromAccount: string
  fromEnvelope: string
  toAccount: string
  toEnvelope: string
  amount: string
}
export type TransferPayload = {
  userId: number
  requestId: string
  date: string
  description: string
  from: { accountId: number; envelopeId: number }
  to: { accountId: number; envelopeId: number }
  amount: number
}
export type PendingTransfer = {
  payload: TransferPayload
  fromLabel: string
  toLabel: string
  currency: string
}
const storageKey = (userId: number) => `zandaka.transfer.pending.v1.${userId}`

export function transferState(
  draft: TransferDraft,
  accounts: TransferAccount[],
  fromEnvelopes: TransferEnvelope[],
  toEnvelopes: TransferEnvelope[],
) {
  const from = accounts.find((a) => String(a.id) === draft.fromAccount)
  const to = accounts.find((a) => String(a.id) === draft.toAccount)
  const source = fromEnvelopes.find((e) => String(e.id) === draft.fromEnvelope)
  const destination = toEnvelopes.find((e) => String(e.id) === draft.toEnvelope)
  const currencyError =
    from && to && from.currency.toUpperCase() !== to.currency.toUpperCase()
      ? `El origen usa ${from.currency} y el destino ${to.currency}. Elige cuentas de la misma moneda; las transferencias todavía no convierten monedas.`
      : null
  const destinationError =
    from && to && source && destination && from.id === to.id && source.id === destination.id
      ? "Elige un sobre de destino diferente al de origen."
      : null
  let amount: number | null = null,
    amountError: string | null = null
  if (draft.amount.trim()) {
    try {
      if (!from || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(draft.amount.trim())) throw Error()
      amount = transactionAmount(draft.amount, "TRANSFER", from.currency)
      if (!(amount > 0)) throw Error()
    } catch {
      amountError =
        "Escribe un importe positivo, con punto decimal y la precisión de la moneda; por ejemplo, 1234.56."
      amount = null
    }
  }
  const parsedDate = new Date(`${draft.date}T00:00:00Z`)
  const validDate =
    /^\d{4}-\d{2}-\d{2}$/.test(draft.date) &&
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === draft.date
  return {
    from,
    to,
    source,
    destination,
    amount,
    amountError,
    currencyError,
    destinationError,
    ready: Boolean(
      from &&
      to &&
      source &&
      destination &&
      amount !== null &&
      !amountError &&
      !currencyError &&
      !destinationError &&
      validDate &&
      draft.description.trim() &&
      draft.description.length <= 1000,
    ),
  }
}

/** getRandomValues is available on the LAN HTTP testing origin; randomUUID may not be. */
export function transferRequestId(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 15) | 64
  bytes[8] = (bytes[8] & 63) | 128
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
export function pendingTransferExists(userId: number): boolean {
  try {
    return Boolean(window.sessionStorage.getItem(storageKey(userId)))
  } catch {
    return false
  }
}
export function readPendingTransfer(userId: number): PendingTransfer | null {
  const raw = window.sessionStorage.getItem(storageKey(userId))
  if (!raw) return null
  if (raw.length > 16384) throw Error("Invalid pending transfer")
  const value = JSON.parse(raw) as PendingTransfer,
    p = value?.payload
  const validEndpoint = (e: TransferPayload["from"] | undefined) =>
    e &&
    Number.isSafeInteger(e.accountId) &&
    e.accountId > 0 &&
    Number.isSafeInteger(e.envelopeId) &&
    e.envelopeId > 0
  if (
    !p ||
    p.userId !== userId ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(p.requestId) ||
    typeof p.date !== "string" ||
    typeof p.description !== "string" ||
    p.description.length > 1000 ||
    !validEndpoint(p.from) ||
    !validEndpoint(p.to) ||
    !Number.isFinite(p.amount) ||
    p.amount <= 0 ||
    typeof value.currency !== "string" ||
    !/^[A-Z]{3}$/.test(value.currency) ||
    typeof value.fromLabel !== "string" ||
    typeof value.toLabel !== "string"
  )
    throw Error("Invalid pending transfer")
  transactionAmount(String(p.amount), "TRANSFER", value.currency)
  if (!p.description.trim() || value.fromLabel.length > 2000 || value.toLabel.length > 2000)
    throw Error("Invalid pending transfer")
  return value
}
export function savePendingTransfer(record: PendingTransfer): void {
  window.sessionStorage.setItem(storageKey(record.payload.userId), JSON.stringify(record))
}
export function clearPendingTransfer(userId: number): void {
  window.sessionStorage.removeItem(storageKey(userId))
}

/** Never dismiss an uncertain attempt on a malformed or unrelated 2xx response. */
export function isTransferConfirmation(record: PendingTransfer, value: unknown): boolean {
  if (!value || typeof value !== "object") return false
  const result = value as {
    transaction?: Record<string, unknown>
    lines?: Array<Record<string, unknown>>
  }
  const transaction = result.transaction,
    p = record.payload
  if (
    !transaction ||
    !Number.isSafeInteger(transaction.id) ||
    Number(transaction.id) <= 0 ||
    transaction.type !== "TRANSFER" ||
    (transaction.user_id ?? transaction.userId) !== p.userId ||
    transaction.date !== p.date ||
    transaction.description !== p.description.trim() ||
    !Array.isArray(result.lines) ||
    result.lines.length !== 2
  )
    return false
  return [
    [p.from, -p.amount],
    [p.to, p.amount],
  ].every(([endpoint, amount]) => {
    const end = endpoint as TransferPayload["from"]
    return result.lines!.some(
      (line) =>
        line !== null &&
        typeof line === "object" &&
        (line.account_id ?? line.accountId) === end.accountId &&
        (line.envelope_id ?? line.envelopeId) === end.envelopeId &&
        line.amount === amount,
    )
  })
}
