"use client"

import * as React from "react"
import { Upload, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
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
import { ScrollArea } from "@/components/ui/scroll-area"

type BankFormat = "grupo-mutual" | "bac"

type ParsedTransactionStatus = "valid" | "warning" | "error"

interface ParsedTransaction {
  id: string
  date: string
  description: string
  amount: number
  currency: string
  balance: number | null
  status: ParsedTransactionStatus
  statusMessage?: string
}

interface ParseSummary {
  total: number
  valid: number
  warnings: number
  errors: number
}

function parseGrupoMutual(text: string): ParsedTransaction[] {
  const lines = text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0)
  const transactions: ParsedTransaction[] = []
  
  // Process in blocks of 5 lines
  for (let i = 0; i + 4 < lines.length; i += 5) {
    const dateLine = lines[i]
    const timeLine = lines[i + 1]
    const descriptionLine = lines[i + 2]
    const amountLine = lines[i + 3]
    const balanceLine = lines[i + 4]

    // Validate date format (dd/mm/yyyy)
    const dateMatch = dateLine?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!dateMatch) {
      // Not a valid transaction block, skip
      continue
    }

    // Validate time format (hh:mm:ss AM/PM)
    const timeMatch = timeLine?.match(/^\d{2}:\d{2}:\d{2}\s*(AM|PM)$/i)
    if (!timeMatch) {
      continue
    }

    const [, day, month, year] = dateMatch
    const date = `${year}-${month}-${day}`

    // Parse amount - remove currency symbol and handle negative amounts
    // Format: ₡7,379.25 or ₡- 432,500.00
    const amountStr = amountLine
      .replace(/₡/g, "")
      .replace(/\s+/g, "")
      .replace(/,/g, "")
    const amount = parseFloat(amountStr)

    // Parse balance
    const balanceStr = balanceLine
      .replace(/₡/g, "")
      .replace(/\s+/g, "")
      .replace(/,/g, "")
    const balance = parseFloat(balanceStr)

    let status: ParsedTransactionStatus = "valid"
    let statusMessage: string | undefined

    if (isNaN(amount)) {
      status = "error"
      statusMessage = "Invalid amount format"
    } else if (!descriptionLine || descriptionLine.length < 2) {
      status = "warning"
      statusMessage = "Description may be incomplete"
    }

    transactions.push({
      id: crypto.randomUUID(),
      date,
      description: descriptionLine || "",
      amount,
      currency: "CRC",
      balance: isNaN(balance) ? null : balance,
      status,
      statusMessage,
    })
  }

  return transactions
}

function parseBAC(text: string): ParsedTransaction[] {
  const lines = text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0)
  const transactions: ParsedTransaction[] = []

  for (const line of lines) {
    // Split by tabs
    const columns = line.split("\t")
    if (columns.length < 6) continue

    const [datePart, , description, debitStr, creditStr, balanceStr] = columns

    // Validate date format (dd/mm/yyyy)
    const dateMatch = datePart?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!dateMatch) continue

    const [, day, month, year] = dateMatch
    const date = `${year}-${month}-${day}`

    // Parse debit and credit - remove commas
    const debit = parseFloat(debitStr?.replace(/,/g, "") || "0")
    const credit = parseFloat(creditStr?.replace(/,/g, "") || "0")
    const balance = parseFloat(balanceStr?.replace(/,/g, "") || "0")

    // Determine amount: debit is negative (expense), credit is positive (income)
    let amount = 0
    if (debit > 0) {
      amount = -debit
    } else if (credit > 0) {
      amount = credit
    }

    let status: ParsedTransactionStatus = "valid"
    let statusMessage: string | undefined

    if (debit === 0 && credit === 0) {
      status = "warning"
      statusMessage = "No amount detected"
    } else if (!description || description.length < 2) {
      status = "warning"
      statusMessage = "Description may be incomplete"
    }

    transactions.push({
      id: crypto.randomUUID(),
      date,
      description: description || "",
      amount,
      currency: "CRC",
      balance: isNaN(balance) ? null : balance,
      status,
      statusMessage,
    })
  }

  return transactions
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: currency === "CRC" ? 0 : 2,
  }).format(amount)
}

export function ImportTransactionsModal() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [bankFormat, setBankFormat] = React.useState<BankFormat>("grupo-mutual")
  const [rawText, setRawText] = React.useState("")
  const [parsedTransactions, setParsedTransactions] = React.useState<ParsedTransaction[]>([])
  const [isProcessing, setIsProcessing] = React.useState(false)

  const summary: ParseSummary = React.useMemo(() => {
    const valid = parsedTransactions.filter((t) => t.status === "valid").length
    const warnings = parsedTransactions.filter((t) => t.status === "warning").length
    const errors = parsedTransactions.filter((t) => t.status === "error").length
    return {
      total: parsedTransactions.length,
      valid,
      warnings,
      errors,
    }
  }, [parsedTransactions])

  const handleProcess = () => {
    setIsProcessing(true)
    
    // Simulate processing delay for better UX
    setTimeout(() => {
      const transactions =
        bankFormat === "grupo-mutual" ? parseGrupoMutual(rawText) : parseBAC(rawText)
      setParsedTransactions(transactions)
      setIsProcessing(false)
    }, 300)
  }

  const handleClear = () => {
    setRawText("")
    setParsedTransactions([])
  }

  const handleImport = () => {
    const validTransactions = parsedTransactions.filter((t) => t.status !== "error")
    // TODO: Implement actual import logic via API
    console.log("Importing transactions:", validTransactions)
    handleClose()
  }

  const handleClose = () => {
    setRawText("")
    setParsedTransactions([])
    setBankFormat("grupo-mutual")
    setIsOpen(false)
  }

  const validCount = summary.valid + summary.warnings

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        handleClose()
        return
      }
      setIsOpen(open)
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[1100px] h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Transactions</DialogTitle>
          <DialogDescription>
            Paste transactions copied from your bank statement and preview them before importing.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 gap-6 overflow-hidden py-4">
          {/* Left Panel - Import Settings */}
          <div className="w-[35%] flex flex-col gap-4">
            {/* Bank Selector */}
            <div className="space-y-2">
              <Label htmlFor="bank-format">Bank Format</Label>
              <Select
                value={bankFormat}
                onValueChange={(value) => setBankFormat(value as BankFormat)}
              >
                <SelectTrigger id="bank-format" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grupo-mutual">Grupo Mutual</SelectItem>
                  <SelectItem value="bac">BAC Credomatic</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select the bank format used to interpret the pasted transactions.
              </p>
            </div>

            {/* Paste Area */}
            <div className="flex-1 flex flex-col gap-2">
              <Label htmlFor="paste-area">Paste Transactions</Label>
              <Textarea
                id="paste-area"
                placeholder="Paste the transactions copied from your bank statement here."
                className="flex-1 min-h-[300px] font-mono text-xs resize-none"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={handleProcess}
                disabled={!rawText.trim() || isProcessing}
                className="flex-1"
              >
                {isProcessing ? "Processing..." : "Process Transactions"}
              </Button>
              <Button
                variant="outline"
                onClick={handleClear}
                disabled={!rawText && parsedTransactions.length === 0}
              >
                Clear
              </Button>
            </div>
          </div>

          {/* Right Panel - Transaction Preview */}
          <div className="w-[65%] flex flex-col gap-4 border-l pl-6">
            <div className="space-y-2">
              <h3 className="font-semibold">Transaction Preview</h3>
              <p className="text-xs text-muted-foreground">
                Review the parsed transactions before importing.
              </p>
            </div>

            {/* Summary Badges */}
            {parsedTransactions.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary">
                  Total: {summary.total}
                </Badge>
                <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Valid: {summary.valid}
                </Badge>
                {summary.warnings > 0 && (
                  <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Warnings: {summary.warnings}
                  </Badge>
                )}
                {summary.errors > 0 && (
                  <Badge variant="secondary" className="bg-error/10 text-error border-error/20">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Errors: {summary.errors}
                  </Badge>
                )}
              </div>
            )}

            {/* Preview Table */}
            <ScrollArea className="flex-1 border rounded-md">
              {parsedTransactions.length === 0 ? (
                <div className="flex items-center justify-center h-full min-h-[300px] text-muted-foreground text-sm">
                  No transactions parsed yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedTransactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-mono text-xs">
                          {transaction.date}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={transaction.description}>
                          {transaction.description}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono ${
                            transaction.amount < 0 ? "text-error" : "text-success"
                          }`}
                        >
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </TableCell>
                        <TableCell>{transaction.currency}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {transaction.balance !== null
                            ? formatCurrency(transaction.balance, transaction.currency)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {transaction.status === "valid" && (
                            <Badge variant="secondary" className="text-xs">
                              Valid
                            </Badge>
                          )}
                          {transaction.status === "warning" && (
                            <Badge
                              variant="outline"
                              className="text-xs border-warning text-warning"
                              title={transaction.statusMessage}
                            >
                              Warning
                            </Badge>
                          )}
                          {transaction.status === "error" && (
                            <Badge
                              variant="destructive"
                              className="text-xs"
                              title={transaction.statusMessage}
                            >
                              Error
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <div className="flex w-full items-center justify-between">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <div className="flex flex-col items-end gap-1">
              <Button
                onClick={handleImport}
                disabled={validCount === 0}
              >
                Import Valid Transactions
              </Button>
              <p className="text-xs text-muted-foreground">
                Only valid rows will be imported.
              </p>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
