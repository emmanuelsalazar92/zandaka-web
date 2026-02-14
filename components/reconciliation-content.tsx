"use client"

import { Plus, RefreshCw, Edit2, AlertCircle } from "lucide-react"
import * as React from "react"

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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

// Types
interface Reconciliation {
  id: number
  accountId: number
  accountName: string
  date: string
  calculatedAmount: number
  realAmount: number
  difference: number
  // Status is ALWAYS calculated: difference === 0 ? "BALANCED" : "UNBALANCED"
}

interface Account {
  id: number
  name: string
  calculatedBalance: number
  currency: string
  active: boolean
}

// Mock API functions - simulate backend calls
async function fetchAccounts(): Promise<Account[]> {
  // GET /accounts
  return [
    { id: 1, name: "Main Checking", calculatedBalance: 1250000, currency: "CRC", active: true },
    { id: 2, name: "Credit Card", calculatedBalance: -234000, currency: "CRC", active: true },
    { id: 3, name: "Savings", calculatedBalance: 500000, currency: "CRC", active: false },
  ]
}

async function fetchReconciliations(): Promise<Reconciliation[]> {
  // GET /reconciliations
  return [
    {
      id: 1,
      accountId: 1,
      accountName: "Main Checking",
      date: "2026-01-02",
      calculatedAmount: 1250000,
      realAmount: 1255000,
      difference: 5000, // UNBALANCED - blocks new reconciliation for this account
    },
    {
      id: 2,
      accountId: 2,
      accountName: "Credit Card",
      date: "2026-01-02",
      calculatedAmount: -234000,
      realAmount: -234000,
      difference: 0, // BALANCED
    },
    {
      id: 3,
      accountId: 1,
      accountName: "Main Checking",
      date: "2025-12-15",
      calculatedAmount: 1180000,
      realAmount: 1180000,
      difference: 0, // BALANCED (historical)
    },
  ]
}

async function fetchActiveReconciliation(accountId: number): Promise<Reconciliation | null> {
  // GET /accounts/{accountId}/reconciliations/active
  // Returns the active reconciliation with difference != 0, or null if none
  const allRecons = await fetchReconciliations()
  return allRecons.find((r) => r.accountId === accountId && r.difference !== 0) || null
}

async function createReconciliation(data: {
  accountId: number
  date: string
  realAmount: number
}): Promise<Reconciliation> {
  // POST /reconciliations
  const accounts = await fetchAccounts()
  const account = accounts.find((a) => a.id === data.accountId)
  if (!account) throw new Error("Account not found")

  const calculatedAmount = account.calculatedBalance
  const difference = data.realAmount - calculatedAmount

  return {
    id: Date.now(),
    accountId: data.accountId,
    accountName: account.name,
    date: data.date,
    calculatedAmount,
    realAmount: data.realAmount,
    difference,
  }
}

async function updateReconciliation(
  id: number,
  data: { realAmount: number },
): Promise<Reconciliation> {
  // PATCH /reconciliations/{id}
  const recons = await fetchReconciliations()
  const existing = recons.find((r) => r.id === id)
  if (!existing) throw new Error("Reconciliation not found")

  const difference = data.realAmount - existing.calculatedAmount

  return {
    ...existing,
    realAmount: data.realAmount,
    difference,
  }
}

// Helper: calculate status from difference (never user-editable)
function getStatus(difference: number): "BALANCED" | "UNBALANCED" {
  return difference === 0 ? "BALANCED" : "UNBALANCED"
}

function formatCurrency(amount: number, currency = "CRC") {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: currency === "CRC" ? 0 : 2,
  }).format(amount)
}

export function ReconciliationContent() {
  const [accounts, setAccounts] = React.useState<Account[]>([])
  const [reconciliations, setReconciliations] = React.useState<Reconciliation[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  // Modal state
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingRecon, setEditingRecon] = React.useState<Reconciliation | null>(null)
  const [formData, setFormData] = React.useState({
    accountId: "",
    date: new Date().toISOString().split("T")[0],
    realAmount: "",
  })
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Accounts with active unbalanced reconciliations (blocked from new reconciliation)
  const [blockedAccountIds, setBlockedAccountIds] = React.useState<Set<number>>(new Set())

  // Fetch all data
  const loadData = React.useCallback(async () => {
    try {
      const [accountsData, reconciliationsData] = await Promise.all([
        fetchAccounts(),
        fetchReconciliations(),
      ])

      setAccounts(accountsData)
      setReconciliations(reconciliationsData)

      // Determine which accounts have active unbalanced reconciliations
      const blocked = new Set<number>()
      for (const account of accountsData) {
        const active = await fetchActiveReconciliation(account.id)
        if (active) {
          blocked.add(account.id)
        }
      }
      setBlockedAccountIds(blocked)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  // Refresh data (after create/update)
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadData()
  }

  // Check if we can create a new reconciliation (no active unbalanced for selected account)
  const canCreateForAccount = (accountId: number) => {
    return !blockedAccountIds.has(accountId)
  }

  // Get active unbalanced reconciliation for an account (if any)
  const getActiveUnbalancedForAccount = (accountId: number) => {
    return reconciliations.find((r) => r.accountId === accountId && r.difference !== 0)
  }

  // Available accounts for new reconciliation (only those without active unbalanced)
  const activeAccounts = accounts.filter((acc) => acc.active)
  const availableAccountsForNew = activeAccounts.filter((acc) => canCreateForAccount(acc.id))

  // Check if any account has an active unbalanced reconciliation
  const hasAnyBlockedAccount = blockedAccountIds.size > 0

  // Open dialog for new reconciliation
  const handleOpenNew = () => {
    setEditingRecon(null)
    setFormData({
      accountId: availableAccountsForNew[0]?.id.toString() || "",
      date: new Date().toISOString().split("T")[0],
      realAmount: "",
    })
    setIsDialogOpen(true)
  }

  // Open dialog to edit/resolve existing reconciliation
  const handleOpenEdit = (recon: Reconciliation) => {
    setEditingRecon(recon)
    setFormData({
      accountId: recon.accountId.toString(),
      date: recon.date,
      realAmount: recon.realAmount.toString(),
    })
    setIsDialogOpen(true)
  }

  // Handle form submission
  const handleSubmit = async () => {
    if (!formData.accountId || !formData.realAmount) return

    setIsSubmitting(true)
    try {
      if (editingRecon) {
        // PATCH existing reconciliation
        const updated = await updateReconciliation(editingRecon.id, {
          realAmount: Number.parseFloat(formData.realAmount),
        })
        setReconciliations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      } else {
        // POST new reconciliation
        const created = await createReconciliation({
          accountId: Number.parseInt(formData.accountId),
          date: formData.date,
          realAmount: Number.parseFloat(formData.realAmount),
        })
        setReconciliations((prev) => [created, ...prev])
      }

      setIsDialogOpen(false)
      // IMPORTANT: Refresh data from backend after mutation
      await handleRefresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  // Calculate preview difference in form
  const previewDifference = React.useMemo(() => {
    if (!formData.accountId || !formData.realAmount) return null

    let calculatedAmount: number
    if (editingRecon) {
      calculatedAmount = editingRecon.calculatedAmount
    } else {
      const account = accounts.find((a) => a.id === Number.parseInt(formData.accountId))
      if (!account) return null
      calculatedAmount = account.calculatedBalance
    }

    const realAmount = Number.parseFloat(formData.realAmount)
    return realAmount - calculatedAmount
  }, [formData.accountId, formData.realAmount, accounts, editingRecon])

  // Group reconciliations by account for better visualization
  const reconciliationsByAccount = React.useMemo(() => {
    const grouped: Record<number, Reconciliation[]> = {}
    for (const recon of reconciliations) {
      if (!grouped[recon.accountId]) {
        grouped[recon.accountId] = []
      }
      grouped[recon.accountId].push(recon)
    }
    // Sort each group by date descending
    for (const accountId in grouped) {
      grouped[accountId].sort((a, b) => b.date.localeCompare(a.date))
    }
    return grouped
  }, [reconciliations])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Reconciliation</h2>
            <p className="text-muted-foreground">Compare calculated vs actual account balances</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
              Refresh
            </Button>

            {/* New Reconciliation Button - disabled if all accounts are blocked */}
            {availableAccountsForNew.length === 0 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button disabled>
                      <Plus className="mr-2 h-4 w-4" />
                      New Reconciliation
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p>You must resolve the active reconciliation before creating a new one</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button onClick={handleOpenNew}>
                <Plus className="mr-2 h-4 w-4" />
                New Reconciliation
              </Button>
            )}
          </div>
        </div>

        {/* Alert if there are unbalanced reconciliations */}
        {hasAnyBlockedAccount && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="flex items-start gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-warning">Unresolved Reconciliations</p>
                <p className="text-sm text-muted-foreground">
                  {blockedAccountIds.size} account(s) have active reconciliations with differences.
                  Resolve them before creating new reconciliations for those accounts.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reconciliation History by Account */}
        {accounts.map((account) => {
          const accountRecons = reconciliationsByAccount[account.id] || []
          const activeUnbalanced = getActiveUnbalancedForAccount(account.id)

          return (
            <Card key={account.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{account.name}</CardTitle>
                    <CardDescription>
                      Current calculated balance:{" "}
                      {formatCurrency(account.calculatedBalance, account.currency)}
                    </CardDescription>
                  </div>
                  {activeUnbalanced && (
                    <Badge variant="outline" className="border-warning text-warning">
                      Active Difference
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {accountRecons.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No reconciliations for this account
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Calculated Amount</TableHead>
                        <TableHead className="text-right">Real Amount</TableHead>
                        <TableHead className="text-right">Difference</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[80px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accountRecons.map((recon) => {
                        const status = getStatus(recon.difference)
                        const isUnbalanced = status === "UNBALANCED"

                        return (
                          <TableRow key={recon.id} className={cn(isUnbalanced && "bg-warning/5")}>
                            <TableCell>{recon.date}</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(recon.calculatedAmount)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(recon.realAmount)}
                            </TableCell>
                            <TableCell className="text-right">
                              <span
                                className={cn(
                                  "font-mono font-semibold",
                                  recon.difference === 0
                                    ? "text-success"
                                    : recon.difference > 0
                                      ? "text-success"
                                      : "text-destructive",
                                )}
                              >
                                {recon.difference > 0 ? "+" : ""}
                                {formatCurrency(recon.difference)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={isUnbalanced ? "secondary" : "default"}
                                className={cn(
                                  isUnbalanced
                                    ? "bg-warning/20 text-warning border-warning/30"
                                    : "bg-success/20 text-success border-success/30",
                                )}
                              >
                                {status === "BALANCED" ? "Balanced" : "Unbalanced"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {isUnbalanced && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleOpenEdit(recon)}
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Resolve this reconciliation</TooltipContent>
                                </Tooltip>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )
        })}

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRecon ? "Resolve Reconciliation" : "New Reconciliation"}
              </DialogTitle>
              <DialogDescription>
                {editingRecon
                  ? "Update the real amount to resolve the difference"
                  : "Compare calculated balance with actual bank balance"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Account Selector (disabled when editing) */}
              <div className="space-y-2">
                <Label>Account</Label>
                {editingRecon ? (
                  <div className="rounded-md border px-3 py-2 bg-muted">
                    {editingRecon.accountName}
                  </div>
                ) : (
                  <Select
                    value={formData.accountId}
                    onValueChange={(value) => setFormData({ ...formData, accountId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAccountsForNew.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id.toString()}>
                          {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Date (disabled when editing) */}
              <div className="space-y-2">
                <Label>Date</Label>
                {editingRecon ? (
                  <div className="rounded-md border px-3 py-2 bg-muted">{editingRecon.date}</div>
                ) : (
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                )}
              </div>

              {/* Calculated Amount (read-only) */}
              {(formData.accountId || editingRecon) && (
                <div className="rounded-lg bg-muted p-4 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Calculated Amount
                  </p>
                  <p className="text-xl font-semibold font-mono">
                    {formatCurrency(
                      editingRecon
                        ? editingRecon.calculatedAmount
                        : accounts.find((a) => a.id === Number.parseInt(formData.accountId))
                            ?.calculatedBalance || 0,
                    )}
                  </p>
                </div>
              )}

              {/* Real Amount (editable) */}
              <div className="space-y-2">
                <Label>Real Amount (from bank statement)</Label>
                <Input
                  type="number"
                  placeholder="Enter actual balance"
                  value={formData.realAmount}
                  onChange={(e) => setFormData({ ...formData, realAmount: e.target.value })}
                  className="font-mono"
                />
              </div>

              {/* Difference Preview (calculated) */}
              {previewDifference !== null && (
                <div
                  className={cn(
                    "rounded-lg p-4 space-y-1",
                    previewDifference === 0 ? "bg-success/10" : "bg-warning/10",
                  )}
                >
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Difference (Real - Calculated)
                  </p>
                  <p
                    className={cn(
                      "text-xl font-semibold font-mono",
                      previewDifference === 0
                        ? "text-success"
                        : previewDifference > 0
                          ? "text-success"
                          : "text-destructive",
                    )}
                  >
                    {previewDifference > 0 ? "+" : ""}
                    {formatCurrency(previewDifference)}
                  </p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "mt-2",
                      previewDifference === 0
                        ? "border-success text-success"
                        : "border-warning text-warning",
                    )}
                  >
                    {previewDifference === 0 ? "Will be Balanced" : "Will be Unbalanced"}
                  </Badge>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.accountId || !formData.realAmount || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : editingRecon ? (
                  "Update"
                ) : (
                  "Create"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
