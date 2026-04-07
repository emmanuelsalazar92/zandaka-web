"use client"

import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Loader2,
  Lock,
  Save,
  SendHorizontal,
} from "lucide-react"
import * as React from "react"

import { BudgetStatusBadge } from "@/components/budgets/budget-status-badge"
import type {
  Budget,
  BudgetFundingAccountOption,
  BudgetFundingOptions,
  BudgetFundingPlan,
  BudgetPlanningLineDraft,
  BudgetValidationIssue,
} from "@/components/budgets/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/ui/use-toast"
import {
  BudgetApiError,
  fetchBudgetFundingOptions,
  fetchBudgetFundingPlan,
  fundBudget,
  saveBudgetFundingPlan,
} from "@/lib/budgets-api"
import { formatCurrency } from "@/lib/currency-formatter"
import { cn } from "@/lib/utils"

type BudgetFundingTabProps = {
  budget: Budget
  planningLines: BudgetPlanningLineDraft[]
  onRefreshBudget: () => Promise<void>
}

type FundingFeedback = {
  tone: "success" | "error"
  title: string
  description: string
  details?: BudgetValidationIssue[]
}

const serializeFundingState = (
  sourceAccountId: string,
  assignments: Record<number, string>,
  lineIds: number[],
) =>
  JSON.stringify({
    sourceAccountId,
    lines: lineIds.map((budgetLineId) => ({
      budgetLineId,
      accountEnvelopeId: assignments[budgetLineId] ?? "",
    })),
  })

const getAccountLabel = (account: BudgetFundingAccountOption) =>
  [account.name, account.currency, account.institutionName].filter(Boolean).join(" / ")

const getEnvelopeLabel = (
  accountName: string | null,
  categoryName: string,
  institutionName?: string | null,
) => [accountName, categoryName, institutionName].filter(Boolean).join(" / ")

function FundingMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  )
}

function FundingFeedbackAlert({ feedback }: { feedback: FundingFeedback }) {
  const isSuccess = feedback.tone === "success"

  return (
    <Alert
      className={cn(
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"
          : "border-destructive/40",
      )}
      variant={isSuccess ? "default" : "destructive"}
    >
      {isSuccess ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      <AlertTitle>{feedback.title}</AlertTitle>
      <AlertDescription>
        <p>{feedback.description}</p>
        {feedback.details && feedback.details.length > 0 ? (
          <ul className="ml-4 list-disc space-y-1">
            {feedback.details.map((detail, index) => (
              <li key={`${detail.field}-${index}`}>{detail.detail}</li>
            ))}
          </ul>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}

function FundingTableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </CardContent>
    </Card>
  )
}

export function BudgetFundingTab({
  budget,
  planningLines,
  onRefreshBudget,
}: BudgetFundingTabProps) {
  const [fundingOptions, setFundingOptions] = React.useState<BudgetFundingOptions | null>(null)
  const [fundingPlan, setFundingPlan] = React.useState<BudgetFundingPlan | null>(null)
  const [sourceAccountId, setSourceAccountId] = React.useState("")
  const [assignments, setAssignments] = React.useState<Record<number, string>>({})
  const [savedSnapshot, setSavedSnapshot] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [feedback, setFeedback] = React.useState<FundingFeedback | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isFunding, setIsFunding] = React.useState(false)

  const canEdit = budget.status === "finalized"
  const isReadOnly = budget.status === "funded"

  const initializeFundingState = React.useCallback(
    (nextOptions: BudgetFundingOptions, nextPlan: BudgetFundingPlan) => {
      const savedAssignments = new Map(
        nextPlan.lines.map((line) => [
          line.budgetLineId,
          line.accountEnvelopeId ? String(line.accountEnvelopeId) : "",
        ]),
      )

      const canReuseSavedSource =
        nextPlan.sourceAccountId !== null &&
        nextOptions.accounts.some((account) => account.id === nextPlan.sourceAccountId)

      const initialSourceAccountId = isReadOnly
        ? nextPlan.sourceAccountId
          ? String(nextPlan.sourceAccountId)
          : ""
        : canReuseSavedSource
          ? String(nextPlan.sourceAccountId)
          : nextOptions.accounts.length === 1
            ? String(nextOptions.accounts[0].id)
            : ""

      const nextAssignments = nextOptions.lines.reduce<Record<number, string>>((result, line) => {
        const savedEnvelopeId = savedAssignments.get(line.budgetLineId) ?? ""

        if (isReadOnly) {
          result[line.budgetLineId] = savedEnvelopeId
          return result
        }

        const isValidForSelectedSource =
          savedEnvelopeId !== "" &&
          initialSourceAccountId !== "" &&
          line.availableEnvelopes.some(
            (envelope) =>
              String(envelope.id) === savedEnvelopeId &&
              String(envelope.accountId) === initialSourceAccountId,
          )

        result[line.budgetLineId] = isValidForSelectedSource ? savedEnvelopeId : ""
        return result
      }, {})

      setFundingOptions(nextOptions)
      setFundingPlan(nextPlan)
      setSourceAccountId(initialSourceAccountId)
      setAssignments(nextAssignments)
      setSavedSnapshot(
        serializeFundingState(
          initialSourceAccountId,
          nextAssignments,
          nextOptions.lines.map((line) => line.budgetLineId),
        ),
      )
    },
    [isReadOnly],
  )

  const loadFundingWorkspace = React.useCallback(async () => {
    if (budget.status === "draft") {
      setFundingOptions(null)
      setFundingPlan(null)
      setSourceAccountId("")
      setAssignments({})
      setSavedSnapshot("")
      setLoadError(null)
      setFeedback(null)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setLoadError(null)
      setFeedback(null)
      const [nextOptions, nextPlan] = await Promise.all([
        fetchBudgetFundingOptions(budget.id),
        fetchBudgetFundingPlan(budget.id),
      ])

      initializeFundingState(nextOptions, nextPlan)
    } catch (fundingError) {
      const message =
        fundingError instanceof Error ? fundingError.message : "Funding data could not be loaded."
      setLoadError(message)
      setFundingOptions(null)
      setFundingPlan(null)
    } finally {
      setIsLoading(false)
    }
  }, [budget.id, budget.status, initializeFundingState])

  React.useEffect(() => {
    loadFundingWorkspace()
  }, [loadFundingWorkspace])

  const lineIds = React.useMemo(
    () =>
      fundingOptions?.lines.map((line) => line.budgetLineId) ??
      fundingPlan?.lines.map((line) => line.budgetLineId) ??
      [],
    [fundingOptions, fundingPlan],
  )

  const planningLineMeta = React.useMemo(
    () =>
      new Map(
        planningLines.filter((line) => line.id !== null).map((line) => [line.id as number, line]),
      ),
    [planningLines],
  )

  const fundingPlanLineMap = React.useMemo(
    () => new Map(fundingPlan?.lines.map((line) => [line.budgetLineId, line]) ?? []),
    [fundingPlan],
  )

  const currentSnapshot = React.useMemo(
    () => serializeFundingState(sourceAccountId, assignments, lineIds),
    [assignments, lineIds, sourceAccountId],
  )

  const hasUnsavedChanges = savedSnapshot !== "" && currentSnapshot !== savedSnapshot
  const hasSelectableAccounts = (fundingOptions?.accounts.length ?? 0) > 0
  const lines = fundingOptions?.lines ?? []
  const lineCount = lines.length || fundingPlan?.lines.length || budget.linesCount
  const assignedCount = lineIds.reduce(
    (count, budgetLineId) => (assignments[budgetLineId] ? count + 1 : count),
    0,
  )
  const unassignedCount = Math.max(lineCount - assignedCount, 0)

  const readiness = React.useMemo(() => {
    if (budget.status === "draft") {
      return {
        label: "Incomplete funding plan",
        description: "Finalize this budget before setting up funding.",
        className:
          "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100",
      }
    }

    if (budget.status === "funded") {
      return {
        label: "Already funded",
        description:
          "Funding has already been executed. Saved selections are shown in read-only mode.",
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100",
      }
    }

    if (!hasSelectableAccounts) {
      return {
        label: "Incomplete funding plan",
        description: "No active source account is available for this budget currency.",
        className:
          "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100",
      }
    }

    if (!sourceAccountId) {
      return {
        label: "Incomplete funding plan",
        description: "Select a source account to continue.",
        className:
          "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100",
      }
    }

    if (lineCount === 0) {
      return {
        label: "Incomplete funding plan",
        description: "This budget does not contain any lines to fund.",
        className:
          "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100",
      }
    }

    if (unassignedCount > 0) {
      return {
        label: "Incomplete funding plan",
        description: `${unassignedCount} line${unassignedCount === 1 ? "" : "s"} still need a destination envelope.`,
        className:
          "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100",
      }
    }

    if (hasUnsavedChanges) {
      return {
        label: "Incomplete funding plan",
        description: "Save the current funding plan before executing funding.",
        className:
          "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100",
      }
    }

    return {
      label: "Ready to fund",
      description: "All lines are assigned and the saved funding plan can be executed.",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100",
    }
  }, [
    budget.status,
    hasSelectableAccounts,
    hasUnsavedChanges,
    lineCount,
    sourceAccountId,
    unassignedCount,
  ])

  const handleSourceAccountChange = (value: string) => {
    setFeedback(null)
    setSourceAccountId(value)
    setAssignments((currentAssignments) => {
      const nextAssignments = { ...currentAssignments }

      for (const line of lines) {
        const currentValue = currentAssignments[line.budgetLineId]
        if (!currentValue) continue

        const isStillValid = line.availableEnvelopes.some(
          (envelope) =>
            String(envelope.id) === currentValue && String(envelope.accountId) === value,
        )

        if (!isStillValid) {
          nextAssignments[line.budgetLineId] = ""
        }
      }

      return nextAssignments
    })
  }

  const handleEnvelopeChange = (budgetLineId: number, accountEnvelopeId: string) => {
    setFeedback(null)
    setAssignments((currentAssignments) => ({
      ...currentAssignments,
      [budgetLineId]: accountEnvelopeId,
    }))
  }

  const handleSaveFundingPlan = async () => {
    if (!canEdit || !sourceAccountId) return

    try {
      setIsSaving(true)
      setFeedback(null)
      await saveBudgetFundingPlan(budget.id, {
        sourceAccountId: Number.parseInt(sourceAccountId, 10),
        lines: lineIds.map((budgetLineId) => ({
          budgetLineId,
          accountEnvelopeId: Number.parseInt(assignments[budgetLineId], 10),
        })),
      })
      await loadFundingWorkspace()
      setFeedback({
        tone: "success",
        title: "Funding plan saved",
        description: "The saved funding plan is ready for execution once you confirm funding.",
      })
      toast({
        title: "Funding plan saved",
        description: "Selections were saved successfully.",
      })
    } catch (saveError) {
      const details = saveError instanceof BudgetApiError ? saveError.details : []
      const message =
        saveError instanceof Error ? saveError.message : "Funding plan could not be saved."
      setFeedback({
        tone: "error",
        title: "Save failed",
        description: message,
        details,
      })
      toast({
        title: "Save failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleFundBudget = async () => {
    if (!canEdit) return

    try {
      setIsFunding(true)
      setFeedback(null)
      await fundBudget(budget.id)
      await onRefreshBudget()
      setFeedback({
        tone: "success",
        title: "Budget funded successfully",
        description: "Funding executed and this budget is now read-only.",
      })
      toast({
        title: "Budget funded",
        description: "Funding executed successfully.",
      })
    } catch (fundError) {
      const details = fundError instanceof BudgetApiError ? fundError.details : []
      const message = fundError instanceof Error ? fundError.message : "Budget funding failed."
      setFeedback({
        tone: "error",
        title: "Funding failed",
        description: message,
        details,
      })
      toast({
        title: "Funding failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsFunding(false)
    }
  }

  const saveDisabled =
    !canEdit ||
    isLoading ||
    isSaving ||
    isFunding ||
    !hasSelectableAccounts ||
    !sourceAccountId ||
    lineCount === 0 ||
    unassignedCount > 0 ||
    !hasUnsavedChanges

  const fundDisabled =
    !canEdit ||
    isLoading ||
    isSaving ||
    isFunding ||
    !hasSelectableAccounts ||
    !sourceAccountId ||
    lineCount === 0 ||
    unassignedCount > 0 ||
    hasUnsavedChanges

  if (isLoading) {
    return <FundingTableSkeleton />
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <CardTitle>Funding</CardTitle>
            <CardDescription>
              Assign this finalized budget to real envelopes before executing funding.
            </CardDescription>
          </div>
          <BudgetStatusBadge status={budget.status} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={cn("rounded-xl border p-4", readiness.className)}>
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold">{readiness.label}</p>
                <p className="text-sm opacity-90">{readiness.description}</p>
              </div>
              <Badge variant="outline" className="w-fit border-current/20 bg-background/50">
                {budget.status === "funded"
                  ? "Already funded"
                  : lineCount > 0 && unassignedCount === 0 && !hasUnsavedChanges && sourceAccountId
                    ? "Ready to fund"
                    : "Needs attention"}
              </Badge>
            </div>
          </div>

          {feedback ? <FundingFeedbackAlert feedback={feedback} /> : null}

          {loadError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Funding data unavailable</AlertTitle>
              <AlertDescription>
                <p>{loadError}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={loadFundingWorkspace}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <FundingMetric label="Budget Month" value={budget.month} />
            <FundingMetric label="Currency" value={budget.currency} />
            <FundingMetric label="Lines" value={String(lineCount)} />
            <FundingMetric label="Assigned" value={String(assignedCount)} />
            <FundingMetric label="Unassigned" value={String(unassignedCount)} />
          </div>

          {budget.status === "draft" ? (
            <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <Lock className="h-4 w-4" />
              <AlertTitle>Funding is locked</AlertTitle>
              <AlertDescription>
                Finalize this budget before setting up source accounts and destination envelopes.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {budget.status !== "draft" && !loadError ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Source Account</CardTitle>
              <CardDescription>
                Funding uses a single source account that matches the budget currency.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isReadOnly ? (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Saved source account
                  </p>
                  <p className="mt-1 font-medium">
                    {fundingPlan?.sourceAccountName ?? "No source account saved"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{budget.currency}</p>
                </div>
              ) : (
                <FieldGroup>
                  <Field>
                    <FieldLabel>Source Account</FieldLabel>
                    <FieldContent>
                      <Select
                        value={sourceAccountId || undefined}
                        onValueChange={handleSourceAccountChange}
                        disabled={!hasSelectableAccounts}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={
                              hasSelectableAccounts
                                ? "Select source account"
                                : "No source accounts available"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {fundingOptions?.accounts.map((account) => (
                            <SelectItem key={account.id} value={String(account.id)}>
                              {getAccountLabel(account)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldDescription>
                        Only accounts returned by the backend are available for this budget.
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                </FieldGroup>
              )}

              {!hasSelectableAccounts && canEdit ? (
                <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                  <CreditCard className="h-4 w-4" />
                  <AlertTitle>No valid source accounts</AlertTitle>
                  <AlertDescription>
                    No active account is currently available for this budget currency. Funding
                    cannot continue until the backend returns a valid source account.
                  </AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Funding Assignments</CardTitle>
              <CardDescription>
                Map each budget line to a valid destination envelope before funding this budget.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-0">
              {lineCount === 0 ? (
                <div className="p-6">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <AlertCircle className="h-5 w-5" />
                      </EmptyMedia>
                      <EmptyTitle>No lines available for funding</EmptyTitle>
                      <EmptyDescription>
                        Planning lines must exist before this budget can be funded.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </div>
              ) : (
                <>
                  <div className="hidden md:block">
                    <Table className="table-fixed">
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="w-[34%] px-6">Category</TableHead>
                          <TableHead className="w-[16%]">Planned Amount</TableHead>
                          <TableHead className="w-[34%]">Destination Envelope</TableHead>
                          <TableHead className="w-[16%] px-6">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.map((line) => {
                          const availableEnvelopes =
                            sourceAccountId !== ""
                              ? line.availableEnvelopes.filter(
                                  (envelope) => String(envelope.accountId) === sourceAccountId,
                                )
                              : []
                          const assignedEnvelopeId = assignments[line.budgetLineId] ?? ""
                          const isAssigned = assignedEnvelopeId !== ""
                          const planningLine = planningLineMeta.get(line.budgetLineId)
                          const savedPlanLine = fundingPlanLineMap.get(line.budgetLineId)

                          return (
                            <TableRow
                              key={line.budgetLineId}
                              className={cn(
                                "hover:bg-transparent",
                                !isAssigned && canEdit && "bg-amber-50/30 dark:bg-amber-950/10",
                              )}
                            >
                              <TableCell className="px-6 py-3 align-top">
                                <div className="space-y-1">
                                  <p className="font-medium">{line.categoryName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {planningLine?.parentCategoryName ?? "Budget line"}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell className="py-3 font-medium">
                                {formatCurrency(line.amount, budget.currency)}
                              </TableCell>
                              <TableCell className="py-3">
                                {isReadOnly ? (
                                  <div className="space-y-1">
                                    <p className="font-medium">
                                      {savedPlanLine?.isAssigned
                                        ? getEnvelopeLabel(
                                            savedPlanLine.accountName,
                                            line.categoryName,
                                          )
                                        : "Not assigned"}
                                    </p>
                                    {savedPlanLine?.accountCurrency ? (
                                      <p className="text-xs text-muted-foreground">
                                        {savedPlanLine.accountCurrency}
                                      </p>
                                    ) : null}
                                  </div>
                                ) : (
                                  <Select
                                    value={assignedEnvelopeId || undefined}
                                    onValueChange={(value) =>
                                      handleEnvelopeChange(line.budgetLineId, value)
                                    }
                                    disabled={!sourceAccountId || availableEnvelopes.length === 0}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue
                                        placeholder={
                                          !sourceAccountId
                                            ? "Select source account first"
                                            : availableEnvelopes.length === 0
                                              ? "No matching envelope"
                                              : "Select destination envelope"
                                        }
                                      />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {availableEnvelopes.map((envelope) => (
                                        <SelectItem key={envelope.id} value={String(envelope.id)}>
                                          {getEnvelopeLabel(
                                            envelope.accountName,
                                            envelope.categoryName,
                                            envelope.institutionName,
                                          )}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </TableCell>
                              <TableCell className="px-6 py-3">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    isAssigned
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
                                      : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
                                  )}
                                >
                                  {isAssigned ? "Assigned" : "Missing"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="grid gap-3 p-4 md:hidden">
                    {lines.map((line) => {
                      const availableEnvelopes =
                        sourceAccountId !== ""
                          ? line.availableEnvelopes.filter(
                              (envelope) => String(envelope.accountId) === sourceAccountId,
                            )
                          : []
                      const assignedEnvelopeId = assignments[line.budgetLineId] ?? ""
                      const isAssigned = assignedEnvelopeId !== ""
                      const planningLine = planningLineMeta.get(line.budgetLineId)
                      const savedPlanLine = fundingPlanLineMap.get(line.budgetLineId)

                      return (
                        <div
                          key={line.budgetLineId}
                          className={cn(
                            "rounded-lg border p-4",
                            !isAssigned &&
                              canEdit &&
                              "border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/10",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">{line.categoryName}</p>
                              <p className="text-sm text-muted-foreground">
                                {planningLine?.parentCategoryName ?? "Budget line"}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                isAssigned
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
                                  : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
                              )}
                            >
                              {isAssigned ? "Assigned" : "Missing"}
                            </Badge>
                          </div>
                          <div className="mt-4 space-y-3">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Planned Amount
                              </p>
                              <p className="mt-1 font-medium">
                                {formatCurrency(line.amount, budget.currency)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Destination Envelope
                              </p>
                              {isReadOnly ? (
                                <p className="mt-1 font-medium">
                                  {savedPlanLine?.isAssigned
                                    ? getEnvelopeLabel(savedPlanLine.accountName, line.categoryName)
                                    : "Not assigned"}
                                </p>
                              ) : (
                                <Select
                                  value={assignedEnvelopeId || undefined}
                                  onValueChange={(value) =>
                                    handleEnvelopeChange(line.budgetLineId, value)
                                  }
                                  disabled={!sourceAccountId || availableEnvelopes.length === 0}
                                >
                                  <SelectTrigger className="mt-1 w-full">
                                    <SelectValue
                                      placeholder={
                                        !sourceAccountId
                                          ? "Select source account first"
                                          : availableEnvelopes.length === 0
                                            ? "No matching envelope"
                                            : "Select destination envelope"
                                      }
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableEnvelopes.map((envelope) => (
                                      <SelectItem key={envelope.id} value={String(envelope.id)}>
                                        {getEnvelopeLabel(
                                          envelope.accountName,
                                          envelope.categoryName,
                                          envelope.institutionName,
                                        )}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {canEdit ? (
            <div className="sticky bottom-4 z-10 rounded-xl border bg-background/95 p-4 shadow-sm backdrop-blur">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>
                    {assignedCount} of {lineCount} lines assigned.
                  </p>
                  {!sourceAccountId ? (
                    <p>Select a source account to unlock destination envelopes.</p>
                  ) : null}
                  {unassignedCount > 0 ? (
                    <p>
                      Save requires a source account and an envelope assignment for every budget
                      line.
                    </p>
                  ) : hasUnsavedChanges ? (
                    <p>Save the current funding plan before executing funding.</p>
                  ) : (
                    <p>The saved funding plan is ready to execute.</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleSaveFundingPlan} disabled={saveDisabled}>
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Funding Plan
                  </Button>
                  <Button onClick={handleFundBudget} disabled={fundDisabled}>
                    {isFunding ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <SendHorizontal className="mr-2 h-4 w-4" />
                    )}
                    Fund Budget
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
