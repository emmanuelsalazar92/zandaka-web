import { assertMoney } from "@/lib/money"

export type CurrencyCode = "CRC" | "USD"
type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT"
type ValidationStatus = "valid" | "warning" | "error"

export interface ParsedTransaction {
  sourceAmountText?: string
  id: string
  date: string
  description: string
  amount: number
  currency: string
  type: TransactionType
  accountId: string
  envelopeId: string
  appliedRuleName?: string
  status: ValidationStatus
  statusMessage?: string
}

function createRowId() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID()
  }

  return `import-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function parseBankAmount(rawAmount: string, currency = "CRC") {
  // Both bank formats supplied by Zandaka use comma grouping and a decimal dot.
  // Reject alternate/ambiguous separators, misplaced signs, and partial parses.
  const normalized = rawAmount
    .trim()
    .replace(/^[₡¢$]\s*/, "")
    .replace(/^([+-])\s+/, "$1")
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(normalized)) return Number.NaN
  try {
    return assertMoney(normalized.replace(/,/g, ""), currency)
  } catch {
    return Number.NaN
  }
}

function detectCurrencyFromAmountLine(rawAmount: string) {
  if (rawAmount.includes("$")) return "USD"
  if (/[₡¢]|â‚¡/.test(rawAmount)) return "CRC"
  return "CRC"
}

function parseBacLine(line: string) {
  const tabParts = line
    .split("\t")
    .map((part) => part.trim())
    .filter(Boolean)
  if (tabParts.length === 6) {
    return {
      datePart: tabParts[0],
      refCode: tabParts[1],
      desc: tabParts[2],
      debitStr: tabParts[3],
      creditStr: tabParts[4],
      balanceStr: tabParts[5],
    }
  }

  const match = line.match(
    /^(\d{2}\/\d{2}\/\d{4})\s+(\S+)\s+(.+?)\s+([+-]?\s*\d[\d,]*\.\d{2})\s+([+-]?\s*\d[\d,]*\.\d{2})\s+([+-]?\s*\d[\d,]*\.\d{2})$/,
  )

  if (!match) return null

  return {
    datePart: match[1],
    refCode: match[2],
    desc: match[3].trim(),
    debitStr: match[4].trim(),
    creditStr: match[5].trim(),
    balanceStr: match[6].trim(),
  }
}

export function parseGrupoMutual(raw: string): ParsedTransaction[] {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  const transactions: ParsedTransaction[] = []

  // Process in blocks of 5 lines
  for (let i = 0; i + 4 < lines.length; i += 5) {
    const dateLine = lines[i]
    // lines[i + 1] is time - ignored
    const descLine = lines[i + 2]
    const amountLine = lines[i + 3]
    // lines[i + 4] is balance - ignored

    // Parse date (DD/MM/YYYY)
    const dateMatch = dateLine.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!dateMatch) continue

    const [, day, month, year] = dateMatch
    const date = `${year}-${month}-${day}`

    const currency = detectCurrencyFromAmountLine(amountLine)
    const amount = parseBankAmount(amountLine, currency)
    if (Number.isNaN(amount)) {
      transactions.push({
        id: createRowId(),
        date,
        description: descLine,
        amount: 0,
        currency,
        type: "EXPENSE",
        accountId: "",
        envelopeId: "",
        sourceAmountText: amountLine,
        status: "error",
        statusMessage: "Invalid bank amount or unsupported precision",
      })
      continue
    }

    const type: TransactionType = amount < 0 ? "EXPENSE" : "INCOME"

    transactions.push({
      id: createRowId(),
      date,
      description: descLine,
      sourceAmountText: amountLine,
      amount,
      currency,
      type,
      accountId: "",
      envelopeId: "",
      status: "warning",
      statusMessage: "Select account and envelope",
    })
  }

  return transactions
}

export function parseBacCredomatic(
  raw: string,
  defaultCurrency: CurrencyCode,
): ParsedTransaction[] {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  const transactions: ParsedTransaction[] = []

  for (const line of lines) {
    const parsedLine = parseBacLine(line)

    if (!parsedLine) {
      transactions.push({
        id: createRowId(),
        date: "",
        description: line.substring(0, 50) + (line.length > 50 ? "..." : ""),
        amount: 0,
        currency: defaultCurrency,
        type: "EXPENSE",
        accountId: "",
        envelopeId: "",
        status: "error",
        statusMessage: "Invalid format: expected BAC transaction columns",
      })
      continue
    }

    const { datePart, refCode, desc, debitStr, creditStr } = parsedLine

    // Parse date (DD/MM/YYYY)
    const dateMatch = datePart.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!dateMatch) {
      transactions.push({
        id: createRowId(),
        date: "",
        description: `${refCode} ${desc}`.trim(),
        amount: 0,
        currency: defaultCurrency,
        type: "EXPENSE",
        accountId: "",
        envelopeId: "",
        status: "error",
        statusMessage: `Invalid date format: ${datePart}`,
      })
      continue
    }

    const [, day, month, year] = dateMatch
    const date = `${year}-${month}-${day}`

    // Combine reference code and description
    const description = `${refCode} ${desc}`.trim()

    const debit = parseBankAmount(debitStr, defaultCurrency)
    const credit = parseBankAmount(creditStr, defaultCurrency)
    const currency = defaultCurrency

    if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0) {
      transactions.push({
        id: createRowId(),
        date,
        description,
        amount: 0,
        currency,
        type: "EXPENSE",
        accountId: "",
        envelopeId: "",
        sourceAmountText: debitStr + " | " + creditStr,
        status: "error",
        statusMessage: "Invalid BAC amount or unsupported precision",
      })
      continue
    }

    // Validation: both debit and credit have values
    if (Number.isFinite(debit) && Number.isFinite(credit) && debit > 0 && credit > 0) {
      transactions.push({
        id: createRowId(),
        date,
        description,
        amount: 0,
        currency,
        type: "EXPENSE",
        accountId: "",
        envelopeId: "",
        status: "warning",
        statusMessage: "Both debit and credit have values",
      })
      continue
    }

    // Validation: both debit and credit are zero
    if ((!Number.isFinite(debit) || debit === 0) && (!Number.isFinite(credit) || credit === 0)) {
      transactions.push({
        id: createRowId(),
        date,
        description,
        amount: 0,
        currency,
        type: "EXPENSE",
        accountId: "",
        envelopeId: "",
        status: "warning",
        statusMessage: "Both debit and credit are zero",
      })
      continue
    }

    // Calculate amount: debit is negative (expense), credit is positive (income)
    let amount = 0
    let type: TransactionType = "EXPENSE"
    if (Number.isFinite(debit) && debit > 0 && (!Number.isFinite(credit) || credit === 0)) {
      amount = -debit
      type = "EXPENSE"
    } else if (Number.isFinite(credit) && credit > 0 && (!Number.isFinite(debit) || debit === 0)) {
      amount = credit
      type = "INCOME"
    }

    transactions.push({
      id: createRowId(),
      date,
      description,
      sourceAmountText: debitStr + " | " + creditStr,
      amount,
      currency,
      type,
      accountId: "",
      envelopeId: "",
      status: "warning",
      statusMessage: "Select account and envelope",
    })
  }

  return transactions
}
