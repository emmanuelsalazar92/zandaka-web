"use client"

import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"

import { AutomaticDeductionsCard } from "@/components/budgets/automatic-deductions-card"
import { BudgetIncomeForm } from "@/components/budgets/budget-income-form"
import { BudgetSummaryCard } from "@/components/budgets/budget-summary-card"
import { ManualAdjustmentsCard } from "@/components/budgets/manual-adjustments-card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Label } from "@/components/ui/label"
import { useIsMobile } from "@/components/ui/use-mobile"
import { toast } from "@/components/ui/use-toast"
import {
  buildBudgetPayrollReferenceIds,
  calculateBudgetIncomeAdjustments,
} from "@/lib/budget-income-adjustments"
import { BudgetApiError, copyBudgetFromPrevious, createBudget } from "@/lib/budgets-api"
import { calculateNetSalary } from "@/lib/settings-api"

type NewBudgetDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type BudgetCreationState = {
  month: string
  currency: string
  grossSalaryInput: string
  ccssEnabled: boolean
  taxEnabled: boolean
  fxEnabled: boolean
  fxAmountInput: string
  copyFromPrevious: boolean
}

const CURRENCIES = ["CRC", "USD"]

const getCurrentMonthValue = () => {
  const date = new Date()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  return `${date.getFullYear()}-${month}`
}

const createDefaultState = (): BudgetCreationState => ({
  month: getCurrentMonthValue(),
  currency: "CRC",
  grossSalaryInput: "",
  ccssEnabled: true,
  taxEnabled: true,
  fxEnabled: false,
  fxAmountInput: "",
  copyFromPrevious: false,
})

export function NewBudgetDialog({ open, onOpenChange }: NewBudgetDialogProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [state, setState] = React.useState<BudgetCreationState>(createDefaultState)
  const [error, setError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [payrollLoading, setPayrollLoading] = React.useState(false)
  const [payrollError, setPayrollError] = React.useState<string | null>(null)
  const [payrollPreview, setPayrollPreview] = React.useState<Awaited<
    ReturnType<typeof calculateNetSalary>
  > | null>(null)

  const updateState = React.useCallback((patch: Partial<BudgetCreationState>) => {
    setState((current) => ({ ...current, ...patch }))
  }, [])

  const grossSalary = Number.parseFloat(state.grossSalaryInput)
  const isGrossSalaryValid = Number.isFinite(grossSalary) && grossSalary > 0
  const fxAmount = Number.parseFloat(state.fxAmountInput)
  const isFxAmountValid =
    !state.fxEnabled || (Number.isFinite(fxAmount) && !Number.isNaN(fxAmount) && fxAmount >= 0)
  const periodDate = state.month ? `${state.month}-01` : ""
  const payrollAvailable = state.currency === "CRC"
  const payrollRulesLabel = payrollAvailable && state.month ? `CR ${state.month.slice(0, 4)}` : null
  const automaticDeductionsSelected = state.ccssEnabled || state.taxEnabled
  const adjustedIncome = calculateBudgetIncomeAdjustments({
    originalIncome: isGrossSalaryValid ? grossSalary : 0,
    applyCcss: state.ccssEnabled,
    ccssAmount: payrollPreview?.ccssWorkerAmount ?? 0,
    applyIncomeTax: state.taxEnabled,
    incomeTaxAmount: payrollPreview?.incomeTaxAmount ?? 0,
    applyExchangeLoss: state.fxEnabled,
    exchangeLossAmount: state.fxEnabled && isFxAmountValid ? fxAmount : 0,
  })
  const finalBudgetIncome = adjustedIncome.finalIncome
  const finalBudgetIncomeIsValid = finalBudgetIncome > 0
  const canSubmit = Boolean(
    state.month &&
    state.currency &&
    isGrossSalaryValid &&
    isFxAmountValid &&
    finalBudgetIncomeIsValid &&
    !isSubmitting &&
    (!payrollAvailable ||
      !automaticDeductionsSelected ||
      (!!payrollPreview && !payrollLoading && !payrollError)),
  )

  const resetState = React.useCallback(() => {
    setState(createDefaultState())
    setError(null)
    setPayrollLoading(false)
    setPayrollError(null)
    setPayrollPreview(null)
  }, [])

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen)
      if (!nextOpen) {
        resetState()
      }
    },
    [onOpenChange, resetState],
  )

  React.useEffect(() => {
    if (payrollAvailable) return

    setState((current) =>
      current.ccssEnabled || current.taxEnabled
        ? { ...current, ccssEnabled: false, taxEnabled: false }
        : current,
    )
    setPayrollLoading(false)
    setPayrollError(null)
    setPayrollPreview(null)
  }, [payrollAvailable])

  React.useEffect(() => {
    if (!open) return

    if (!payrollAvailable || !isGrossSalaryValid || !periodDate) {
      setPayrollLoading(false)
      setPayrollError(null)
      setPayrollPreview(null)
      return
    }

    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      setPayrollLoading(true)
      setPayrollError(null)

      void calculateNetSalary({
        grossSalary,
        periodDate,
      })
        .then((result) => {
          if (cancelled) return
          setPayrollPreview(result)
        })
        .catch((cause) => {
          if (cancelled) return
          setPayrollPreview(null)
          setPayrollError(
            cause instanceof Error ? cause.message : "Failed to load payroll preview.",
          )
        })
        .finally(() => {
          if (cancelled) return
          setPayrollLoading(false)
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [open, payrollAvailable, isGrossSalaryValid, grossSalary, periodDate])

  const handleSubmit = async () => {
    if (!state.month || !state.currency || !isGrossSalaryValid) {
      setError("Enter a month, select a currency, and provide an original income greater than 0.")
      return
    }
    if (!isFxAmountValid) {
      setError("Exchange-rate reserve must be zero or greater.")
      return
    }
    if (
      payrollAvailable &&
      automaticDeductionsSelected &&
      (!payrollPreview || payrollLoading || payrollError)
    ) {
      setError(payrollError || "Payroll deductions are still being resolved.")
      return
    }
    if (!finalBudgetIncomeIsValid) {
      setError("The final budget income must be greater than 0 after deductions.")
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      const payrollReferenceIds = buildBudgetPayrollReferenceIds({
        applyCcss: state.ccssEnabled,
        applyIncomeTax: state.taxEnabled,
        ccssRuleSetId: payrollPreview?.ccssRuleSetId ?? null,
        incomeTaxRuleSetId: payrollPreview?.incomeTaxRuleSetId ?? null,
      })

      const createdBudget = await createBudget({
        month: state.month,
        currency: state.currency,
        totalIncome: finalBudgetIncome,
        ccssRuleSetId: payrollReferenceIds.ccssRuleSetId,
        incomeTaxRuleSetId: payrollReferenceIds.incomeTaxRuleSetId,
      })

      if (state.copyFromPrevious) {
        try {
          await copyBudgetFromPrevious(createdBudget.id)
          toast({
            title: "Budget created",
            description: "Budget lines were copied from the previous month.",
          })
        } catch (copyError) {
          const message =
            copyError instanceof BudgetApiError
              ? copyError.message
              : "Budget created, but previous lines could not be copied."
          toast({
            title: "Budget created",
            description: message,
          })
        }
      } else {
        toast({
          title: "Budget created",
          description: "Your new budget is ready for planning.",
        })
      }

      handleOpenChange(false)
      router.push(`/budgets/${createdBudget.id}`)
    } catch (submitError) {
      if (submitError instanceof BudgetApiError) {
        const alreadyExists = submitError.details.some((detail) => detail.field.includes("month"))
        setError(
          alreadyExists
            ? "A budget already exists for that month and currency."
            : submitError.message,
        )
        return
      }

      setError("Budget could not be created right now.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const budgetBuilder = (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
        <BudgetIncomeForm
          month={state.month}
          currency={state.currency}
          grossSalaryInput={state.grossSalaryInput}
          currencies={CURRENCIES}
          onMonthChange={(value) => {
            updateState({ month: value })
            setError(null)
          }}
          onCurrencyChange={(value) => {
            updateState({ currency: value })
            setError(null)
          }}
          onGrossSalaryChange={(value) => {
            updateState({ grossSalaryInput: value })
            setError(null)
          }}
        />

        <BudgetSummaryCard
          currency={state.currency}
          grossSalary={isGrossSalaryValid ? grossSalary : 0}
          ccssDeduction={adjustedIncome.ccssDeduction}
          incomeTaxDeduction={adjustedIncome.incomeTaxDeduction}
          exchangeLossDeduction={adjustedIncome.exchangeLossDeduction}
          finalBudgetIncome={finalBudgetIncome}
          payrollAvailable={payrollAvailable}
          payrollLoading={payrollLoading}
          payrollRulesLabel={payrollRulesLabel}
          preview={payrollPreview}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
        <AutomaticDeductionsCard
          currency={state.currency}
          payrollAvailable={payrollAvailable}
          payrollLoading={payrollLoading}
          payrollError={payrollError}
          payrollRulesLabel={payrollRulesLabel}
          preview={payrollPreview}
          ccssEnabled={state.ccssEnabled}
          taxEnabled={state.taxEnabled}
          onCcssToggle={(checked) => {
            updateState({ ccssEnabled: checked })
            setError(null)
          }}
          onTaxToggle={(checked) => {
            updateState({ taxEnabled: checked })
            setError(null)
          }}
        />

        <ManualAdjustmentsCard
          currency={state.currency}
          fxEnabled={state.fxEnabled}
          fxAmountInput={state.fxAmountInput}
          fxAmount={state.fxEnabled && isFxAmountValid ? fxAmount : 0}
          isFxAmountValid={isFxAmountValid}
          onFxToggle={(checked) => {
            updateState({ fxEnabled: checked })
            setError(null)
          }}
          onFxAmountChange={(value) => {
            updateState({ fxAmountInput: value })
            setError(null)
          }}
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
    </div>
  )

  const planningOptions = (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-border/70 bg-background/40 px-4 py-3">
      <Checkbox
        id="copy-from-previous"
        checked={state.copyFromPrevious}
        onCheckedChange={(checked) => updateState({ copyFromPrevious: Boolean(checked) })}
      />
      <div className="min-w-0 space-y-1">
        <Label htmlFor="copy-from-previous" className="font-medium">
          Copy lines from previous budget
        </Label>
        <p className="text-sm text-muted-foreground">
          Bring in the previous budget lines right after this budget is created.
        </p>
      </div>
    </div>
  )

  const actionButtons = (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
        Cancel
      </Button>
      <Button onClick={handleSubmit} disabled={!canSubmit}>
        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {isSubmitting ? "Creating..." : "Create Budget"}
      </Button>
    </div>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent className="h-[96vh] max-h-[96vh]">
          <DrawerHeader className="border-b px-6 pb-4 pt-5 text-left">
            <DrawerTitle>New Budget</DrawerTitle>
            <DrawerDescription>
              Simulate payroll deductions, add manual adjustments, and create the budget with the
              final amount.
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-6 py-6">{budgetBuilder}</div>

          <DrawerFooter className="border-t px-6 py-4">
            <div className="space-y-3">
              {planningOptions}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">{actionButtons}</div>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-4xl xl:max-w-5xl [grid-template-rows:auto_minmax(0,1fr)_auto]">
        <DialogHeader className="border-b px-5 py-5 text-left">
          <DialogTitle>New Budget</DialogTitle>
          <DialogDescription>
            Simulate payroll deductions, add manual adjustments, and create the budget with the
            final amount.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-5 py-5">{budgetBuilder}</div>

        <DialogFooter className="border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="hidden min-w-0 flex-1 pr-4 lg:block">{planningOptions}</div>
          {actionButtons}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
