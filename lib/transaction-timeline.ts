export type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT"

export type TimelineTransactionLine = {
  accountId: number
  account: string
  accountCurrency: string
  envelopeId: number
  envelope: string
  amount: number
}

export type TimelineTransaction = {
  id: number
  date: string
  type: TransactionType
  description: string
  lines: TimelineTransactionLine[]
}

export type TransactionVisualTone = "income" | "expense" | "adjustment" | "transfer"

export type TransactionTypeMeta = {
  label: string
  tone: TransactionVisualTone
  amountContextLabel: string
}

export type TransactionTimelineGroup = {
  key: string
  label: string
  fullDateLabel: string
  transactionCount: number
  items: TimelineTransaction[]
}

const ISO_DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_IN_MS = 24 * 60 * 60 * 1000

const toSafeNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0

function parseTransactionDate(value: string) {
  const normalized = value.trim()
  if (!normalized) return null

  const dateOnlyMatch = ISO_DATE_ONLY_PATTERN.exec(normalized)
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch
    return new Date(Number(year), Number(month) - 1, Number(day), 12)
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12)
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatDate(date: Date, locale = "en-US") {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date)
}

function getDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function formatTransactionGroupLabel(
  value: string,
  options?: { now?: Date; locale?: string },
) {
  const parsed = parseTransactionDate(value)
  if (!parsed) return "Unknown date"

  const today = startOfDay(options?.now ?? new Date())
  const current = startOfDay(parsed)
  const diffInDays = Math.round((current.getTime() - today.getTime()) / DAY_IN_MS)

  if (diffInDays === 0) return "Today"
  if (diffInDays === -1) return "Yesterday"

  return formatDate(parsed, options?.locale)
}

export function formatTransactionFullDate(value: string, options?: { locale?: string }) {
  const parsed = parseTransactionDate(value)
  if (!parsed) return "Unknown date"
  return formatDate(parsed, options?.locale)
}

export function getTransactionTypeMeta(type: TransactionType | string): TransactionTypeMeta {
  if (type === "INCOME") {
    return { label: "Income", tone: "income", amountContextLabel: "Net inflow" }
  }
  if (type === "EXPENSE") {
    return { label: "Expense", tone: "expense", amountContextLabel: "Net outflow" }
  }
  if (type === "TRANSFER") {
    return { label: "Transfer", tone: "transfer", amountContextLabel: "Transferred" }
  }

  return { label: "Adjustment", tone: "adjustment", amountContextLabel: "Net adjustment" }
}

export function getTransactionNetAmount(transaction: TimelineTransaction) {
  return transaction.lines.reduce((sum, line) => sum + toSafeNumber(line.amount), 0)
}

export function getTransactionDisplayAmount(transaction: TimelineTransaction) {
  if (transaction.type === "TRANSFER") {
    return transaction.lines.reduce(
      (largest, line) => Math.max(largest, Math.abs(toSafeNumber(line.amount))),
      0,
    )
  }

  return getTransactionNetAmount(transaction)
}

export function getTransactionDisplayCurrency(transaction: TimelineTransaction) {
  const currencies = Array.from(
    new Set(transaction.lines.map((line) => line.accountCurrency).filter(Boolean)),
  )

  if (currencies.length !== 1) return null
  return currencies[0]
}

export function groupTransactionsForTimeline(
  transactions: TimelineTransaction[],
  options?: { now?: Date; locale?: string },
) {
  const sorted = [...transactions].sort((left, right) => {
    const leftTime = parseTransactionDate(left.date)?.getTime() ?? Number.NEGATIVE_INFINITY
    const rightTime = parseTransactionDate(right.date)?.getTime() ?? Number.NEGATIVE_INFINITY

    if (rightTime !== leftTime) return rightTime - leftTime
    return right.id - left.id
  })

  const groups = new Map<string, TransactionTimelineGroup>()

  for (const transaction of sorted) {
    const parsedDate = parseTransactionDate(transaction.date)
    const key = parsedDate ? getDateKey(parsedDate) : "unknown-date"

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: formatTransactionGroupLabel(transaction.date, options),
        fullDateLabel: formatTransactionFullDate(transaction.date, options),
        transactionCount: 0,
        items: [],
      })
    }

    const group = groups.get(key)
    if (!group) continue

    group.items.push(transaction)
    group.transactionCount += 1
  }

  return Array.from(groups.values())
}
