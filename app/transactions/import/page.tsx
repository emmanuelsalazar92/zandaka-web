"use client"

import { AlertCircle, ArrowLeft, Check, FileUp, Trash2, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"

import { AppLayout } from "@/components/app-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea, ScrollAreaViewport } from "@/components/ui/scroll-area"
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

type BankFormat = "grupo-mutual" | "bac-credomatic"
type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT"
type ValidationStatus = "valid" | "warning" | "error"

interface ParsedTransaction {
  id: string
  date: string
  description: string
  amount: number
  type: TransactionType
  accountId: string
  envelopeId: string
  status: ValidationStatus
  statusMessage?: string
}

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "")
const API_BASE_URL = `${API_ROOT}/api`

function parseGrupoMutual(raw: string): ParsedTransaction[] {
  const lines = raw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0)
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
    let amountStr = amountLine
      .replace(/₡/g, "")
      .replace(/\s/g, "")
      .replace(/,/g, "")

    // Handle negative format (₡- 432,500.00)
    const isNegative = amountStr.includes("-")
    amountStr = amountStr.replace(/-/g, "")
    const amount = parseFloat(amountStr) * (isNegative ? -1 : 1)

    if (isNaN(amount)) continue

    const type: TransactionType = amount < 0 ? "EXPENSE" : "INCOME"

    transactions.push({
      id: crypto.randomUUID(),
      date,
      description: descLine,
      amount,
      type,
      accountId: "",
      envelopeId: "",
      status: "warning",
      statusMessage: "Select account and envelope",
    })
  }

  return transactions
}

function parseBacCredomatic(raw: string): ParsedTransaction[] {
  const lines = raw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0)
  const transactions: ParsedTransaction[] = []

  for (const line of lines) {
    const parts = line.split("\t")
    if (parts.length < 6) continue

    const [datePart, refCode, desc, debitStr, creditStr] = parts

    // Parse date (DD/MM/YYYY)
    const dateMatch = datePart.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!dateMatch) continue

    const [, day, month, year] = dateMatch
    const date = `${year}-${month}-${day}`

    // Combine reference code and description
    const description = `${refCode} ${desc}`.trim()

    // Parse amounts - remove thousand separators
    const debit = parseFloat(debitStr.replace(/,/g, "")) || 0
    const credit = parseFloat(creditStr.replace(/,/g, "")) || 0

    // Calculate amount: debit is negative, credit is positive
    let amount = 0
    if (debit > 0) {
      amount = -debit
    } else if (credit > 0) {
      amount = credit
    } else {
      continue // Skip rows with no amount
    }

    const type: TransactionType = amount < 0 ? "EXPENSE" : "INCOME"

    transactions.push({
      id: crypto.randomUUID(),
      date,
      description,
      amount,
      type,
      accountId: "",
      envelopeId: "",
      status: "warning",
      statusMessage: "Select account and envelope",
    })
  }

  return transactions
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "CRC",
    minimumFractionDigits: 2,
  }).format(amount)
}

export default function ImportTransactionsPage() {
  const router = useRouter()
  const [bankFormat, setBankFormat] = React.useState<BankFormat>("grupo-mutual")
  const [rawData, setRawData] = React.useState("")
  const [transactions, setTransactions] = React.useState<ParsedTransaction[]>([])
  const [isProcessed, setIsProcessed] = React.useState(false)
  const [isImporting, setIsImporting] = React.useState(false)
  const [importError, setImportError] = React.useState<string | null>(null)

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
    [accounts]
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
          }))
        )
      } catch (e) {
        console.error("Failed to fetch accounts:", e)
      } finally {
        setAccountsLoading(false)
      }
    }

    fetchAccounts()
  }, [])

  const fetchEnvelopes = React.useCallback(
    async (accountId: string) => {
      if (!accountId || envelopesByAccount[accountId] || envelopesLoading[accountId]) return

      setEnvelopesLoading((prev) => ({ ...prev, [accountId]: true }))
      try {
        const res = await fetch(
          `${API_BASE_URL}/reports/envelope-balances?accountId=${accountId}`,
          { headers: { Accept: "application/json" } }
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
        console.error("Failed to fetch envelopes:", e)
      } finally {
        setEnvelopesLoading((prev) => ({ ...prev, [accountId]: false }))
      }
    },
    [envelopesByAccount, envelopesLoading]
  )

  const handleProcess = () => {
    if (!rawData.trim()) return

    let parsed: ParsedTransaction[] = []
    if (bankFormat === "grupo-mutual") {
      parsed = parseGrupoMutual(rawData)
    } else {
      parsed = parseBacCredomatic(rawData)
    }

    setTransactions(parsed)
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

        // Recalculate validation status
        if (updated.accountId && updated.envelopeId) {
          updated.status = "valid"
          updated.statusMessage = undefined
        } else if (updated.accountId || updated.envelopeId) {
          updated.status = "warning"
          updated.statusMessage = updated.accountId
            ? "Select envelope"
            : "Select account"
        } else {
          updated.status = "warning"
          updated.statusMessage = "Select account and envelope"
        }

        return updated
      })
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

  const validTransactions = transactions.filter((t) => t.status === "valid")

  const handleImport = async () => {
    if (validTransactions.length === 0) return

    setIsImporting(true)
    setImportError(null)

    try {
      // Import transactions one by one
      for (const transaction of validTransactions) {
        const payload = {
          userId: 1,
          date: transaction.date,
          type: transaction.type,
          description: transaction.description,
          lines: [
            {
              accountId: parseInt(transaction.accountId),
              envelopeId: parseInt(transaction.envelopeId),
              amount: transaction.amount,
            },
          ],
        }

        const res = await fetch(`${API_BASE_URL}/transactions`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const message = await res.text()
          throw new Error(message || "Failed to create transaction")
        }
      }

      // Redirect back to transactions page
      router.push("/transactions")
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to import transactions"
      setImportError(message)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <AppLayout>
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
              Paste transactions copied from your bank website, review them, and import them into
              your account.
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
                <Select
                  value={bankFormat}
                  onValueChange={(v) => setBankFormat(v as BankFormat)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grupo-mutual">Grupo Mutual</SelectItem>
                    <SelectItem value="bac-credomatic">BAC Credomatic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                    : "Paste transactions from BAC Credomatic...\n\nExample:\n02/03/2026\t30100000\tCOMERCIAL LA GUARIA\t2,300.00\t0.00\t114,501.92"
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
                  <CardDescription>
                    Review and edit transactions before importing
                  </CardDescription>
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
                  <p className="text-sm">
                    Please check the format and try again.
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <ScrollAreaViewport>
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
                              {new Date(transaction.date).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })}
                            </TableCell>
                            <TableCell className="max-w-[300px] truncate" title={transaction.description}>
                              {transaction.description}
                            </TableCell>
                            <TableCell
                              className={`text-right font-mono ${
                                transaction.amount < 0
                                  ? "text-red-600"
                                  : "text-emerald-600"
                              }`}
                            >
                              {formatCurrency(transaction.amount)}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={transaction.accountId}
                                onValueChange={(v) =>
                                  updateTransaction(transaction.id, "accountId", v)
                                }
                                disabled={accountsLoading}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {activeAccounts.map((account) => (
                                    <SelectItem
                                      key={account.id}
                                      value={account.id.toString()}
                                    >
                                      {account.name}
                                    </SelectItem>
                                  ))}
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
                                  !transaction.accountId ||
                                  envelopesLoading[transaction.accountId]
                                }
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {(
                                    envelopesByAccount[transaction.accountId] || []
                                  ).map((envelope) => (
                                    <SelectItem
                                      key={envelope.id}
                                      value={envelope.id.toString()}
                                    >
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
                                  updateTransaction(
                                    transaction.id,
                                    "type",
                                    v as TransactionType
                                  )
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
                  </ScrollAreaViewport>
                </ScrollArea>
              )}

              {/* Footer Actions */}
              {transactions.length > 0 && (
                <div className="flex items-center justify-between border-t pt-4 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Only valid transactions will be imported ({validCount} of {totalCount})
                  </p>
                  <Button
                    onClick={handleImport}
                    disabled={validCount === 0 || isImporting}
                  >
                    {isImporting ? "Importing..." : `Import Valid Transactions (${validCount})`}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}
