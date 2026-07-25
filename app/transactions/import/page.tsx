"use client"

import { AlertCircle, ArrowLeft, Check, FileUp, Trash2, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { formatCurrency } from "@/lib/currency-formatter"
import { formatIsoDateOnly } from "@/lib/date-only"
import { fetchAutoAssignmentRules, type AutoAssignmentRule } from "@/lib/settings-api"
import {
  buildTransactionImportPayload,
  getImportRowValidationError,
} from "@/lib/transaction-import-helpers"

type BankFormat = "grupo-mutual" | "bac-credomatic"
type CurrencyCode = "CRC" | "USD"
type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT"
type ValidationStatus = "valid" | "warning" | "error"

interface ParsedTransaction {
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

const API_BASE_URL = "/api"
const CURRENT_USER_ID = 1

function createRowId() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID()
  }

  return `import-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function parseBankAmount(rawAmount: string) {
  const normalized = rawAmount
    .replace(/[^\d,.\-+\s]/g, "")
    .replace(/\s/g, "")
    .replace(/,/g, "")
    .replace(/\+/g, "")
  const isNegative = normalized.includes("-")
  const numericValue = Number.parseFloat(normalized.replace(/-/g, ""))

  if (!Number.isFinite(numericValue)) return Number.NaN

  return isNegative ? -numericValue : numericValue
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

function matchesAutoAssignmentRule(description: string, rule: AutoAssignmentRule) {
  const candidate = description.trim().toUpperCase()
  const pattern = rule.pattern.trim().toUpperCase()

  if (!candidate || !pattern) return false

  switch (rule.matchType) {
    case "CONTAINS":
      return candidate.includes(pattern)
    case "STARTS_WITH":
      return candidate.startsWith(pattern)
    case "ENDS_WITH":
      return candidate.endsWith(pattern)
    case "EXACT":
      return candidate === pattern
    case "REGEX":
      try {
        return new RegExp(rule.pattern, "i").test(description)
      } catch {
        return false
      }
    default:
      return false
  }
}

function applyAutoAssignmentRules(transactions: ParsedTransaction[], rules: AutoAssignmentRule[]) {
  const orderedRules = rules
    .filter((rule) => rule.isActive)
    .slice()
    .sort((a, b) => a.priority - b.priority || a.id - b.id)

  return transactions.map((transaction) => {
    const matchedRule = orderedRules.find((rule) =>
      matchesAutoAssignmentRule(transaction.description, rule),
    )

    if (!matchedRule) return transaction

    const matchedAccountId = matchedRule.accountId ?? matchedRule.accountEnvelopeAccountId

    return {
      ...transaction,
      accountId: matchedAccountId ? String(matchedAccountId) : transaction.accountId,
      envelopeId: matchedRule.accountEnvelopeId
        ? String(matchedRule.accountEnvelopeId)
        : transaction.envelopeId,
      appliedRuleName: matchedRule.pattern,
    }
  })
}

function getAccountsForTransaction(
  transaction: ParsedTransaction,
  accounts: { id: number; name: string; currency: string; active: boolean }[],
) {
  return accounts.filter(
    (account) =>
      account.active && account.currency.toUpperCase() === transaction.currency.toUpperCase(),
  )
}

function parseGrupoMutual(raw: string): ParsedTransaction[] {
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

    // Parse amount - remove currency symbol and thousand separators
    let amountStr = amountLine.replace(/₡/g, "").replace(/\s/g, "").replace(/,/g, "")

    // Handle negative format (₡- 432,500.00)
    amountStr = amountStr.replace(/-/g, "")
    const amount = parseBankAmount(amountLine)
    const currency = detectCurrencyFromAmountLine(amountLine)
    void amountStr

    if (Number.isNaN(amount)) continue

    const type: TransactionType = amount < 0 ? "EXPENSE" : "INCOME"

    transactions.push({
      id: createRowId(),
      date,
      description: descLine,
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

function parseBacCredomatic(raw: string, defaultCurrency: CurrencyCode): ParsedTransaction[] {
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

    const debit = parseBankAmount(debitStr)
    const credit = parseBankAmount(creditStr)
    const currency = defaultCurrency

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

export default function ImportTransactionsPage() {
  const router = useRouter()
  const [bankFormat, setBankFormat] = React.useState<BankFormat>("grupo-mutual")
  const [bacCurrency, setBacCurrency] = React.useState<CurrencyCode>("CRC")
  const [rawData, setRawData] = React.useState("")
  const [transactions, setTransactions] = React.useState<ParsedTransaction[]>([])
  const [isProcessed, setIsProcessed] = React.useState(false)
  const [isImporting, setIsImporting] = React.useState(false)
  const [importError, setImportError] = React.useState<string | null>(null)
  const [autoAssignmentRules, setAutoAssignmentRules] = React.useState<AutoAssignmentRule[]>([])

  // Accounts and envelopes state
  const [accounts, setAccounts] = React.useState<
    { id: number; name: string; currency: string; active: boolean }[]
  >([])
  const [accountsLoading, setAccountsLoading] = React.useState(false)
  const [envelopesByAccount, setEnvelopesByAccount] = React.useState<
    Record<string, { id: number; name: string; categoryId: number }[]>
  >({})
  const [envelopesLoading, setEnvelopesLoading] = React.useState<Record<string, boolean>>({})

  const activeAccounts = React.useMemo(
    () => accounts.filter((account) => account.active),
    [accounts],
  )
  const importCandidates = React.useMemo(
    () => transactions.filter((transaction) => transaction.status !== "error"),
    [transactions],
  )
  const importableTransactions = React.useMemo(
    () =>
      importCandidates.filter(
        (transaction) =>
          !getImportRowValidationError(transaction, activeAccounts, envelopesByAccount),
      ),
    [activeAccounts, envelopesByAccount, importCandidates],
  )

  // Fetch accounts on mount
  React.useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setAccountsLoading(true)
        const res = await fetch(`${API_BASE_URL}/accounts`, {
          headers: { Accept: "application/json" },
        })
        if (!res.ok) throw new Error("Failed to load accounts")
        const data = (await res.json()) as {
          id: number
          name: string
          currency: string
          is_active: number
        }[]
        setAccounts(
          data.map((account) => ({
            id: account.id,
            name: account.name,
            currency: account.currency,
            active: account.is_active === 1,
          })),
        )
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load accounts"
        setImportError(message)
      } finally {
        setAccountsLoading(false)
      }
    }

    fetchAccounts()
  }, [])

  React.useEffect(() => {
    const loadRules = async () => {
      try {
        const rules = await fetchAutoAssignmentRules()
        setAutoAssignmentRules(rules.filter((rule) => rule.isActive))
      } catch {
        // Rules are assistive only; importing should still work if they cannot be loaded.
      }
    }

    void loadRules()
  }, [])

  const fetchEnvelopes = React.useCallback(
    async (accountId: string) => {
      if (!accountId || envelopesByAccount[accountId] || envelopesLoading[accountId]) return

      setEnvelopesLoading((prev) => ({ ...prev, [accountId]: true }))
      try {
        const res = await fetch(
          `${API_BASE_URL}/reports/envelope-balances?accountId=${accountId}`,
          { headers: { Accept: "application/json" } },
        )
        if (!res.ok) throw new Error("Failed to load envelopes")
        const data = (await res.json()) as {
          envelopeId: number
          categoryId: number
          categoryName: string
        }[]
        setEnvelopesByAccount((prev) => ({
          ...prev,
          [accountId]: data.map((env) => ({
            id: env.envelopeId,
            categoryId: env.categoryId,
            name: env.categoryName,
          })),
        }))
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load envelopes"
        setImportError(message)
      } finally {
        setEnvelopesLoading((prev) => ({ ...prev, [accountId]: false }))
      }
    },
    [envelopesByAccount, envelopesLoading],
  )

  const syncTransactionStatuses = React.useCallback(
    (rows: ParsedTransaction[]): ParsedTransaction[] =>
      rows.map((row) => {
        if (row.status === "error") return row

        const validationError = getImportRowValidationError(row, activeAccounts, envelopesByAccount)

        return {
          ...row,
          status: validationError ? ("warning" as const) : ("valid" as const),
          statusMessage: validationError ?? undefined,
        }
      }),
    [activeAccounts, envelopesByAccount],
  )

  React.useEffect(() => {
    setTransactions((prev) => syncTransactionStatuses(prev))
  }, [syncTransactionStatuses])

  const handleProcess = () => {
    if (!rawData.trim()) return

    let parsed: ParsedTransaction[] = []
    if (bankFormat === "grupo-mutual") {
      parsed = parseGrupoMutual(rawData)
    } else {
      parsed = parseBacCredomatic(rawData, bacCurrency)
    }

    const withRules = applyAutoAssignmentRules(parsed, autoAssignmentRules)
    const matchedAccountIds = Array.from(
      new Set(withRules.map((transaction) => transaction.accountId).filter(Boolean)),
    )
    matchedAccountIds.forEach((accountId) => {
      void fetchEnvelopes(accountId)
    })

    setTransactions(syncTransactionStatuses(withRules))
    setIsProcessed(true)
    setImportError(null)
  }

  const handleClear = () => {
    setRawData("")
    setTransactions([])
    setIsProcessed(false)
    setImportError(null)
  }

  const updateTransaction = (id: string, field: keyof ParsedTransaction, value: string) => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t

        const updated = { ...t, [field]: value }

        // If account changed, reset envelope and fetch new ones
        if (field === "accountId") {
          updated.envelopeId = ""
          if (value) {
            fetchEnvelopes(value)
          }
        }

        const validationError = getImportRowValidationError(
          updated,
          activeAccounts,
          envelopesByAccount,
        )
        updated.status = validationError ? "warning" : "valid"
        updated.statusMessage = validationError ?? undefined

        return updated
      }),
    )
  }

  const removeTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id))
  }

  // Summary counts
  const totalCount = transactions.length
  const validCount = transactions.filter((t) => t.status === "valid").length
  const warningCount = transactions.filter((t) => t.status === "warning").length
  const errorCount = transactions.filter((t) => t.status === "error").length
  const importableCount = importableTransactions.length

  const handleImport = async () => {
    if (importableTransactions.length === 0) return

    setIsImporting(true)
    setImportError(null)

    let successCount = 0
    let failedCount = 0

    for (const transaction of importCandidates) {
      const validationError = getImportRowValidationError(
        transaction,
        activeAccounts,
        envelopesByAccount,
      )
      if (validationError) {
        failedCount += 1
        continue
      }

      try {
        const payload = buildTransactionImportPayload(transaction, CURRENT_USER_ID)
        const res = await fetch(`${API_BASE_URL}/transactions`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          await res.text()
          failedCount += 1
          continue
        }

        successCount += 1
      } catch {
        failedCount += 1
      }
    }

    setIsImporting(false)

    if (successCount === 0) {
      const summary = `Imported 0 transactions, ${failedCount} failed`
      setImportError(summary)
      toast({
        title: "Import failed",
        description: summary,
        variant: "destructive",
      })
      return
    }

    const description =
      failedCount === 0
        ? `${successCount} transactions imported successfully`
        : `Imported ${successCount} transactions, ${failedCount} failed`

    toast({
      title: failedCount === 0 ? "Import complete" : "Import completed with issues",
      description,
      variant: failedCount === 0 ? "default" : "destructive",
    })
    router.push("/transactions")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/transactions">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Import Transactions</h2>
          <p className="text-muted-foreground">
            Paste transactions copied from your bank website, review them, and import them into your
            account.
          </p>
        </div>
      </div>

      {/* Import Error */}
      {importError && (
        <Alert className="border-destructive/50 bg-destructive/5">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-sm">{importError}</AlertDescription>
        </Alert>
      )}

      {/* Top Section - Import Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Import Controls</CardTitle>
          <CardDescription>
            Select your bank format and paste the raw transaction data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="w-64 space-y-2">
              <label className="text-sm font-medium">Bank Format</label>
              <Select value={bankFormat} onValueChange={(v) => setBankFormat(v as BankFormat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grupo-mutual">Grupo Mutual</SelectItem>
                  <SelectItem value="bac-credomatic">BAC Credomatic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {bankFormat === "bac-credomatic" && (
              <div className="w-52 space-y-2">
                <label className="text-sm font-medium">BAC Currency</label>
                <Select
                  value={bacCurrency}
                  onValueChange={(v) => setBacCurrency(v as CurrencyCode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CRC">CRC</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={handleProcess} disabled={!rawData.trim()}>
                <FileUp className="mr-2 h-4 w-4" />
                Process Transactions
              </Button>
              <Button variant="outline" onClick={handleClear}>
                Clear
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Paste Transactions</label>
            <Textarea
              placeholder={
                bankFormat === "grupo-mutual"
                  ? "Paste transactions from Grupo Mutual...\n\nExample:\n15/03/2026\n11:22:40 PM\nPAGO INTERESES\n₡7,379.25\n₡25,307,671.77"
                  : "Paste transactions from BAC Credomatic...\nChoose the BAC currency above first.\n\nExample:\n02/03/2026\t30100000\tCOMERCIAL LA GUARIA\t2,300.00\t0.00\t114,501.92"
              }
              value={rawData}
              onChange={(e) => setRawData(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Bottom Section - Parsed Transactions */}
      {isProcessed && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Transaction Preview</CardTitle>
                <CardDescription>Review and edit transactions before importing</CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary" className="gap-1">
                  Total: {totalCount}
                </Badge>
                <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
                  <Check className="h-3 w-3" />
                  Valid: {validCount}
                </Badge>
                <Badge className="gap-1 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">
                  <AlertCircle className="h-3 w-3" />
                  Warnings: {warningCount}
                </Badge>
                <Badge className="gap-1 bg-red-500/10 text-red-600 hover:bg-red-500/20">
                  <X className="h-3 w-3" />
                  Errors: {errorCount}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4" />
                <p>No transactions could be parsed from the input.</p>
                <p className="text-sm">Please check the format and try again.</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Date</TableHead>
                      <TableHead className="min-w-[200px]">Description</TableHead>
                      <TableHead className="w-[120px] text-right">Amount</TableHead>
                      <TableHead className="w-[160px]">Account</TableHead>
                      <TableHead className="w-[160px]">Envelope</TableHead>
                      <TableHead className="w-[100px]">Type</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-medium">
                          {formatIsoDateOnly(transaction.date)}
                        </TableCell>
                        <TableCell
                          className="max-w-[300px] truncate"
                          title={transaction.description}
                        >
                          <div className="space-y-1">
                            <div>{transaction.description}</div>
                            {transaction.appliedRuleName && (
                              <div className="text-xs text-muted-foreground">
                                Auto rule: {transaction.appliedRuleName}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono ${
                            transaction.amount < 0 ? "text-red-600" : "text-emerald-600"
                          }`}
                        >
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={transaction.accountId}
                            onValueChange={(v) => updateTransaction(transaction.id, "accountId", v)}
                            disabled={accountsLoading}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {getAccountsForTransaction(transaction, activeAccounts).map(
                                (account) => (
                                  <SelectItem key={account.id} value={account.id.toString()}>
                                    {account.name} ({account.currency})
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={transaction.envelopeId}
                            onValueChange={(v) =>
                              updateTransaction(transaction.id, "envelopeId", v)
                            }
                            disabled={
                              !transaction.accountId || envelopesLoading[transaction.accountId]
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(envelopesByAccount[transaction.accountId] || []).map((envelope) => (
                                <SelectItem key={envelope.id} value={envelope.id.toString()}>
                                  {envelope.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={transaction.type}
                            onValueChange={(v) =>
                              updateTransaction(transaction.id, "type", v as TransactionType)
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EXPENSE">Expense</SelectItem>
                              <SelectItem value="INCOME">Income</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {transaction.status === "valid" && (
                            <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
                              <Check className="mr-1 h-3 w-3" />
                              Valid
                            </Badge>
                          )}
                          {transaction.status === "warning" && (
                            <Badge
                              className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                              title={transaction.statusMessage}
                            >
                              <AlertCircle className="mr-1 h-3 w-3" />
                              Warning
                            </Badge>
                          )}
                          {transaction.status === "error" && (
                            <Badge
                              className="bg-red-500/10 text-red-600 hover:bg-red-500/20"
                              title={transaction.statusMessage}
                            >
                              <X className="mr-1 h-3 w-3" />
                              Error
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => removeTransaction(transaction.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}

            {/* Footer Actions */}
            {transactions.length > 0 && (
              <div className="flex items-center justify-between border-t pt-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  Non-error rows with valid account, envelope, date, and amount will be imported (
                  {importableCount} ready)
                </p>
                <Button onClick={handleImport} disabled={importableCount === 0 || isImporting}>
                  {isImporting ? "Importing..." : `Import Transactions (${importableCount})`}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
