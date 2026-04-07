"use client"

import { format, parse } from "date-fns"
import { ArrowUpRight, CalendarRange, Plus, RefreshCw, Trash2 } from "lucide-react"
import Link from "next/link"
import * as React from "react"

import { BudgetMonthPicker } from "@/components/budgets/budget-month-picker"
import { BudgetStatusBadge } from "@/components/budgets/budget-status-badge"
import { NewBudgetDialog } from "@/components/budgets/new-budget-dialog"
import type { Budget } from "@/components/budgets/types"
import { LoadingSkeleton } from "@/components/loading-skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
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
import { toast } from "@/components/ui/use-toast"
import { BudgetApiError, deleteBudget, fetchBudgets } from "@/lib/budgets-api"
import { formatCurrency } from "@/lib/currency-formatter"

const ALL_FILTER = "all"

const formatBudgetMonth = (month: string) => {
  try {
    return format(parse(month, "yyyy-MM", new Date()), "MMMM yyyy")
  } catch {
    return month
  }
}

export function BudgetsContent() {
  const [budgets, setBudgets] = React.useState<Budget[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [currencyFilter, setCurrencyFilter] = React.useState(ALL_FILTER)
  const [statusFilter, setStatusFilter] = React.useState(ALL_FILTER)
  const [monthFilter, setMonthFilter] = React.useState("")
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<Budget | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const loadBudgets = React.useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const nextBudgets = await fetchBudgets()
      setBudgets(nextBudgets)
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Budgets could not be loaded."
      setError(message)
      setBudgets([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadBudgets()
  }, [loadBudgets])

  const currencies = Array.from(new Set(budgets.map((budget) => budget.currency))).sort()
  const filteredBudgets = budgets
    .filter((budget) => currencyFilter === ALL_FILTER || budget.currency === currencyFilter)
    .filter((budget) => statusFilter === ALL_FILTER || budget.status === statusFilter)
    .filter((budget) => !monthFilter || budget.month === monthFilter)
    .sort((left, right) => right.month.localeCompare(left.month))

  const handleDeleteBudget = async () => {
    if (!deleteTarget) return

    try {
      setIsDeleting(true)
      await deleteBudget(deleteTarget.id)
      setDeleteTarget(null)
      await loadBudgets()
      toast({
        title: "Budget deleted",
        description: `${formatBudgetMonth(deleteTarget.month)} was removed.`,
      })
    } catch (deleteError) {
      const message =
        deleteError instanceof BudgetApiError ? deleteError.message : "Budget could not be deleted."
      toast({
        title: "Delete failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Budgets</h2>
          <p className="text-muted-foreground">Plan and manage monthly budgets</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Budget
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row">
          <div className="min-w-0 flex-1">
            <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>All currencies</SelectItem>
                {currencies.map((currency) => (
                  <SelectItem key={currency} value={currency}>
                    {currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 flex-1">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="finalized">Finalized</SelectItem>
                <SelectItem value="funded">Funded</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 flex-1">
            <BudgetMonthPicker
              value={monthFilter}
              onChange={setMonthFilter}
              emptyLabel="All months"
              allowClear
            />
          </div>
          <Button variant="outline" onClick={loadBudgets} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <LoadingSkeleton rows={6} columns={6} />
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardHeader>
            <CardTitle>Budgets unavailable</CardTitle>
            <CardDescription>
              The budget list endpoint returned an error. You can retry or create a budget directly.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" onClick={loadBudgets}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : filteredBudgets.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarRange className="h-5 w-5" />
                </EmptyMedia>
                <EmptyTitle>No budgets yet</EmptyTitle>
                <EmptyDescription>
                  Create your first monthly budget to start planning your income by category.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Budget
                </Button>
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden md:block">
            <CardHeader>
              <CardTitle>Monthly Budgets</CardTitle>
              <CardDescription>
                Review budget progress, remaining allocation, and current status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Total Income</TableHead>
                    <TableHead>Distributed Amount</TableHead>
                    <TableHead>Remaining Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBudgets.map((budget) => (
                    <TableRow key={budget.id}>
                      <TableCell className="font-medium">
                        {formatBudgetMonth(budget.month)}
                      </TableCell>
                      <TableCell>{budget.currency}</TableCell>
                      <TableCell>{formatCurrency(budget.totalIncome, budget.currency)}</TableCell>
                      <TableCell>
                        {formatCurrency(budget.distributedAmount, budget.currency)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(budget.remainingAmount, budget.currency)}
                      </TableCell>
                      <TableCell>
                        <BudgetStatusBadge status={budget.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title={`Open ${formatBudgetMonth(budget.month)} budget`}
                          >
                            <Link
                              href={`/budgets/${budget.id}`}
                              aria-label={`Open ${formatBudgetMonth(budget.month)} budget`}
                            >
                              <ArrowUpRight className="h-4 w-4" />
                            </Link>
                          </Button>
                          {budget.status === "draft" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive"
                              title={`Delete ${formatBudgetMonth(budget.month)} budget`}
                              onClick={() => setDeleteTarget(budget)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:hidden">
            {filteredBudgets.map((budget) => (
              <Card key={budget.id}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{formatBudgetMonth(budget.month)}</p>
                      <p className="text-sm text-muted-foreground">{budget.currency}</p>
                    </div>
                    <BudgetStatusBadge status={budget.status} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Total Income
                      </p>
                      <p className="font-medium">
                        {formatCurrency(budget.totalIncome, budget.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Distributed
                      </p>
                      <p className="font-medium">
                        {formatCurrency(budget.distributedAmount, budget.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Remaining
                      </p>
                      <p className="font-medium">
                        {formatCurrency(budget.remainingAmount, budget.currency)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild className="flex-1" variant="outline">
                      <Link href={`/budgets/${budget.id}`}>Open Budget</Link>
                    </Button>
                    {budget.status === "draft" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive"
                        title={`Delete ${formatBudgetMonth(budget.month)} budget`}
                        onClick={() => setDeleteTarget(budget)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <NewBudgetDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTarget(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete draft budget?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `This will permanently delete ${formatBudgetMonth(deleteTarget.month)}.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBudget} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
