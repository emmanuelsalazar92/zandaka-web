"use client"

import { format, parse } from "date-fns"
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import * as React from "react"

import { AddBudgetCategoryDialog } from "@/components/budgets/add-budget-category-dialog"
import { BudgetFundingTab } from "@/components/budgets/budget-funding-tab"
import { BudgetStatusBadge } from "@/components/budgets/budget-status-badge"
import { BudgetSummaryCards } from "@/components/budgets/budget-summary-cards"
import { BudgetValidationPanel } from "@/components/budgets/budget-validation-panel"
import type {
  Budget,
  BudgetCategoryOption,
  BudgetLine,
  BudgetPlanningLineDraft,
  BudgetValidation,
} from "@/components/budgets/types"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
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
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/use-toast"
import {
  BudgetApiError,
  copyBudgetFromPrevious,
  fetchBudget,
  fetchBudgetCategories,
  fetchBudgetLines,
  fetchBudgetValidation,
  finalizeBudget,
  saveBudgetLines,
} from "@/lib/budgets-api"
import { formatCurrency } from "@/lib/currency-formatter"
import { cn } from "@/lib/utils"

type BudgetDetailContentProps = {
  budgetId: string
}

const formatBudgetMonth = (month: string) => {
  try {
    return format(parse(month, "yyyy-MM", new Date()), "MMMM yyyy")
  } catch {
    return month
  }
}

const formatPercentage = (value: number) => `${value.toFixed(2)}%`

const makeClientId = (line: Pick<BudgetLine, "id" | "categoryId" | "sortOrder">, index: number) =>
  `budget-line-${line.id ?? line.categoryId}-${line.sortOrder}-${index}`

const buildDraftLines = (lines: BudgetLine[], categories: BudgetCategoryOption[]) => {
  const categoryMap = new Map(categories.map((category) => [category.id, category]))

  return lines
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((line, index) => {
      const category = categoryMap.get(line.categoryId)
      const parent =
        category?.parentId !== null && category?.parentId !== undefined
          ? categoryMap.get(category.parentId)
          : null

      return {
        clientId: makeClientId(line, index),
        id: line.id,
        categoryId: line.categoryId,
        categoryName: line.categoryName || category?.name || `Category ${line.categoryId}`,
        parentCategoryId: line.parentCategoryId ?? category?.parentId ?? null,
        parentCategoryName:
          line.parentCategoryName ?? category?.parentName ?? parent?.name ?? "Uncategorized",
        amount: line.amount,
        percentage: line.percentage,
        notes: line.notes,
        sortOrder: line.sortOrder || index + 1,
      }
    })
}

const serializeDraftLines = (lines: BudgetPlanningLineDraft[]) =>
  JSON.stringify(
    lines
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((line) => ({
        categoryId: line.categoryId,
        amount: Number(line.amount.toFixed(2)),
        percentage: Number(line.percentage.toFixed(2)),
        notes: line.notes.trim(),
        sortOrder: line.sortOrder,
      })),
  )

const getValidationFromBudget = (budget: Budget): BudgetValidation => ({
  isValid:
    budget.remainingAmount === 0 && budget.remainingPercentage === 0 && budget.linesCount > 0,
  distributedAmount: budget.distributedAmount,
  distributedPercentage: budget.distributedPercentage,
  remainingAmount: budget.remainingAmount,
  remainingPercentage: budget.remainingPercentage,
  errors: [],
})

const buildValidationFromError = (
  error: BudgetApiError,
  budget: Budget,
  fallback: BudgetValidation | null,
): BudgetValidation => ({
  ...(fallback ?? getValidationFromBudget(budget)),
  isValid: false,
  errors: error.details.length > 0 ? error.details : [{ field: "request", detail: error.message }],
})

export function BudgetDetailContent({ budgetId }: BudgetDetailContentProps) {
  const numericBudgetId = Number.parseInt(budgetId, 10)
  const [budget, setBudget] = React.useState<Budget | null>(null)
  const [serverLines, setServerLines] = React.useState<BudgetPlanningLineDraft[]>([])
  const [draftLines, setDraftLines] = React.useState<BudgetPlanningLineDraft[]>([])
  const [validation, setValidation] = React.useState<BudgetValidation | null>(null)
  const [categories, setCategories] = React.useState<BudgetCategoryOption[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [categoryError, setCategoryError] = React.useState<string | null>(null)
  const [isAddCategoryOpen, setIsAddCategoryOpen] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isValidating, setIsValidating] = React.useState(false)
  const [isFinalizing, setIsFinalizing] = React.useState(false)
  const [isCopying, setIsCopying] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState("planning")

  const loadWorkspace = React.useCallback(async () => {
    if (Number.isNaN(numericBudgetId)) {
      setLoadError("Budget not found.")
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setLoadError(null)
      setCategoryError(null)

      const [budgetResult, linesResult, validationResult, categoriesResult] =
        await Promise.allSettled([
          fetchBudget(numericBudgetId),
          fetchBudgetLines(numericBudgetId),
          fetchBudgetValidation(numericBudgetId),
          fetchBudgetCategories(),
        ])

      if (budgetResult.status === "rejected") {
        throw budgetResult.reason
      }

      if (linesResult.status === "rejected") {
        throw linesResult.reason
      }

      const nextBudget = budgetResult.value
      const nextCategories = categoriesResult.status === "fulfilled" ? categoriesResult.value : []
      const nextDraftLines = buildDraftLines(linesResult.value, nextCategories)

      setBudget(nextBudget)
      setServerLines(nextDraftLines)
      setDraftLines(nextDraftLines)
      setCategories(nextCategories)
      setValidation(
        validationResult.status === "fulfilled"
          ? validationResult.value
          : getValidationFromBudget(nextBudget),
      )

      if (categoriesResult.status === "rejected") {
        const message =
          categoriesResult.reason instanceof Error
            ? categoriesResult.reason.message
            : "Categories could not be loaded."
        setCategoryError(message)
      }
    } catch (workspaceError) {
      const message =
        workspaceError instanceof Error
          ? workspaceError.message
          : "Budget workspace could not be loaded."
      setLoadError(message)
    } finally {
      setIsLoading(false)
    }
  }, [numericBudgetId])

  React.useEffect(() => {
    loadWorkspace()
  }, [loadWorkspace])

  const isEditable = budget?.status === "draft"
  const hasUnsavedChanges = serializeDraftLines(serverLines) !== serializeDraftLines(draftLines)
  const totalIncome = budget?.totalIncome ?? 0
  const distributedAmount = draftLines.reduce((sum, line) => sum + line.amount, 0)
  const distributedPercentage = draftLines.reduce((sum, line) => sum + line.percentage, 0)
  const remainingAmount = totalIncome - distributedAmount
  const remainingPercentage = 100 - distributedPercentage

  const groupedLines = draftLines.reduce<Record<string, BudgetPlanningLineDraft[]>>(
    (groups, line) => {
      const key = line.parentCategoryName || "Uncategorized"
      const nextGroup = groups[key] ?? []
      nextGroup.push(line)
      groups[key] = nextGroup
      return groups
    },
    {},
  )

  const groupEntries = Object.entries(groupedLines).sort(([left], [right]) =>
    left.localeCompare(right),
  )

  const handleLineAmountChange = (clientId: string, value: string) => {
    const parsedAmount = Number.parseFloat(value || "0")
    const amount = Number.isFinite(parsedAmount) ? parsedAmount : 0

    setDraftLines((currentLines) =>
      currentLines.map((line) =>
        line.clientId === clientId
          ? {
              ...line,
              amount,
              percentage: totalIncome > 0 ? (amount / totalIncome) * 100 : 0,
            }
          : line,
      ),
    )
  }

  const handleLinePercentageChange = (clientId: string, value: string) => {
    const parsedPercentage = Number.parseFloat(value || "0")
    const percentage = Number.isFinite(parsedPercentage) ? parsedPercentage : 0

    setDraftLines((currentLines) =>
      currentLines.map((line) =>
        line.clientId === clientId
          ? {
              ...line,
              percentage,
              amount: totalIncome > 0 ? (percentage / 100) * totalIncome : 0,
            }
          : line,
      ),
    )
  }

  const handleLineNotesChange = (clientId: string, notes: string) => {
    setDraftLines((currentLines) =>
      currentLines.map((line) => (line.clientId === clientId ? { ...line, notes } : line)),
    )
  }

  const handleRemoveLine = (clientId: string) => {
    setDraftLines((currentLines) =>
      currentLines
        .filter((line) => line.clientId !== clientId)
        .map((line, index) => ({
          ...line,
          sortOrder: index + 1,
        })),
    )
  }

  const handleAddCategory = ({
    categoryId,
    amount,
    percentage,
    notes,
  }: {
    categoryId: number
    amount: number
    percentage: number
    notes: string
  }) => {
    const selectedCategory = categories.find((category) => category.id === categoryId)
    if (!selectedCategory) return

    setDraftLines((currentLines) => [
      ...currentLines,
      {
        clientId: `new-category-${categoryId}-${Date.now()}`,
        id: null,
        categoryId,
        categoryName: selectedCategory.name,
        parentCategoryId: selectedCategory.parentId,
        parentCategoryName: selectedCategory.parentName ?? "Uncategorized",
        amount,
        percentage:
          percentage > 0 ? percentage : totalIncome > 0 ? (amount / totalIncome) * 100 : 0,
        notes,
        sortOrder: currentLines.length + 1,
      },
    ])
  }

  const handleSaveChanges = async () => {
    if (!budget || !isEditable) return

    try {
      setIsSaving(true)
      await saveBudgetLines(
        budget.id,
        draftLines.map((line, index) => ({
          categoryId: line.categoryId,
          amount: Number(line.amount.toFixed(2)),
          percentage: Number(line.percentage.toFixed(2)),
          notes: line.notes.trim(),
          sortOrder: index + 1,
        })),
      )
      toast({
        title: "Changes saved",
        description: "Budget planning lines were updated.",
      })
      await loadWorkspace()
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Changes could not be saved."
      toast({
        title: "Save failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleValidate = async () => {
    if (!budget) return
    if (hasUnsavedChanges) {
      toast({
        title: "Unsaved changes",
        description: "Save your planning changes before running validation.",
      })
      return
    }

    try {
      setIsValidating(true)
      const nextValidation = await fetchBudgetValidation(budget.id)
      setValidation(nextValidation)
      toast({
        title: nextValidation.isValid ? "Budget validated" : "Validation complete",
        description: nextValidation.isValid
          ? "This budget is ready to finalize."
          : "Resolve the remaining issues before finalizing.",
      })
    } catch (validationError) {
      const message =
        validationError instanceof Error
          ? validationError.message
          : "Budget validation could not be completed."
      toast({
        title: "Validation failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsValidating(false)
    }
  }

  const handleFinalize = async () => {
    if (!budget) return
    if (hasUnsavedChanges) {
      toast({
        title: "Unsaved changes",
        description: "Save your planning changes before finalizing this budget.",
      })
      return
    }

    try {
      setIsFinalizing(true)
      const nextValidation = await fetchBudgetValidation(budget.id)
      setValidation(nextValidation)

      if (!nextValidation.isValid) {
        toast({
          title: "Budget is not ready",
          description: "Resolve the validation issues before finalizing.",
          variant: "destructive",
        })
        return
      }

      await finalizeBudget(budget.id)
      toast({
        title: "Budget finalized",
        description: "The budget is now locked for planning changes.",
      })
      await loadWorkspace()
    } catch (finalizeError) {
      if (finalizeError instanceof BudgetApiError && budget) {
        setValidation(buildValidationFromError(finalizeError, budget, validation))
      }

      const message =
        finalizeError instanceof Error ? finalizeError.message : "Budget could not be finalized."
      toast({
        title: "Finalize failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsFinalizing(false)
    }
  }

  const handleCopyFromPrevious = async () => {
    if (!budget || !isEditable) return
    if (hasUnsavedChanges) {
      toast({
        title: "Unsaved changes",
        description: "Save or discard your current edits before copying from the previous budget.",
      })
      return
    }

    try {
      setIsCopying(true)
      await copyBudgetFromPrevious(budget.id)
      toast({
        title: "Lines copied",
        description: "Planning lines were copied from the previous budget.",
      })
      await loadWorkspace()
    } catch (copyError) {
      const message = copyError instanceof Error ? copyError.message : "Nothing was copied."
      toast({
        title: "Copy from previous",
        description: message,
        variant:
          copyError instanceof BudgetApiError && copyError.status === 404
            ? "default"
            : "destructive",
      })
    } finally {
      setIsCopying(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-28 w-full" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (loadError || !budget) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Budget unavailable</CardTitle>
          <CardDescription>
            The budget workspace could not be loaded with the current API response.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-destructive">{loadError ?? "Budget not found."}</p>
          <Button asChild variant="outline">
            <Link href="/budgets">Back to Budgets</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/budgets">Budgets</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{formatBudgetMonth(budget.month)}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight">
                {formatBudgetMonth(budget.month)} Budget
              </h2>
              <BudgetStatusBadge status={budget.status} />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>Currency: {budget.currency}</span>
              <span>Total Income: {formatCurrency(budget.totalIncome, budget.currency)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleCopyFromPrevious}
              disabled={!isEditable || isCopying}
            >
              {isCopying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              Copy from Previous
            </Button>
            <Button
              variant="outline"
              onClick={handleValidate}
              disabled={isValidating || isFinalizing}
            >
              {isValidating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              Validate
            </Button>
            <Button onClick={handleFinalize} disabled={!isEditable || isFinalizing}>
              {isFinalizing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Finalize
            </Button>
          </div>
        </div>
      </div>

      <BudgetSummaryCards
        currency={budget.currency}
        totalIncome={budget.totalIncome}
        distributedAmount={validation?.distributedAmount ?? budget.distributedAmount}
        distributedPercentage={validation?.distributedPercentage ?? budget.distributedPercentage}
        remainingAmount={validation?.remainingAmount ?? budget.remainingAmount}
        remainingPercentage={validation?.remainingPercentage ?? budget.remainingPercentage}
      />

      {!isEditable ? (
        <Card className="border-blue-200 bg-blue-50/60 dark:border-blue-950 dark:bg-blue-950/20">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-blue-900 dark:text-blue-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>This budget is no longer editable. Planning data is shown in read-only mode.</p>
          </CardContent>
        </Card>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="planning">Planning</TabsTrigger>
          <TabsTrigger value="funding">Funding</TabsTrigger>
        </TabsList>

        <TabsContent value="planning" className="space-y-4">
          <div className="sticky top-4 z-10 rounded-xl border bg-background/95 p-4 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-3">
                <div className="rounded-lg bg-muted px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Distributed %
                  </p>
                  <p className="text-sm font-semibold">{formatPercentage(distributedPercentage)}</p>
                </div>
                <div className="rounded-lg bg-muted px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Remaining %
                  </p>
                  <p className="text-sm font-semibold">{formatPercentage(remainingPercentage)}</p>
                </div>
                <div className="rounded-lg bg-muted px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Remaining Amount
                  </p>
                  <p className="text-sm font-semibold">
                    {formatCurrency(remainingAmount, budget.currency)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsAddCategoryOpen(true)}
                  disabled={!isEditable || categories.length === 0}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Category
                </Button>
                <Button
                  onClick={handleSaveChanges}
                  disabled={!isEditable || !hasUnsavedChanges || isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Changes
                </Button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {hasUnsavedChanges ? (
                <span>Local edits are not saved yet.</span>
              ) : (
                <span>All changes saved.</span>
              )}
              {hasUnsavedChanges ? (
                <span>Summary cards show the last saved validation snapshot.</span>
              ) : null}
              {categoryError ? <span className="text-destructive">{categoryError}</span> : null}
            </div>
          </div>

          <BudgetValidationPanel validation={validation} currency={budget.currency} />

          {groupEntries.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Plus className="h-5 w-5" />
                    </EmptyMedia>
                    <EmptyTitle>No planning categories yet</EmptyTitle>
                    <EmptyDescription>
                      Add child categories to start distributing this month&apos;s income.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      onClick={() => setIsAddCategoryOpen(true)}
                      disabled={!isEditable || categories.length === 0}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Category
                    </Button>
                  </EmptyContent>
                </Empty>
              </CardContent>
            </Card>
          ) : (
            groupEntries.map(([groupName, lines]) => {
              const groupAmount = lines.reduce((sum, line) => sum + line.amount, 0)
              const groupPercentage = lines.reduce((sum, line) => sum + line.percentage, 0)

              return (
                <Card key={groupName}>
                  <CardHeader className="gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle>{groupName}</CardTitle>
                      <CardDescription>
                        {lines.length} categor{lines.length === 1 ? "y" : "ies"} in this group
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <span className="rounded-md bg-muted px-3 py-2">
                        Amount: {formatCurrency(groupAmount, budget.currency)}
                      </span>
                      <span className="rounded-md bg-muted px-3 py-2">
                        Percentage: {formatPercentage(groupPercentage)}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="hidden md:block">
                      <Table className="table-fixed">
                        <TableHeader>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableHead className="w-[28%] px-6">Category</TableHead>
                            <TableHead className="w-[16%]">Amount</TableHead>
                            <TableHead className="w-[14%]">Percentage</TableHead>
                            <TableHead className="w-[34%]">Notes</TableHead>
                            <TableHead className="w-[8%] px-6 text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lines.map((line) => (
                            <TableRow key={line.clientId} className="hover:bg-transparent">
                              <TableCell className="px-6 py-3 align-top">
                                <div className="space-y-1">
                                  <p className="truncate font-medium">{line.categoryName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Child category in {groupName}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell className="py-3">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={Number(line.amount.toFixed(2))}
                                  onChange={(event) =>
                                    handleLineAmountChange(line.clientId, event.target.value)
                                  }
                                  disabled={!isEditable}
                                  className="h-9 text-right font-mono"
                                />
                              </TableCell>
                              <TableCell className="py-3">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={Number(line.percentage.toFixed(2))}
                                  onChange={(event) =>
                                    handleLinePercentageChange(line.clientId, event.target.value)
                                  }
                                  disabled={!isEditable}
                                  className="h-9 text-right font-mono"
                                />
                              </TableCell>
                              <TableCell className="py-3 whitespace-normal">
                                <Input
                                  value={line.notes}
                                  onChange={(event) =>
                                    handleLineNotesChange(line.clientId, event.target.value)
                                  }
                                  placeholder="Add notes"
                                  disabled={!isEditable}
                                  className="h-9"
                                />
                              </TableCell>
                              <TableCell className="px-6 py-3 text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveLine(line.clientId)}
                                  disabled={!isEditable}
                                  className="h-8 w-8"
                                  title={`Remove ${line.categoryName}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter className="bg-muted/40">
                          <TableRow className="hover:bg-muted/40">
                            <TableCell className="px-6 py-3 font-medium">Group subtotal</TableCell>
                            <TableCell className="py-3 font-medium">
                              {formatCurrency(groupAmount, budget.currency)}
                            </TableCell>
                            <TableCell className="py-3 font-medium">
                              {formatPercentage(groupPercentage)}
                            </TableCell>
                            <TableCell />
                            <TableCell className="px-6" />
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>

                    <div className="grid gap-4 p-4 md:hidden">
                      {lines.map((line) => (
                        <div key={line.clientId} className="rounded-lg border p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">{line.categoryName}</p>
                              <p className="text-sm text-muted-foreground">
                                {line.parentCategoryName}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveLine(line.clientId)}
                              disabled={!isEditable}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="mt-4 grid gap-3">
                            <div className="space-y-2">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Amount
                              </p>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={Number(line.amount.toFixed(2))}
                                onChange={(event) =>
                                  handleLineAmountChange(line.clientId, event.target.value)
                                }
                                disabled={!isEditable}
                              />
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Percentage
                              </p>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={Number(line.percentage.toFixed(2))}
                                onChange={(event) =>
                                  handleLinePercentageChange(line.clientId, event.target.value)
                                }
                                disabled={!isEditable}
                              />
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Notes
                              </p>
                              <Input
                                value={line.notes}
                                onChange={(event) =>
                                  handleLineNotesChange(line.clientId, event.target.value)
                                }
                                placeholder="Add notes"
                                disabled={!isEditable}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="rounded-lg bg-muted/40 p-4 text-sm font-medium">
                        Group subtotal: {formatCurrency(groupAmount, budget.currency)} /{" "}
                        {formatPercentage(groupPercentage)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        <TabsContent
          value="funding"
          forceMount
          className={cn("space-y-4", activeTab !== "funding" && "hidden")}
        >
          <BudgetFundingTab
            budget={budget}
            planningLines={serverLines}
            onRefreshBudget={loadWorkspace}
          />
        </TabsContent>
      </Tabs>

      <AddBudgetCategoryDialog
        open={isAddCategoryOpen}
        onOpenChange={setIsAddCategoryOpen}
        categories={categories}
        totalIncome={budget.totalIncome}
        existingCategoryIds={draftLines.map((line) => line.categoryId)}
        onConfirm={handleAddCategory}
      />
    </div>
  )
}
