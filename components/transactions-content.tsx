"use client"

import { Plus, Trash2, AlertCircle } from "lucide-react"
import * as React from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
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
import { cn } from "@/lib/utils"

// Mock data
const mockTransactions = [
  {
    id: 1,
    date: "2026-01-02",
    type: "EXPENSE",
    description: "Supermarket",
    lines: [
      {
        accountId: 1,
        account: "Main Checking",
        envelopeId: 5,
        envelope: "Groceries",
        amount: -45000,
      },
    ],
  },
  {
    id: 2,
    date: "2026-01-02",
    type: "INCOME",
    description: "Salary",
    lines: [
      { accountId: 1, account: "Main Checking", envelopeId: 2, envelope: "Salary", amount: 500000 },
    ],
  },
  {
    id: 3,
    date: "2026-01-01",
    type: "TRANSFER",
    description: "Transfer to Savings",
    lines: [
      {
        accountId: 1,
        account: "Main Checking",
        envelopeId: 12,
        envelope: "Emergency Fund",
        amount: -100000,
      },
      {
        accountId: 3,
        account: "Savings",
        envelopeId: 12,
        envelope: "Emergency Fund",
        amount: 100000,
      },
    ],
  },
]

const mockAccounts = [
  { id: 1, name: "Main Checking", currency: "CRC" },
  { id: 2, name: "Credit Card", currency: "USD" },
  { id: 3, name: "Savings", currency: "CRC" },
]

const mockEnvelopes: Record<number, { id: number; name: string }[]> = {
  1: [
    { id: 5, name: "Groceries" },
    { id: 6, name: "Utilities" },
    { id: 7, name: "Transportation" },
    { id: 2, name: "Salary" },
  ],
  2: [
    { id: 9, name: "Entertainment" },
    { id: 10, name: "Dining Out" },
  ],
  3: [
    { id: 12, name: "Emergency Fund" },
    { id: 13, name: "Investments" },
  ],
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: currency === "CRC" ? 0 : 2,
  }).format(amount)
}

interface TransactionLine {
  accountId: string
  envelopeId: string
  amount: string
}

export function TransactionsContent() {
  const [transactions, setTransactions] = React.useState(mockTransactions)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [formData, setFormData] = React.useState({
    date: new Date().toISOString().split("T")[0],
    type: "EXPENSE",
    description: "",
    lines: [{ accountId: "1", envelopeId: "", amount: "" }] as TransactionLine[],
  })

  const handleAddLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { accountId: "1", envelopeId: "", amount: "" }],
    })
  }

  const handleRemoveLine = (index: number) => {
    setFormData({
      ...formData,
      lines: formData.lines.filter((_, i) => i !== index),
    })
  }

  const handleLineChange = (index: number, field: keyof TransactionLine, value: string) => {
    const newLines = [...formData.lines]
    newLines[index] = { ...newLines[index], [field]: value }
    setFormData({ ...formData, lines: newLines })
  }

  const getTransactionLineSum = () => {
    return formData.lines.reduce((sum, line) => sum + (Number.parseFloat(line.amount) || 0), 0)
  }

  const isTransferValid =
    formData.type === "TRANSFER" && formData.lines.length === 2 && getTransactionLineSum() === 0
  const isOtherValid =
    formData.type !== "TRANSFER" &&
    formData.lines.length >= 1 &&
    formData.lines.every((l) => l.accountId && l.envelopeId && l.amount)
  const isFormValid = (isTransferValid || isOtherValid) && formData.description && formData.date

  const handleCreate = () => {
    if (!isFormValid) return

    const newTransaction = {
      id: Math.max(...transactions.map((t) => t.id)) + 1,
      date: formData.date,
      type: formData.type,
      description: formData.description,
      lines: formData.lines.map((line) => ({
        accountId: Number.parseInt(line.accountId),
        account: mockAccounts.find((a) => a.id === Number.parseInt(line.accountId))?.name || "",
        envelopeId: Number.parseInt(line.envelopeId),
        envelope:
          mockEnvelopes[Number.parseInt(line.accountId)]?.find(
            (e) => e.id === Number.parseInt(line.envelopeId),
          )?.name || "",
        amount: Number.parseFloat(line.amount),
      })),
    }
    setTransactions([...transactions, newTransaction])
    setIsCreateOpen(false)
    setFormData({
      date: new Date().toISOString().split("T")[0],
      type: "EXPENSE",
      description: "",
      lines: [{ accountId: "1", envelopeId: "", amount: "" }],
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Transactions</h2>
          <p className="text-muted-foreground">Record income, expenses, and transfers</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Transaction
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Transaction</DialogTitle>
              <DialogDescription>Record a new transaction with ledger lines</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INCOME">Income</SelectItem>
                      <SelectItem value="EXPENSE">Expense</SelectItem>
                      <SelectItem value="TRANSFER">Transfer</SelectItem>
                      <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="e.g., Grocery purchase"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              {/* Lines Editor */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">Transaction Lines</Label>
                  <Button variant="outline" size="sm" onClick={handleAddLine}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Line
                  </Button>
                </div>

                {formData.type === "TRANSFER" && formData.lines.length !== 2 && (
                  <Alert className="border-warning/50 bg-warning/5">
                    <AlertCircle className="h-4 w-4 text-warning" />
                    <AlertDescription className="text-sm">
                      Transfers must have exactly 2 lines that sum to 0
                    </AlertDescription>
                  </Alert>
                )}

                {formData.lines.map((line, index) => (
                  <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Account</Label>
                      <Select
                        value={line.accountId}
                        onValueChange={(value) => handleLineChange(index, "accountId", value)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {mockAccounts.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id.toString()}>
                              {acc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Envelope</Label>
                      <Select
                        value={line.envelopeId}
                        onValueChange={(value) => handleLineChange(index, "envelopeId", value)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select envelope" />
                        </SelectTrigger>
                        <SelectContent>
                          {mockEnvelopes[Number.parseInt(line.accountId)]?.map((env) => (
                            <SelectItem key={env.id} value={env.id.toString()}>
                              {env.name}
                            </SelectItem>
                          )) || []}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Amount</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={line.amount}
                        onChange={(e) => handleLineChange(index, "amount", e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveLine(index)}
                      disabled={formData.lines.length === 1}
                      className="h-9 w-9 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {formData.type === "TRANSFER" && (
                  <div className="text-sm font-medium mt-2">
                    Total:{" "}
                    <span
                      className={cn(getTransactionLineSum() === 0 ? "text-success" : "text-error")}
                    >
                      {getTransactionLineSum().toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!isFormValid}>
                Create Transaction
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>{transactions.length} transaction(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Account/Envelope</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) =>
                transaction.lines.map((line, lineIndex) => (
                  <TableRow key={`${transaction.id}-${lineIndex}`}>
                    <TableCell className="text-sm">{transaction.date}</TableCell>
                    <TableCell className="font-medium">
                      {lineIndex === 0 ? transaction.description : ""}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {transaction.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {line.account} / {line.envelope}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "font-semibold",
                          line.amount > 0 ? "text-success" : "text-error",
                        )}
                      >
                        {line.amount > 0 ? "+" : ""}
                        {formatCurrency(line.amount, "CRC")}
                      </span>
                    </TableCell>
                  </TableRow>
                )),
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
