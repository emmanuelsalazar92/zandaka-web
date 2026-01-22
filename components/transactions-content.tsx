"use client"

import {
  Plus,
  Trash2,
  AlertCircle,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react"
import * as React from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
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

// Mock data - expanded for pagination demo
const mockTransactions = [
  {
    id: 1,
    date: "2026-01-15",
    type: "EXPENSE",
    description: "Supermarket groceries",
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
    date: "2026-01-15",
    type: "INCOME",
    description: "Monthly Salary ENCORA",
    lines: [
      {
        accountId: 1,
        account: "Main Checking",
        envelopeId: 2,
        envelope: "Salary",
        amount: 2227000,
      },
    ],
  },
  {
    id: 3,
    date: "2026-01-14",
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
  {
    id: 4,
    date: "2026-01-13",
    type: "EXPENSE",
    description: "Netflix subscription",
    lines: [
      {
        accountId: 2,
        account: "Credit Card",
        envelopeId: 9,
        envelope: "Entertainment",
        amount: -7650,
      },
    ],
  },
  {
    id: 5,
    date: "2026-01-12",
    type: "EXPENSE",
    description: "Electricity bill",
    lines: [
      {
        accountId: 1,
        account: "Main Checking",
        envelopeId: 6,
        envelope: "Utilities",
        amount: -35000,
      },
    ],
  },
  {
    id: 6,
    date: "2026-01-11",
    type: "EXPENSE",
    description: "Gas station",
    lines: [
      {
        accountId: 2,
        account: "Credit Card",
        envelopeId: 7,
        envelope: "Transportation",
        amount: -25000,
      },
    ],
  },
  {
    id: 7,
    date: "2026-01-10",
    type: "EXPENSE",
    description: "Restaurant dinner",
    lines: [
      {
        accountId: 2,
        account: "Credit Card",
        envelopeId: 10,
        envelope: "Dining Out",
        amount: -18500,
      },
    ],
  },
  {
    id: 8,
    date: "2026-01-09",
    type: "ADJUSTMENT",
    description: "Bank fee correction",
    lines: [
      {
        accountId: 1,
        account: "Main Checking",
        envelopeId: 6,
        envelope: "Utilities",
        amount: -1500,
      },
    ],
  },
  {
    id: 9,
    date: "2026-01-08",
    type: "EXPENSE",
    description: "Spotify premium",
    lines: [
      {
        accountId: 2,
        account: "Credit Card",
        envelopeId: 9,
        envelope: "Entertainment",
        amount: -3800,
      },
    ],
  },
  {
    id: 10,
    date: "2026-01-07",
    type: "EXPENSE",
    description: "Phone bill",
    lines: [
      {
        accountId: 1,
        account: "Main Checking",
        envelopeId: 6,
        envelope: "Utilities",
        amount: -8100,
      },
    ],
  },
  {
    id: 11,
    date: "2026-01-06",
    type: "EXPENSE",
    description: "Weekly groceries",
    lines: [
      {
        accountId: 1,
        account: "Main Checking",
        envelopeId: 5,
        envelope: "Groceries",
        amount: -52000,
      },
    ],
  },
  {
    id: 12,
    date: "2026-01-05",
    type: "TRANSFER",
    description: "Investment contribution",
    lines: [
      {
        accountId: 1,
        account: "Main Checking",
        envelopeId: 13,
        envelope: "Investments",
        amount: -150000,
      },
      { accountId: 3, account: "Savings", envelopeId: 13, envelope: "Investments", amount: 150000 },
    ],
  },
  {
    id: 13,
    date: "2026-01-04",
    type: "EXPENSE",
    description: "ChatGPT Plus subscription",
    lines: [
      {
        accountId: 2,
        account: "Credit Card",
        envelopeId: 9,
        envelope: "Entertainment",
        amount: -11750,
      },
    ],
  },
  {
    id: 14,
    date: "2026-01-03",
    type: "EXPENSE",
    description: "Uber ride",
    lines: [
      {
        accountId: 2,
        account: "Credit Card",
        envelopeId: 7,
        envelope: "Transportation",
        amount: -4500,
      },
    ],
  },
  {
    id: 15,
    date: "2026-01-02",
    type: "INCOME",
    description: "Freelance payment",
    lines: [
      { accountId: 1, account: "Main Checking", envelopeId: 2, envelope: "Salary", amount: 85000 },
    ],
  },
  {
    id: 16,
    date: "2026-01-01",
    type: "EXPENSE",
    description: "New Year dinner",
    lines: [
      {
        accountId: 2,
        account: "Credit Card",
        envelopeId: 10,
        envelope: "Dining Out",
        amount: -45000,
      },
    ],
  },
  {
    id: 17,
    date: "2025-12-31",
    type: "EXPENSE",
    description: "HBO Max subscription",
    lines: [
      {
        accountId: 2,
        account: "Credit Card",
        envelopeId: 9,
        envelope: "Entertainment",
        amount: -3000,
      },
    ],
  },
  {
    id: 18,
    date: "2025-12-30",
    type: "EXPENSE",
    description: "Pharmacy",
    lines: [
      {
        accountId: 1,
        account: "Main Checking",
        envelopeId: 6,
        envelope: "Utilities",
        amount: -12000,
      },
    ],
  },
  {
    id: 19,
    date: "2025-12-29",
    type: "EXPENSE",
    description: "Internet bill",
    lines: [
      {
        accountId: 1,
        account: "Main Checking",
        envelopeId: 6,
        envelope: "Utilities",
        amount: -15000,
      },
    ],
  },
  {
    id: 20,
    date: "2025-12-28",
    type: "TRANSFER",
    description: "Pension fund contribution",
    lines: [
      {
        accountId: 1,
        account: "Main Checking",
        envelopeId: 13,
        envelope: "Investments",
        amount: -111350,
      },
      { accountId: 3, account: "Savings", envelopeId: 13, envelope: "Investments", amount: 111350 },
    ],
  },
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

// All unique envelopes for filter
const allEnvelopes = [
  { id: 2, name: "Salary" },
  { id: 5, name: "Groceries" },
  { id: 6, name: "Utilities" },
  { id: 7, name: "Transportation" },
  { id: 9, name: "Entertainment" },
  { id: 10, name: "Dining Out" },
  { id: 12, name: "Emergency Fund" },
  { id: 13, name: "Investments" },
]

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100]

export function TransactionsContent() {
  const [transactions, setTransactions] = React.useState(mockTransactions)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isFiltersOpen, setIsFiltersOpen] = React.useState(false)
  const [accounts, setAccounts] = React.useState<
    { id: number; name: string; currency: string; active: boolean }[]
  >([])
  const [accountsLoading, setAccountsLoading] = React.useState(false)
  const [accountsError, setAccountsError] = React.useState<string | null>(null)
  const [formData, setFormData] = React.useState({
    date: new Date().toISOString().split("T")[0],
    type: "EXPENSE",
    description: "",
    lines: [{ accountId: "", envelopeId: "", amount: "" }] as TransactionLine[],
  })

  // Filter state - draft (UI) and applied (actual filter)
  const defaultFilters = {
    dateFrom: "",
    dateTo: "",
    keyword: "",
    type: "ALL",
    accountId: "ALL",
    envelopeId: "ALL",
    amountMin: "",
    amountMax: "",
  }
  const [draftFilters, setDraftFilters] = React.useState(defaultFilters)
  const [filters, setFilters] = React.useState(defaultFilters)

  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1)
  const [itemsPerPage, setItemsPerPage] = React.useState(10)

  const activeAccounts = React.useMemo(
    () => accounts.filter((account) => account.active),
    [accounts],
  )

  React.useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setAccountsLoading(true)
        setAccountsError(null)
        const res = await fetch("http://localhost:3000/api/accounts", {
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
        setAccountsError(message)
      } finally {
        setAccountsLoading(false)
      }
    }

    fetchAccounts()
  }, [])

  React.useEffect(() => {
    setFormData((prev) => {
      const nextLines = prev.lines.map((line) => {
        const isValid = activeAccounts.some((account) => account.id.toString() === line.accountId)
        if (isValid) return line
        return { ...line, accountId: "" }
      })
      const hasChanges = nextLines.some(
        (line, index) => line.accountId !== prev.lines[index]?.accountId,
      )
      if (!hasChanges) return prev
      return { ...prev, lines: nextLines }
    })
  }, [activeAccounts])

  // Filter transactions
  const filteredTransactions = React.useMemo(() => {
    return transactions.filter((transaction) => {
      // Date range filter
      if (filters.dateFrom && transaction.date < filters.dateFrom) return false
      if (filters.dateTo && transaction.date > filters.dateTo) return false

      // Keyword filter (description)
      if (
        filters.keyword &&
        !transaction.description.toLowerCase().includes(filters.keyword.toLowerCase())
      ) {
        return false
      }

      // Type filter
      if (filters.type !== "ALL" && transaction.type !== filters.type) return false

      // Account filter
      if (filters.accountId !== "ALL") {
        const hasAccount = transaction.lines.some(
          (line) => line.accountId === Number.parseInt(filters.accountId),
        )
        if (!hasAccount) return false
      }

      // Envelope filter
      if (filters.envelopeId !== "ALL") {
        const hasEnvelope = transaction.lines.some(
          (line) => line.envelopeId === Number.parseInt(filters.envelopeId),
        )
        if (!hasEnvelope) return false
      }

      // Amount range filter (checks if any line amount falls within range)
      if (filters.amountMin || filters.amountMax) {
        const minAmount = filters.amountMin ? Number.parseFloat(filters.amountMin) : -Infinity
        const maxAmount = filters.amountMax ? Number.parseFloat(filters.amountMax) : Infinity
        const hasAmountInRange = transaction.lines.some((line) => {
          const absAmount = Math.abs(line.amount)
          return absAmount >= minAmount && absAmount <= maxAmount
        })
        if (!hasAmountInRange) return false
      }

      return true
    })
  }, [transactions, filters])

  // Pagination calculations
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1)
  }, [filters, itemsPerPage])

  // Count active filters
  const activeFilterCount = React.useMemo(() => {
    let count = 0
    if (filters.dateFrom) count++
    if (filters.dateTo) count++
    if (filters.keyword) count++
    if (filters.type !== "ALL") count++
    if (filters.accountId !== "ALL") count++
    if (filters.envelopeId !== "ALL") count++
    if (filters.amountMin) count++
    if (filters.amountMax) count++
    return count
  }, [filters])

  const applyFilters = () => {
    setFilters({ ...draftFilters })
  }

  const clearFilters = () => {
    setDraftFilters(defaultFilters)
    setFilters(defaultFilters)
  }

  // Handle Enter key to apply filters
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      applyFilters()
    }
  }

  const handleAddLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { accountId: "", envelopeId: "", amount: "" }],
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

  const resetCreateForm = React.useCallback(() => {
    setFormData({
      date: new Date().toISOString().split("T")[0],
      type: "EXPENSE",
      description: "",
      lines: [{ accountId: "", envelopeId: "", amount: "" }],
    })
  }, [])

  const handleCreate = () => {
    if (!isFormValid) return

    const newTransaction = {
      id: Math.max(...transactions.map((t) => t.id)) + 1,
      date: formData.date,
      type: formData.type,
      description: formData.description,
      lines: formData.lines.map((line) => ({
        accountId: Number.parseInt(line.accountId),
        account: accounts.find((a) => a.id === Number.parseInt(line.accountId))?.name || "",
        envelopeId: Number.parseInt(line.envelopeId),
        envelope:
          mockEnvelopes[Number.parseInt(line.accountId)]?.find(
            (e) => e.id === Number.parseInt(line.envelopeId),
          )?.name || "",
        amount: Number.parseFloat(line.amount),
      })),
    }
    setTransactions([...transactions, newTransaction])
    resetCreateForm()
    setIsCreateOpen(false)
  }

  const handleCloseCreate = () => {
    resetCreateForm()
    setIsCreateOpen(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Transactions</h2>
          <p className="text-muted-foreground">Record income, expenses, and transfers</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className="relative"
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge className="ml-2 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          <Dialog
            open={isCreateOpen}
            onOpenChange={(open) => {
              if (!open) {
                handleCloseCreate()
                return
              }
              setIsCreateOpen(open)
            }}
          >
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
                          disabled={accountsLoading || activeAccounts.length === 0}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue
                              placeholder={
                                accountsLoading
                                  ? "Loading accounts..."
                                  : activeAccounts.length === 0
                                    ? "No active accounts"
                                    : "Select Account"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {activeAccounts.map((acc) => (
                              <SelectItem key={acc.id} value={acc.id.toString()}>
                                {acc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {accountsError && (
                          <p className="text-xs text-error mt-1">{accountsError}</p>
                        )}
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
                        className={cn(
                          getTransactionLineSum() === 0 ? "text-success" : "text-error",
                        )}
                      >
                        {getTransactionLineSum().toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseCreate}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!isFormValid}>
                  Create Transaction
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters Panel */}
      <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
        <CollapsibleContent>
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Filters</CardTitle>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
                    <X className="mr-1 h-3 w-3" />
                    Clear all
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4" onKeyDown={handleKeyDown}>
              {/* Row 1: Date Range and Keyword */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Date From</Label>
                  <Input
                    type="date"
                    value={draftFilters.dateFrom}
                    onChange={(e) => setDraftFilters({ ...draftFilters, dateFrom: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Date To</Label>
                  <Input
                    type="date"
                    value={draftFilters.dateTo}
                    onChange={(e) => setDraftFilters({ ...draftFilters, dateTo: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Keyword (description)</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by description..."
                      value={draftFilters.keyword}
                      onChange={(e) =>
                        setDraftFilters({ ...draftFilters, keyword: e.target.value })
                      }
                      className="h-9 pl-8"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Type, Account, Envelope */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <Select
                    value={draftFilters.type}
                    onValueChange={(value) => setDraftFilters({ ...draftFilters, type: value })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Types</SelectItem>
                      <SelectItem value="INCOME">Income</SelectItem>
                      <SelectItem value="EXPENSE">Expense</SelectItem>
                      <SelectItem value="TRANSFER">Transfer</SelectItem>
                      <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Account</Label>
                  <Select
                    value={draftFilters.accountId}
                    onValueChange={(value) =>
                      setDraftFilters({ ...draftFilters, accountId: value })
                    }
                    disabled={accountsLoading || activeAccounts.length === 0}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue
                        placeholder={
                          accountsLoading
                            ? "Loading accounts..."
                            : activeAccounts.length === 0
                              ? "No active accounts"
                              : "Select account"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Accounts</SelectItem>
                      {activeAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id.toString()}>
                          {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {accountsError && <p className="text-xs text-error mt-1">{accountsError}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Envelope</Label>
                  <Select
                    value={draftFilters.envelopeId}
                    onValueChange={(value) =>
                      setDraftFilters({ ...draftFilters, envelopeId: value })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Envelopes</SelectItem>
                      {allEnvelopes.map((env) => (
                        <SelectItem key={env.id} value={env.id.toString()}>
                          {env.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 3: Amount Range */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Amount Min</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={draftFilters.amountMin}
                    onChange={(e) =>
                      setDraftFilters({ ...draftFilters, amountMin: e.target.value })
                    }
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Amount Max</Label>
                  <Input
                    type="number"
                    placeholder="999999"
                    value={draftFilters.amountMax}
                    onChange={(e) =>
                      setDraftFilters({ ...draftFilters, amountMax: e.target.value })
                    }
                    className="h-9"
                  />
                </div>
                <div className="flex items-end md:col-span-2">
                  <Button onClick={applyFilters} className="h-9">
                    <Search className="mr-2 h-4 w-4" />
                    Search
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>
                {filteredTransactions.length === transactions.length
                  ? `${transactions.length} transaction(s)`
                  : `${filteredTransactions.length} of ${transactions.length} transaction(s)`}
              </CardDescription>
            </div>
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-1">
                {filters.dateFrom && (
                  <Badge variant="secondary" className="text-xs">
                    From: {filters.dateFrom}
                  </Badge>
                )}
                {filters.dateTo && (
                  <Badge variant="secondary" className="text-xs">
                    To: {filters.dateTo}
                  </Badge>
                )}
                {filters.keyword && (
                  <Badge variant="secondary" className="text-xs">
                    &quot;{filters.keyword}&quot;
                  </Badge>
                )}
                {filters.type !== "ALL" && (
                  <Badge variant="secondary" className="text-xs">
                    {filters.type}
                  </Badge>
                )}
                {filters.accountId !== "ALL" && (
                  <Badge variant="secondary" className="text-xs">
                    {accounts.find((a) => a.id.toString() === filters.accountId)?.name}
                  </Badge>
                )}
                {filters.envelopeId !== "ALL" && (
                  <Badge variant="secondary" className="text-xs">
                    {allEnvelopes.find((e) => e.id.toString() === filters.envelopeId)?.name}
                  </Badge>
                )}
              </div>
            )}
          </div>
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
              {paginatedTransactions.map((transaction) =>
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

          {/* Pagination */}
          {filteredTransactions.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Show</span>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => setItemsPerPage(Number.parseInt(value))}
                >
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option.toString()}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>per page</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {startIndex + 1}-{Math.min(endIndex, filteredTransactions.length)} of{" "}
                  {filteredTransactions.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <ChevronLeft className="h-4 w-4 -ml-2" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-2 text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                    <ChevronRight className="h-4 w-4 -ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {filteredTransactions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No transactions found matching your filters</p>
              {activeFilterCount > 0 && (
                <Button variant="link" onClick={clearFilters} className="mt-2">
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
