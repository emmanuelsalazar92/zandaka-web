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
        fundingError instanceof Error
          ? fundingError.message
          : "No pudimos cargar la asignación a sobres. Vuelve a intentar."
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
        label: "Asignación incompleta",
        description: "Finaliza el presupuesto antes de asignarlo a sobres.",
        className:
          "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100",
      }
    }

    if (budget.status === "funded") {
      return {
        label: "Ya se asignó a sobres",
        description: "La asignación ya se ejecutó. Puedes consultar las selecciones guardadas.",
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100",
      }
    }

    if (!hasSelectableAccounts) {
      return {
        label: "Asignación incompleta",
        description: "No hay una cuenta de origen activa en la moneda del presupuesto.",
        className:
          "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100",
      }
    }

    if (!sourceAccountId) {
      return {
        label: "Asignación incompleta",
        description: "Elige una cuenta de origen para continuar.",
        className:
          "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100",
      }
    }

    if (lineCount === 0) {
      return {
        label: "Asignación incompleta",
        description: "Este presupuesto no tiene categorías para asignar.",
        className:
          "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100",
      }
    }

    if (unassignedCount > 0) {
      return {
        label: "Asignación incompleta",
        description: `${unassignedCount} categoría${unassignedCount === 1 ? "" : "s"} aún necesitan un sobre de destino.`,
        className:
          "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100",
      }
    }

    if (hasUnsavedChanges) {
      return {
        label: "Asignación incompleta",
        description: "Guarda la asignación antes de ejecutarla.",
        className:
          "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100",
      }
    }

    return {
      label: "Listo para asignar",
      description: "Todas las categorías tienen destino. Puedes ejecutar la asignación guardada.",
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
        title: "Asignación guardada",
        description: "La asignación guardada está lista para ejecutarse cuando la confirmes.",
      })
      toast({
        title: "Asignación guardada",
        description: "Las selecciones se guardaron correctamente.",
      })
    } catch (saveError) {
      const details = saveError instanceof BudgetApiError ? saveError.details : []
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No pudimos guardar la asignación. Vuelve a intentar."
      setFeedback({
        tone: "error",
        title: "No se guardaron los cambios",
        description: message,
        details,
      })
      toast({
        title: "No se guardaron los cambios",
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
        title: "Presupuesto asignado correctamente",
        description: "La asignación se ejecutó y el presupuesto quedó cerrado.",
      })
      toast({
        title: "Presupuesto asignado",
        description: "La asignación se ejecutó correctamente.",
      })
    } catch (fundError) {
      const details = fundError instanceof BudgetApiError ? fundError.details : []
      const message =
        fundError instanceof Error
          ? fundError.message
          : "No pudimos asignar el presupuesto. Vuelve a intentar."
      setFeedback({
        tone: "error",
        title: "No se completó la asignación",
        description: message,
        details,
      })
      toast({
        title: "No se completó la asignación",
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
            <CardTitle>Asignación a sobres</CardTitle>
            <CardDescription>
              Elige los sobres de destino para este presupuesto finalizado.
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
                  ? "Ya se asignó a sobres"
                  : lineCount > 0 && unassignedCount === 0 && !hasUnsavedChanges && sourceAccountId
                    ? "Listo para asignar"
                    : "Requiere revisión"}
              </Badge>
            </div>
          </div>

          {feedback ? <FundingFeedbackAlert feedback={feedback} /> : null}

          {loadError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Asignación no disponible</AlertTitle>
              <AlertDescription>
                <p>{loadError}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={loadFundingWorkspace}>
                  Volver a intentar
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <FundingMetric label="Mes del presupuesto" value={budget.month} />
            <FundingMetric label="Moneda" value={budget.currency} />
            <FundingMetric label="Categorías" value={String(lineCount)} />
            <FundingMetric label="Asignadas" value={String(assignedCount)} />
            <FundingMetric label="Sin asignar" value={String(unassignedCount)} />
          </div>

          {budget.status === "draft" ? (
            <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <Lock className="h-4 w-4" />
              <AlertTitle>La asignación está bloqueada</AlertTitle>
              <AlertDescription>
                Finaliza el presupuesto antes de elegir cuentas de origen y sobres de destino.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {budget.status !== "draft" && !loadError ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Cuenta de origen</CardTitle>
              <CardDescription>
                La asignación utiliza una cuenta de origen en la moneda del presupuesto.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isReadOnly ? (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Cuenta de origen guardada
                  </p>
                  <p className="mt-1 font-medium">
                    {fundingPlan?.sourceAccountName ?? "No hay cuenta de origen guardada"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{budget.currency}</p>
                </div>
              ) : (
                <FieldGroup>
                  <Field>
                    <FieldLabel>Cuenta de origen</FieldLabel>
                    <FieldContent>
                      <Select
                        value={sourceAccountId || undefined}
                        onValueChange={handleSourceAccountChange}
                        disabled={!hasSelectableAccounts}
                      >
                        <SelectTrigger
                          className="w-full"
                          aria-label="Cuenta de origen del presupuesto"
                        >
                          <SelectValue
                            placeholder={
                              hasSelectableAccounts
                                ? "Elige una cuenta de origen"
                                : "No hay cuentas de origen disponibles"
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
                        Se muestran las cuentas disponibles en la moneda del presupuesto.
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                </FieldGroup>
              )}

              {!hasSelectableAccounts && canEdit ? (
                <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                  <CreditCard className="h-4 w-4" />
                  <AlertTitle>No hay cuentas de origen válidas</AlertTitle>
                  <AlertDescription>
                    Activa o crea una cuenta en la moneda del presupuesto para continuar.
                  </AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Asignación del presupuesto</CardTitle>
              <CardDescription>
                Elige un sobre de destino para cada categoría antes de ejecutar la asignación.
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
                      <EmptyTitle>No hay categorías para asignar</EmptyTitle>
                      <EmptyDescription>
                        Añade categorías a la planificación antes de asignar el presupuesto.
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
                          <TableHead className="w-[34%] px-6">Categoría</TableHead>
                          <TableHead className="w-[16%]">Importe planificado</TableHead>
                          <TableHead className="w-[34%]">Sobre de destino</TableHead>
                          <TableHead className="w-[16%] px-6">Estado</TableHead>
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
                                    {planningLine?.parentCategoryName ??
                                      "Categoría del presupuesto"}
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
                                        : "Sin asignar"}
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
                                    <SelectTrigger
                                      className="w-full"
                                      aria-label={"Sobre de destino: " + line.categoryName}
                                    >
                                      <SelectValue
                                        placeholder={
                                          !sourceAccountId
                                            ? "Elige primero una cuenta de origen"
                                            : availableEnvelopes.length === 0
                                              ? "No hay un sobre compatible"
                                              : "Elige un sobre de destino"
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
                                  {isAssigned ? "Asignadas" : "Pendiente"}
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
                                {planningLine?.parentCategoryName ?? "Categoría del presupuesto"}
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
                              {isAssigned ? "Asignadas" : "Pendiente"}
                            </Badge>
                          </div>
                          <div className="mt-4 space-y-3">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Importe planificado
                              </p>
                              <p className="mt-1 font-medium">
                                {formatCurrency(line.amount, budget.currency)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Sobre de destino
                              </p>
                              {isReadOnly ? (
                                <p className="mt-1 font-medium">
                                  {savedPlanLine?.isAssigned
                                    ? getEnvelopeLabel(savedPlanLine.accountName, line.categoryName)
                                    : "Sin asignar"}
                                </p>
                              ) : (
                                <Select
                                  value={assignedEnvelopeId || undefined}
                                  onValueChange={(value) =>
                                    handleEnvelopeChange(line.budgetLineId, value)
                                  }
                                  disabled={!sourceAccountId || availableEnvelopes.length === 0}
                                >
                                  <SelectTrigger
                                    className="mt-1 w-full"
                                    aria-label={"Sobre de destino: " + line.categoryName}
                                  >
                                    <SelectValue
                                      placeholder={
                                        !sourceAccountId
                                          ? "Elige primero una cuenta de origen"
                                          : availableEnvelopes.length === 0
                                            ? "No hay un sobre compatible"
                                            : "Elige un sobre de destino"
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
                    {assignedCount} de {lineCount} categorías asignadas.
                  </p>
                  {!sourceAccountId ? (
                    <p>Elige una cuenta de origen para ver los sobres de destino.</p>
                  ) : null}
                  {unassignedCount > 0 ? (
                    <p>
                      Elige una cuenta de origen y un sobre para cada categoría antes de guardar.
                    </p>
                  ) : hasUnsavedChanges ? (
                    <p>Guarda la asignación antes de ejecutarla.</p>
                  ) : (
                    <p>La asignación guardada está lista para ejecutarse.</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleSaveFundingPlan} disabled={saveDisabled}>
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Guardar asignación
                  </Button>
                  <Button onClick={handleFundBudget} disabled={fundDisabled}>
                    {isFunding ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <SendHorizontal className="mr-2 h-4 w-4" />
                    )}
                    Asignar presupuesto
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
