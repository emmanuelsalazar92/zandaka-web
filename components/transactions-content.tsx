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

type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT"

interface ApiTransactionLine {
  account_id?: number
  envelope_id?: number
  amount: number
  accountId?: number
  envelopeId?: number
  accountName?: string
  account_name?: string
  categoryName?: string
  category_name?: string
}

interface ApiTransaction {
  id: number
  user_id?: number
  userId?: number
  date: string
  description: string
  type: TransactionType
  created_at?: string
  createdAt?: string
  lines: ApiTransactionLine[]
}

interface PaginationMeta {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100]
const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "")
const API_BASE_URL = `${API_ROOT}/api`

export function TransactionsContent() {
  const [transactionsData, setTransactionsData] = React.useState<ApiTransaction[]>([])
  const [transactionsLoading, setTransactionsLoading] = React.useState(false)
  const [transactionsError, setTransactionsError] = React.useState<string | null>(null)
  const [transactionsMeta, setTransactionsMeta] = React.useState<PaginationMeta>({
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  })
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [createLoading, setCreateLoading] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [isFiltersOpen, setIsFiltersOpen] = React.useState(false)
  const [accounts, setAccounts] = React.useState<
    { id: number; name: string; currency: string; active: boolean }[]
  >([])
  const [accountsLoading, setAccountsLoading] = React.useState(false)
  const [accountsError, setAccountsError] = React.useState<string | null>(null)
  const [envelopesByAccount, setEnvelopesByAccount] = React.useState<
    Record<string, { id: number; name: string; categoryId: number }[]>
  >({})
  const [envelopesLoading, setEnvelopesLoading] = React.useState<Record<string, boolean>>({})
  const [envelopesError, setEnvelopesError] = React.useState<Record<string, string | null>>({})
  const [formData, setFormData] = React.useState({
    date: new Date().toISOString().split("T")[0],
    type: "EXPENSE" as TransactionType,
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
  const userId = 1

  const activeAccounts = React.useMemo(
    () => accounts.filter((account) => account.active),
    [accounts],
  )

  const transactions = React.useMemo(() => {
    return transactionsData.map((transaction) => {
      const lines = transaction.lines.map((line) => {
        const accountId = line.account_id ?? line.accountId ?? 0
        const envelopeId = line.envelope_id ?? line.envelopeId ?? 0
        const accountName =
          line.account_name ??
          line.accountName ??
          accounts.find((account) => account.id === accountId)?.name ??
          (accountId ? `Account ${accountId}` : "Unknown account")
        const envelopeName =
          line.category_name ??
          line.categoryName ??
          envelopesByAccount[accountId.toString()]?.find((env) => env.id === envelopeId)?.name ??
          (envelopeId ? `Envelope ${envelopeId}` : "Unknown envelope")

        return {
          accountId,
          account: accountName,
          envelopeId,
          envelope: envelopeName,
          amount: line.amount,
        }
      })

      return {
        id: transaction.id,
        date: transaction.date,
        type: transaction.type,
        description: transaction.description,
        lines,
      }
    })
  }, [transactionsData, accounts, envelopesByAccount])

  React.useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setAccountsLoading(true)
        setAccountsError(null)
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
        setAccountsError(message)
      } finally {
        setAccountsLoading(false)
      }
    }

    fetchAccounts()
  }, [])

  const fetchEnvelopes = React.useCallback(
    async (accountId: string) => {
      if (!accountId || accountId === "ALL") return
      if (envelopesByAccount[accountId] || envelopesLoading[accountId]) return

      setEnvelopesLoading((prev) => ({ ...prev, [accountId]: true }))
      setEnvelopesError((prev) => ({ ...prev, [accountId]: null }))
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
        setEnvelopesError((prev) => ({ ...prev, [accountId]: message }))
      } finally {
        setEnvelopesLoading((prev) => ({ ...prev, [accountId]: false }))
      }
    },
    [envelopesByAccount, envelopesLoading],
  )

  React.useEffect(() => {
    setFormData((prev) => {
      const nextLines = prev.lines.map((line) => {
        const isValid = activeAccounts.some((account) => account.id.toString() === line.accountId)
        if (isValid) return line
        return { ...line, accountId: "", envelopeId: "" }
      })
      const hasChanges = nextLines.some(
        (line, index) => line.accountId !== prev.lines[index]?.accountId,
      )
      if (!hasChanges) return prev
      return { ...prev, lines: nextLines }
    })
  }, [activeAccounts])

  React.useEffect(() => {
    const accountIds = new Set(
      formData.lines.map((line) => line.accountId).filter((accountId) => accountId),
    )
    accountIds.forEach((accountId) => {
      void fetchEnvelopes(accountId)
    })
  }, [formData.lines, fetchEnvelopes])

  React.useEffect(() => {
    if (draftFilters.accountId && draftFilters.accountId !== "ALL") {
      void fetchEnvelopes(draftFilters.accountId)
    }
  }, [draftFilters.accountId, fetchEnvelopes])

  React.useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setTransactionsLoading(true)
        setTransactionsError(null)

        // Build query params to mirror the Transactions UI filters.
        const params = new URLSearchParams()
        params.set("userId", userId.toString())
        if (filters.dateFrom) params.set("from", filters.dateFrom)
        if (filters.dateTo) params.set("to", filters.dateTo)
        if (filters.type !== "ALL") params.set("type", filters.type)
        if (filters.accountId !== "ALL") params.set("accountId", filters.accountId)
        if (filters.envelopeId !== "ALL") params.set("categoryId", filters.envelopeId)
        if (filters.keyword) params.set("q", filters.keyword)
        if (filters.amountMin) params.set("amountMin", filters.amountMin)
        if (filters.amountMax) params.set("amountMax", filters.amountMax)
        params.set("page", currentPage.toString())
        params.set("pageSize", itemsPerPage.toString())
        params.set("sortBy", "date")
        params.set("sortDir", "desc")

        const res = await fetch(`${API_BASE_URL}/transactions?${params.toString()}`, {
          headers: { Accept: "application/json" },
        })
        if (!res.ok) throw new Error("Failed to load transactions")
        const data = (await res.json()) as { data: ApiTransaction[]; meta: PaginationMeta }

        setTransactionsData(data.data)
        setTransactionsMeta(data.meta)
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load transactions"
        setTransactionsError(message)
      } finally {
        setTransactionsLoading(false)
      }
    }

    void fetchTransactions()
  }, [filters, currentPage, itemsPerPage, userId])

  // Pagination calculations
  const totalPages = Math.max(transactionsMeta.totalPages || 0, 1)
  const startIndex = transactionsMeta.totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const endIndex =
    transactionsMeta.totalItems === 0
      ? 0
      : Math.min(startIndex + transactions.length - 1, transactionsMeta.totalItems)

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
    setCurrentPage(1)
  }

  const clearFilters = () => {
    setDraftFilters(defaultFilters)
    setFilters(defaultFilters)
    setCurrentPage(1)
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
    if (field === "accountId") {
      newLines[index] = { ...newLines[index], accountId: value, envelopeId: "" }
    } else {
      newLines[index] = { ...newLines[index], [field]: value }
    }
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

  const handleCreate = async () => {
    if (!isFormValid) return

    setCreateLoading(true)
    setCreateError(null)
    try {
      const payload = {
        userId,
        date: formData.date,
        type: formData.type,
        description: formData.description,
        lines: formData.lines.map((line) => ({
          accountId: Number.parseInt(line.accountId),
          envelopeId: Number.parseInt(line.envelopeId),
          amount: Number.parseFloat(line.amount),
        })),
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
      const data = (await res.json()) as {
        transaction: ApiTransaction
        lines: ApiTransactionLine[]
      }
      const created: ApiTransaction = {
        ...data.transaction,
        lines: data.lines,
      }
      setTransactionsData((prev) => [created, ...prev])
      setTransactionsMeta((prev) => {
        const totalItems = prev.totalItems + 1
        return {
          ...prev,
          totalItems,
          totalPages: Math.max(1, Math.ceil(totalItems / itemsPerPage)),
        }
      })
      resetCreateForm()
      setIsCreateOpen(false)
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create transaction"
      setCreateError(message)
    } finally {
      setCreateLoading(false)
    }
  }

  const handleCloseCreate = () => {
    resetCreateForm()
    setCreateError(null)
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
              setCreateError(null)
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
                {createError && (
                  <Alert className="border-error/50 bg-error/5">
                    <AlertCircle className="h-4 w-4 text-error" />
                    <AlertDescription className="text-sm">{createError}</AlertDescription>
                  </Alert>
                )}
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
                      onValueChange={(value) =>
                        setFormData({ ...formData, type: value as TransactionType })
                      }
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
                          disabled={!line.accountId || envelopesLoading[line.accountId]}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue
                              placeholder={
                                !line.accountId
                                  ? "Select account first"
                                  : envelopesLoading[line.accountId]
                                    ? "Loading envelopes..."
                                    : "Select envelope"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {(envelopesByAccount[line.accountId] || []).map((env) => (
                              <SelectItem key={env.id} value={env.id.toString()}>
                                {env.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {line.accountId && envelopesError[line.accountId] && (
                          <p className="text-xs text-error mt-1">
                            {envelopesError[line.accountId]}
                          </p>
                        )}
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
                <Button onClick={handleCreate} disabled={!isFormValid || createLoading}>
                  {createLoading ? "Creating..." : "Create Transaction"}
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
                      setDraftFilters({ ...draftFilters, accountId: value, envelopeId: "ALL" })
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
                    disabled={
                      draftFilters.accountId === "ALL" ||
                      draftFilters.accountId === "" ||
                      envelopesLoading[draftFilters.accountId]
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue
                        placeholder={
                          draftFilters.accountId === "ALL" || draftFilters.accountId === ""
                            ? "Select account first"
                            : envelopesLoading[draftFilters.accountId]
                              ? "Loading envelopes..."
                              : "Select envelope"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Envelopes</SelectItem>
                      {(envelopesByAccount[draftFilters.accountId] || []).map((env) => (
                        <SelectItem key={env.categoryId} value={env.categoryId.toString()}>
                          {env.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {draftFilters.accountId !== "ALL" && envelopesError[draftFilters.accountId] && (
                    <p className="text-xs text-error mt-1">
                      {envelopesError[draftFilters.accountId]}
                    </p>
                  )}
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
                {transactionsMeta.totalItems === transactions.length
                  ? `${transactionsMeta.totalItems} transaction(s)`
                  : `${transactions.length} of ${transactionsMeta.totalItems} transaction(s)`}
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
                    {envelopesByAccount[filters.accountId]?.find(
                      (env) => env.categoryId.toString() === filters.envelopeId,
                    )?.name || filters.envelopeId}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {transactionsError && (
            <Alert className="mb-4 border-error/50 bg-error/5">
              <AlertCircle className="h-4 w-4 text-error" />
              <AlertDescription className="text-sm">{transactionsError}</AlertDescription>
            </Alert>
          )}
          {transactionsLoading && (
            <p className="text-sm text-muted-foreground mb-3">Loading transactions...</p>
          )}
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

          {/* Pagination */}
          {transactionsMeta.totalItems > 0 && (
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
                  {startIndex}-{endIndex} of {transactionsMeta.totalItems}
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
          {transactionsMeta.totalItems === 0 && !transactionsLoading && (
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
