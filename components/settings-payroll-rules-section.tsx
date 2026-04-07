"use client"

import { Calculator, Edit2, Landmark, Percent, Plus, RefreshCw, Trash2 } from "lucide-react"
import * as React from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/ui/use-toast"
import { formatCurrency } from "@/lib/currency-formatter"
import {
  createIncomeTaxBracketDraft,
  formatIncomeTaxBracketRange,
  formatPayrollRate,
  formatPayrollRuleWindow,
  getCostaRicaTodayDateValue,
  getPayrollTopTaxRate,
} from "@/lib/payroll-rule-helpers"
import {
  calculateNetSalary,
  createPayrollCcssRule,
  createPayrollIncomeTaxRule,
  deactivatePayrollRule,
  fetchActivePayrollRule,
  fetchPayrollRuleHistory,
  SettingsApiError,
  type NetSalaryCalculation,
  type PayrollRuleSet,
  updatePayrollRule,
} from "@/lib/settings-api"
import { cn } from "@/lib/utils"

type PayrollRuleEditorKind = "CCSS_WORKER" | "INCOME_TAX"

type PayrollRuleEditorState =
  | { kind: PayrollRuleEditorKind; mode: "create" }
  | { kind: PayrollRuleEditorKind; mode: "edit"; ruleId: number }

type CcssFormState = {
  name: string
  effectiveFrom: string
  effectiveTo: string
  isActive: boolean
  employeeRate: string
  employerRate: string
  baseType: string
}

type IncomeTaxBracketDraft = {
  key: string
  amountFrom: string
  amountTo: string
  taxRate: string
  isExempt: boolean
}

type IncomeTaxFormState = {
  name: string
  effectiveFrom: string
  effectiveTo: string
  isActive: boolean
  brackets: IncomeTaxBracketDraft[]
}

const DEFAULT_GROSS_SALARY = "1500000"

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback
const formatTimestamp = (value: string) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "Unavailable"

const createDraftKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const toNumberOrNull = (value: string) => {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const buildCcssForm = (date: string, template?: PayrollRuleSet | null): CcssFormState => ({
  name: template?.name ?? "",
  effectiveFrom: template?.effectiveFrom ?? date,
  effectiveTo: template?.effectiveTo ?? "",
  isActive: template?.isActive ?? true,
  employeeRate: template?.ccssDetail ? String(template.ccssDetail.employeeRate) : "0.1083",
  employerRate:
    template?.ccssDetail?.employerRate !== null && template?.ccssDetail?.employerRate !== undefined
      ? String(template.ccssDetail.employerRate)
      : "",
  baseType: template?.ccssDetail?.baseType ?? "GROSS_SALARY",
})

const buildIncomeTaxForm = (
  date: string,
  template?: PayrollRuleSet | null,
): IncomeTaxFormState => ({
  name: template?.name ?? "",
  effectiveFrom: template?.effectiveFrom ?? date,
  effectiveTo: template?.effectiveTo ?? "",
  isActive: template?.isActive ?? true,
  brackets:
    template && template.incomeTaxBrackets.length > 0
      ? template.incomeTaxBrackets.map((bracket) => ({
          key: createDraftKey(),
          amountFrom: String(bracket.amountFrom),
          amountTo: bracket.amountTo === null ? "" : String(bracket.amountTo),
          taxRate: String(bracket.taxRate),
          isExempt: bracket.isExempt,
        }))
      : [
          {
            key: createDraftKey(),
            ...createIncomeTaxBracketDraft(1, 0),
          },
        ].map((draft) => ({
          key: draft.key,
          amountFrom: draft.amountFrom,
          amountTo: draft.amountTo,
          taxRate: draft.taxRate,
          isExempt: draft.isExempt,
        })),
})

export function SettingsPayrollRulesSection() {
  const todayDate = React.useMemo(() => getCostaRicaTodayDateValue(), [])
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [activeRuleError, setActiveRuleError] = React.useState<string | null>(null)
  const [activeDate, setActiveDate] = React.useState(todayDate)
  const [ccssRules, setCcssRules] = React.useState<PayrollRuleSet[]>([])
  const [incomeTaxRules, setIncomeTaxRules] = React.useState<PayrollRuleSet[]>([])
  const [activeCcssRule, setActiveCcssRule] = React.useState<PayrollRuleSet | null>(null)
  const [activeIncomeTaxRule, setActiveIncomeTaxRule] = React.useState<PayrollRuleSet | null>(null)
  const [editor, setEditor] = React.useState<PayrollRuleEditorState | null>(null)
  const [ccssForm, setCcssForm] = React.useState<CcssFormState>(() => buildCcssForm(todayDate))
  const [incomeTaxForm, setIncomeTaxForm] = React.useState<IncomeTaxFormState>(() =>
    buildIncomeTaxForm(todayDate),
  )
  const [editorError, setEditorError] = React.useState<string | null>(null)
  const [savingEditor, setSavingEditor] = React.useState(false)
  const [deactivatingRuleId, setDeactivatingRuleId] = React.useState<number | null>(null)
  const [simulatorForm, setSimulatorForm] = React.useState({
    grossSalary: DEFAULT_GROSS_SALARY,
    periodDate: todayDate,
  })
  const [simulating, setSimulating] = React.useState(false)
  const [simulationError, setSimulationError] = React.useState<string | null>(null)
  const [simulation, setSimulation] = React.useState<NetSalaryCalculation | null>(null)

  const latestCcssRule = ccssRules[0] ?? null
  const latestIncomeTaxRule = incomeTaxRules[0] ?? null
  const totalRuleVersions = ccssRules.length + incomeTaxRules.length

  const resolveActiveRules = React.useCallback(async (date: string) => {
    const [ccssResult, incomeTaxResult] = await Promise.allSettled([
      fetchActivePayrollRule("CCSS_WORKER", date),
      fetchActivePayrollRule("INCOME_TAX", date),
    ])

    const getRuleOrNull = (result: PromiseSettledResult<PayrollRuleSet>) => {
      if (result.status === "fulfilled") return result.value
      if (result.reason instanceof SettingsApiError && result.reason.status === 404) return null
      throw result.reason
    }

    try {
      setActiveRuleError(null)
      setActiveCcssRule(getRuleOrNull(ccssResult))
      setActiveIncomeTaxRule(getRuleOrNull(incomeTaxResult))
    } catch (cause) {
      setActiveCcssRule(null)
      setActiveIncomeTaxRule(null)
      setActiveRuleError(messageOf(cause, "Failed to resolve the active payroll rules."))
    }
  }, [])

  const loadRules = React.useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      try {
        if (silent) {
          setRefreshing(true)
        } else {
          setLoading(true)
        }
        setError(null)

        const [ccssHistory, incomeTaxHistory] = await Promise.all([
          fetchPayrollRuleHistory({ type: "CCSS_WORKER" }),
          fetchPayrollRuleHistory({ type: "INCOME_TAX" }),
        ])

        setCcssRules(ccssHistory.items)
        setIncomeTaxRules(incomeTaxHistory.items)
        await resolveActiveRules(activeDate)
      } catch (cause) {
        setError(messageOf(cause, "Failed to load payroll rules."))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [activeDate, resolveActiveRules],
  )

  React.useEffect(() => {
    void loadRules()
  }, [loadRules])

  React.useEffect(() => {
    if (loading) return
    void resolveActiveRules(activeDate)
  }, [activeDate, loading, resolveActiveRules])

  const resetEditor = React.useCallback(() => {
    setEditor(null)
    setEditorError(null)
    setCcssForm(buildCcssForm(activeDate, latestCcssRule))
    setIncomeTaxForm(buildIncomeTaxForm(activeDate, latestIncomeTaxRule))
  }, [activeDate, latestCcssRule, latestIncomeTaxRule])

  const openCreateEditor = (kind: PayrollRuleEditorKind) => {
    setEditor({ kind, mode: "create" })
    setEditorError(null)

    if (kind === "CCSS_WORKER") {
      setCcssForm(buildCcssForm(activeDate, latestCcssRule))
      return
    }

    setIncomeTaxForm(buildIncomeTaxForm(activeDate, latestIncomeTaxRule))
  }

  const openEditEditor = (rule: PayrollRuleSet) => {
    setEditor({
      kind: rule.ruleType,
      mode: "edit",
      ruleId: rule.id,
    })
    setEditorError(null)

    if (rule.ruleType === "CCSS_WORKER") {
      setCcssForm(buildCcssForm(activeDate, rule))
      return
    }

    setIncomeTaxForm(buildIncomeTaxForm(activeDate, rule))
  }

  const handleAddBracket = () => {
    setIncomeTaxForm((current) => {
      const previous = current.brackets[current.brackets.length - 1]
      const nextAmountFrom = previous ? previous.amountTo || previous.amountFrom : "0"

      return {
        ...current,
        brackets: [
          ...current.brackets,
          {
            key: createDraftKey(),
            amountFrom: nextAmountFrom,
            amountTo: "",
            taxRate: "0",
            isExempt: false,
          },
        ],
      }
    })
  }

  const handleRemoveBracket = (key: string) => {
    setIncomeTaxForm((current) => ({
      ...current,
      brackets: current.brackets.filter((bracket) => bracket.key !== key),
    }))
  }

  const handleSaveCcssRule = async () => {
    const employeeRate = Number(ccssForm.employeeRate)
    const employerRate = toNumberOrNull(ccssForm.employerRate)

    if (!ccssForm.name.trim()) {
      setEditorError("Rule name is required.")
      return
    }
    if (!ccssForm.effectiveFrom) {
      setEditorError("Effective from date is required.")
      return
    }
    if (ccssForm.effectiveTo && ccssForm.effectiveTo < ccssForm.effectiveFrom) {
      setEditorError("Effective to date cannot be earlier than effective from.")
      return
    }
    if (!Number.isFinite(employeeRate) || employeeRate < 0 || employeeRate > 1) {
      setEditorError("Employee rate must be between 0 and 1.")
      return
    }
    if (employerRate !== null && (employerRate < 0 || employerRate > 1)) {
      setEditorError("Employer rate must be between 0 and 1 when provided.")
      return
    }

    try {
      setSavingEditor(true)
      setEditorError(null)

      if (editor?.mode === "edit" && editor.kind === "CCSS_WORKER") {
        await updatePayrollRule(editor.ruleId, {
          name: ccssForm.name,
          effectiveFrom: ccssForm.effectiveFrom,
          effectiveTo: ccssForm.effectiveTo || null,
          isActive: ccssForm.isActive,
          employeeRate,
          employerRate,
          baseType: ccssForm.baseType,
        })
        toast({
          title: "CCSS rule updated",
          description: `${ccssForm.name} is now saved.`,
        })
      } else {
        await createPayrollCcssRule({
          name: ccssForm.name,
          effectiveFrom: ccssForm.effectiveFrom,
          effectiveTo: ccssForm.effectiveTo || null,
          isActive: ccssForm.isActive,
          employeeRate,
          employerRate,
          baseType: ccssForm.baseType,
        })
        toast({
          title: "CCSS rule created",
          description: `${ccssForm.name} was added to the payroll rule history.`,
        })
      }

      await loadRules({ silent: true })
      resetEditor()
    } catch (cause) {
      setEditorError(messageOf(cause, "Failed to save the CCSS rule."))
    } finally {
      setSavingEditor(false)
    }
  }

  const handleSaveIncomeTaxRule = async () => {
    if (!incomeTaxForm.name.trim()) {
      setEditorError("Rule name is required.")
      return
    }
    if (!incomeTaxForm.effectiveFrom) {
      setEditorError("Effective from date is required.")
      return
    }
    if (incomeTaxForm.effectiveTo && incomeTaxForm.effectiveTo < incomeTaxForm.effectiveFrom) {
      setEditorError("Effective to date cannot be earlier than effective from.")
      return
    }
    if (incomeTaxForm.brackets.length === 0) {
      setEditorError("At least one tax bracket is required.")
      return
    }

    const parsedBrackets = []

    for (const [index, bracket] of incomeTaxForm.brackets.entries()) {
      const amountFrom = Number(bracket.amountFrom)
      const amountTo = toNumberOrNull(bracket.amountTo)
      const taxRate = Number(bracket.taxRate)

      if (!Number.isFinite(amountFrom) || amountFrom < 0) {
        setEditorError(`Bracket ${index + 1} requires a valid amount from.`)
        return
      }
      if (amountTo !== null && amountTo <= amountFrom) {
        setEditorError(`Bracket ${index + 1} must end after its amount from.`)
        return
      }
      if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 1) {
        setEditorError(`Bracket ${index + 1} requires a tax rate between 0 and 1.`)
        return
      }
      if (index === 0 && amountFrom !== 0) {
        setEditorError("The first tax bracket must start at 0.")
        return
      }
      if (index < incomeTaxForm.brackets.length - 1 && amountTo === null) {
        setEditorError("Only the last tax bracket can be open-ended.")
        return
      }
      if (bracket.isExempt && taxRate !== 0) {
        setEditorError(`Bracket ${index + 1} is exempt and must use a 0 tax rate.`)
        return
      }

      parsedBrackets.push({
        rangeOrder: index + 1,
        amountFrom,
        amountTo,
        taxRate,
        isExempt: bracket.isExempt,
      })
    }

    try {
      setSavingEditor(true)
      setEditorError(null)

      if (editor?.mode === "edit" && editor.kind === "INCOME_TAX") {
        await updatePayrollRule(editor.ruleId, {
          name: incomeTaxForm.name,
          effectiveFrom: incomeTaxForm.effectiveFrom,
          effectiveTo: incomeTaxForm.effectiveTo || null,
          isActive: incomeTaxForm.isActive,
          brackets: parsedBrackets,
        })
        toast({
          title: "Income tax rule updated",
          description: `${incomeTaxForm.name} is now saved.`,
        })
      } else {
        await createPayrollIncomeTaxRule({
          name: incomeTaxForm.name,
          effectiveFrom: incomeTaxForm.effectiveFrom,
          effectiveTo: incomeTaxForm.effectiveTo || null,
          isActive: incomeTaxForm.isActive,
          brackets: parsedBrackets,
        })
        toast({
          title: "Income tax rule created",
          description: `${incomeTaxForm.name} was added to the payroll rule history.`,
        })
      }

      await loadRules({ silent: true })
      resetEditor()
    } catch (cause) {
      setEditorError(messageOf(cause, "Failed to save the income tax rule."))
    } finally {
      setSavingEditor(false)
    }
  }

  const handleDeactivateRule = async (rule: PayrollRuleSet) => {
    try {
      setDeactivatingRuleId(rule.id)
      await deactivatePayrollRule(rule.id)
      toast({
        title: "Rule deactivated",
        description: `${rule.name} is now inactive.`,
      })
      await loadRules({ silent: true })
      if (editor?.mode === "edit" && editor.ruleId === rule.id) {
        resetEditor()
      }
    } catch (cause) {
      toast({
        title: "Unable to deactivate rule",
        description: messageOf(cause, "Failed to deactivate the payroll rule."),
        variant: "destructive",
      })
    } finally {
      setDeactivatingRuleId(null)
    }
  }

  const handleSimulate = async () => {
    const grossSalary = Number(simulatorForm.grossSalary)

    if (!Number.isFinite(grossSalary) || grossSalary <= 0) {
      setSimulationError("Gross salary must be greater than zero.")
      return
    }
    if (!simulatorForm.periodDate) {
      setSimulationError("Period date is required.")
      return
    }

    try {
      setSimulating(true)
      setSimulationError(null)
      const result = await calculateNetSalary({
        grossSalary,
        periodDate: simulatorForm.periodDate,
      })
      setSimulation(result)
    } catch (cause) {
      setSimulation(null)
      setSimulationError(messageOf(cause, "Failed to calculate the net salary."))
    } finally {
      setSimulating(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payroll Rules</CardTitle>
          <CardDescription>Loading payroll history and simulator.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold tracking-tight">Payroll Rules</h3>
          <p className="text-sm text-muted-foreground">
            Manage versioned CCSS and income tax rules, and simulate Costa Rica net salary by period
            date.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
            <Label htmlFor="payroll-active-date" className="text-xs text-muted-foreground">
              Active on
            </Label>
            <Input
              id="payroll-active-date"
              type="date"
              value={activeDate}
              onChange={(event) => setActiveDate(event.target.value)}
              className="h-8 w-[160px] border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
            />
          </div>
          <Button type="button" variant="outline" onClick={() => void loadRules({ silent: true })}>
            <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <Alert>
          <AlertTitle>Payroll unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {activeRuleError ? (
        <Alert>
          <AlertTitle>Active rule lookup failed</AlertTitle>
          <AlertDescription>{activeRuleError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-cyan-500/20 bg-cyan-500/5">
          <CardHeader className="pb-3">
            <CardDescription>CCSS active on {activeDate}</CardDescription>
            <CardTitle className="text-lg">
              {activeCcssRule?.name ?? "No active CCSS rule"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Employee rate</span>
              <span className="font-medium">
                {activeCcssRule?.ccssDetail
                  ? formatPayrollRate(activeCcssRule.ccssDetail.employeeRate)
                  : "Unavailable"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Window</span>
              <span className="font-medium">
                {activeCcssRule ? formatPayrollRuleWindow(activeCcssRule) : "No match"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="pb-3">
            <CardDescription>Income tax active on {activeDate}</CardDescription>
            <CardTitle className="text-lg">
              {activeIncomeTaxRule?.name ?? "No active tax rule"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Brackets</span>
              <span className="font-medium">
                {activeIncomeTaxRule?.incomeTaxBrackets.length ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Top rate</span>
              <span className="font-medium">
                {activeIncomeTaxRule
                  ? formatPayrollRate(getPayrollTopTaxRate(activeIncomeTaxRule.incomeTaxBrackets))
                  : "Unavailable"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Versioned coverage</CardDescription>
            <CardTitle className="text-lg">{totalRuleVersions} total rule versions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">CCSS versions</span>
              <span className="font-medium">{ccssRules.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Income tax versions</span>
              <span className="font-medium">{incomeTaxRules.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>CCSS Worker History</CardTitle>
                <CardDescription>
                  Versioned worker contribution rates used to calculate payroll deductions.
                </CardDescription>
              </div>
              <Button type="button" onClick={() => openCreateEditor("CCSS_WORKER")}>
                <Plus className="mr-2 h-4 w-4" />
                New Version
              </Button>
            </CardHeader>
            <CardContent>
              {ccssRules.length === 0 ? (
                <Alert>
                  <AlertTitle>No CCSS rules</AlertTitle>
                  <AlertDescription>
                    Create the first worker contribution rule version.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Effective Window</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ccssRules.map((rule) => {
                        const isSelectedDateRule = activeCcssRule?.id === rule.id
                        return (
                          <TableRow
                            key={rule.id}
                            className={cn(isSelectedDateRule && "bg-cyan-500/5")}
                          >
                            <TableCell className="min-w-60">
                              <div className="space-y-1">
                                <p className="font-medium">{rule.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Updated {formatTimestamp(rule.updatedAt || rule.createdAt)}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {rule.ccssDetail
                                ? formatPayrollRate(rule.ccssDetail.employeeRate)
                                : "Unavailable"}
                            </TableCell>
                            <TableCell>{formatPayrollRuleWindow(rule)}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant={rule.isActive ? "secondary" : "outline"}>
                                  {rule.isActive ? "Active" : "Inactive"}
                                </Badge>
                                {isSelectedDateRule ? (
                                  <Badge variant="outline">Selected date</Badge>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditEditor(rule)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={deactivatingRuleId === rule.id}
                                  onClick={() => void handleDeactivateRule(rule)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Income Tax History</CardTitle>
                <CardDescription>
                  Progressive salary tax brackets with explicit versioning and validity windows.
                </CardDescription>
              </div>
              <Button type="button" onClick={() => openCreateEditor("INCOME_TAX")}>
                <Plus className="mr-2 h-4 w-4" />
                New Version
              </Button>
            </CardHeader>
            <CardContent>
              {incomeTaxRules.length === 0 ? (
                <Alert>
                  <AlertTitle>No income tax rules</AlertTitle>
                  <AlertDescription>
                    Create the first progressive tax rule version.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Brackets</TableHead>
                        <TableHead>Top Rate</TableHead>
                        <TableHead>Effective Window</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incomeTaxRules.map((rule) => {
                        const isSelectedDateRule = activeIncomeTaxRule?.id === rule.id
                        return (
                          <TableRow
                            key={rule.id}
                            className={cn(isSelectedDateRule && "bg-emerald-500/5")}
                          >
                            <TableCell className="min-w-60">
                              <div className="space-y-1">
                                <p className="font-medium">{rule.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Updated {formatTimestamp(rule.updatedAt || rule.createdAt)}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>{rule.incomeTaxBrackets.length}</TableCell>
                            <TableCell>
                              {formatPayrollRate(getPayrollTopTaxRate(rule.incomeTaxBrackets))}
                            </TableCell>
                            <TableCell>{formatPayrollRuleWindow(rule)}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant={rule.isActive ? "secondary" : "outline"}>
                                  {rule.isActive ? "Active" : "Inactive"}
                                </Badge>
                                {isSelectedDateRule ? (
                                  <Badge variant="outline">Selected date</Badge>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditEditor(rule)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={deactivatingRuleId === rule.id}
                                  onClick={() => void handleDeactivateRule(rule)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {editor
                  ? editor.kind === "CCSS_WORKER"
                    ? editor.mode === "edit"
                      ? "Edit CCSS Rule"
                      : "New CCSS Rule"
                    : editor.mode === "edit"
                      ? "Edit Income Tax Rule"
                      : "New Income Tax Rule"
                  : "Payroll Rule Editor"}
              </CardTitle>
              <CardDescription>
                {editor
                  ? editor.kind === "CCSS_WORKER"
                    ? "Use this form to maintain CCSS worker rate versions."
                    : "Use this form to maintain progressive salary tax brackets."
                  : "Choose a rule from the history table or create a new version."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!editor ? (
                <Alert>
                  <AlertTitle>No rule selected</AlertTitle>
                  <AlertDescription>
                    Pick a version from the history or create a new one to start editing.
                  </AlertDescription>
                </Alert>
              ) : editor.kind === "CCSS_WORKER" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="ccss-rule-name">Rule name</Label>
                    <Input
                      id="ccss-rule-name"
                      value={ccssForm.name}
                      onChange={(event) =>
                        setCcssForm((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="CCSS Worker 2027"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ccss-effective-from">Effective from</Label>
                      <Input
                        id="ccss-effective-from"
                        type="date"
                        value={ccssForm.effectiveFrom}
                        onChange={(event) =>
                          setCcssForm((current) => ({
                            ...current,
                            effectiveFrom: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ccss-effective-to">Effective to</Label>
                      <Input
                        id="ccss-effective-to"
                        type="date"
                        value={ccssForm.effectiveTo}
                        onChange={(event) =>
                          setCcssForm((current) => ({
                            ...current,
                            effectiveTo: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ccss-employee-rate">Employee rate</Label>
                      <Input
                        id="ccss-employee-rate"
                        type="number"
                        min="0"
                        max="1"
                        step="0.0001"
                        value={ccssForm.employeeRate}
                        onChange={(event) =>
                          setCcssForm((current) => ({
                            ...current,
                            employeeRate: event.target.value,
                          }))
                        }
                        placeholder="0.1083"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ccss-employer-rate">Employer rate</Label>
                      <Input
                        id="ccss-employer-rate"
                        type="number"
                        min="0"
                        max="1"
                        step="0.0001"
                        value={ccssForm.employerRate}
                        onChange={(event) =>
                          setCcssForm((current) => ({
                            ...current,
                            employerRate: event.target.value,
                          }))
                        }
                        placeholder="Optional"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ccss-base-type">Base type</Label>
                    <Input
                      id="ccss-base-type"
                      value={ccssForm.baseType}
                      onChange={(event) =>
                        setCcssForm((current) => ({
                          ...current,
                          baseType: event.target.value.toUpperCase(),
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div>
                      <p className="font-medium">Active version</p>
                      <p className="text-sm text-muted-foreground">
                        Inactive versions stay visible in historical reports and settings.
                      </p>
                    </div>
                    <Switch
                      checked={ccssForm.isActive}
                      onCheckedChange={(checked) =>
                        setCcssForm((current) => ({ ...current, isActive: checked }))
                      }
                    />
                  </div>

                  {editorError ? <p className="text-sm text-destructive">{editorError}</p> : null}

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={resetEditor}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleSaveCcssRule()}
                      disabled={savingEditor}
                    >
                      {editor.mode === "edit" ? "Save Rule" : "Create Rule"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="income-tax-rule-name">Rule name</Label>
                    <Input
                      id="income-tax-rule-name"
                      value={incomeTaxForm.name}
                      onChange={(event) =>
                        setIncomeTaxForm((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="Income Tax 2027"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="income-tax-effective-from">Effective from</Label>
                      <Input
                        id="income-tax-effective-from"
                        type="date"
                        value={incomeTaxForm.effectiveFrom}
                        onChange={(event) =>
                          setIncomeTaxForm((current) => ({
                            ...current,
                            effectiveFrom: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="income-tax-effective-to">Effective to</Label>
                      <Input
                        id="income-tax-effective-to"
                        type="date"
                        value={incomeTaxForm.effectiveTo}
                        onChange={(event) =>
                          setIncomeTaxForm((current) => ({
                            ...current,
                            effectiveTo: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div>
                      <p className="font-medium">Active version</p>
                      <p className="text-sm text-muted-foreground">
                        Deactivated versions remain available for historical lookups.
                      </p>
                    </div>
                    <Switch
                      checked={incomeTaxForm.isActive}
                      onCheckedChange={(checked) =>
                        setIncomeTaxForm((current) => ({ ...current, isActive: checked }))
                      }
                    />
                  </div>

                  <div className="rounded-lg border bg-muted/10 p-3 text-sm text-muted-foreground">
                    Brackets use a contiguous lower-inclusive, upper-exclusive convention:{" "}
                    <span className="font-medium text-foreground">[amount_from, amount_to)</span>.
                    Leave the last <span className="font-medium text-foreground">amount to</span>{" "}
                    empty for the open-ended bracket.
                  </div>

                  <div className="space-y-3">
                    {incomeTaxForm.brackets.map((bracket, index) => (
                      <div key={bracket.key} className="rounded-xl border p-3">
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <p className="font-medium">Bracket {index + 1}</p>
                            <p className="text-xs text-muted-foreground">
                              The UI keeps range order sequential automatically.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveBracket(bracket.key)}
                            disabled={incomeTaxForm.brackets.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor={`bracket-from-${bracket.key}`}>Amount from</Label>
                            <Input
                              id={`bracket-from-${bracket.key}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={bracket.amountFrom}
                              onChange={(event) =>
                                setIncomeTaxForm((current) => ({
                                  ...current,
                                  brackets: current.brackets.map((item) =>
                                    item.key === bracket.key
                                      ? { ...item, amountFrom: event.target.value }
                                      : item,
                                  ),
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`bracket-to-${bracket.key}`}>Amount to</Label>
                            <Input
                              id={`bracket-to-${bracket.key}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={bracket.amountTo}
                              onChange={(event) =>
                                setIncomeTaxForm((current) => ({
                                  ...current,
                                  brackets: current.brackets.map((item) =>
                                    item.key === bracket.key
                                      ? { ...item, amountTo: event.target.value }
                                      : item,
                                  ),
                                }))
                              }
                              placeholder={
                                index === incomeTaxForm.brackets.length - 1 ? "Open ended" : ""
                              }
                            />
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                          <div className="space-y-2">
                            <Label htmlFor={`bracket-rate-${bracket.key}`}>Tax rate</Label>
                            <Input
                              id={`bracket-rate-${bracket.key}`}
                              type="number"
                              min="0"
                              max="1"
                              step="0.0001"
                              value={bracket.taxRate}
                              onChange={(event) =>
                                setIncomeTaxForm((current) => ({
                                  ...current,
                                  brackets: current.brackets.map((item) =>
                                    item.key === bracket.key
                                      ? { ...item, taxRate: event.target.value }
                                      : item,
                                  ),
                                }))
                              }
                              disabled={bracket.isExempt}
                            />
                          </div>
                          <div className="flex items-end">
                            <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
                              <div>
                                <p className="font-medium">Exempt</p>
                                <p className="text-xs text-muted-foreground">
                                  For the tax-free range.
                                </p>
                              </div>
                              <Switch
                                checked={bracket.isExempt}
                                onCheckedChange={(checked) =>
                                  setIncomeTaxForm((current) => ({
                                    ...current,
                                    brackets: current.brackets.map((item) =>
                                      item.key === bracket.key
                                        ? {
                                            ...item,
                                            isExempt: checked,
                                            taxRate: checked ? "0" : item.taxRate,
                                          }
                                        : item,
                                    ),
                                  }))
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button type="button" variant="outline" onClick={handleAddBracket}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Bracket
                  </Button>

                  {editorError ? <p className="text-sm text-destructive">{editorError}</p> : null}

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={resetEditor}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleSaveIncomeTaxRule()}
                      disabled={savingEditor}
                    >
                      {editor.mode === "edit" ? "Save Rule" : "Create Rule"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Net Salary Simulator</CardTitle>
              <CardDescription>
                Resolve the active rules for a date and preview CCSS, gross-salary tax base, income
                tax, and net salary.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="payroll-simulator-gross">Gross salary (CRC)</Label>
                  <Input
                    id="payroll-simulator-gross"
                    type="number"
                    min="0"
                    step="0.01"
                    value={simulatorForm.grossSalary}
                    onChange={(event) =>
                      setSimulatorForm((current) => ({
                        ...current,
                        grossSalary: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payroll-simulator-date">Period date</Label>
                  <Input
                    id="payroll-simulator-date"
                    type="date"
                    value={simulatorForm.periodDate}
                    onChange={(event) =>
                      setSimulatorForm((current) => ({
                        ...current,
                        periodDate: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <Button type="button" onClick={() => void handleSimulate()} disabled={simulating}>
                <Calculator className="mr-2 h-4 w-4" />
                Calculate Net Salary
              </Button>

              {simulationError ? (
                <p className="text-sm text-destructive">{simulationError}</p>
              ) : null}

              {!simulation ? (
                <Alert>
                  <AlertTitle>No simulation yet</AlertTitle>
                  <AlertDescription>
                    Run a calculation to preview the net salary breakdown and the rule versions
                    used.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Net salary
                      </p>
                      <p className="mt-2 text-xl font-semibold">
                        {formatCurrency(simulation.netSalary, "CRC")}
                      </p>
                    </div>
                    <div className="rounded-xl border p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Income tax
                      </p>
                      <p className="mt-2 text-xl font-semibold">
                        {formatCurrency(simulation.incomeTaxAmount, "CRC")}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Gross salary</span>
                      <span className="font-medium">
                        {formatCurrency(simulation.grossSalary, "CRC")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">CCSS worker rate</span>
                      <span className="font-medium">
                        {formatPayrollRate(simulation.ccssWorkerRate)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">CCSS worker amount</span>
                      <span className="font-medium">
                        {formatCurrency(simulation.ccssWorkerAmount, "CRC")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Income tax base (gross salary)</span>
                      <span className="font-medium">
                        {formatCurrency(simulation.taxableBase, "CRC")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">CCSS rule set id</span>
                      <span className="font-medium">#{simulation.ccssRuleSetId}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Income tax rule set id</span>
                      <span className="font-medium">#{simulation.incomeTaxRuleSetId}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border">
                    <div className="border-b px-3 py-2">
                      <p className="text-sm font-medium">Tax breakdown</p>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Bracket</TableHead>
                            <TableHead>Taxable amount</TableHead>
                            <TableHead>Rate</TableHead>
                            <TableHead className="text-right">Tax amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {simulation.taxBreakdown.map((line) => (
                            <TableRow key={line.rangeOrder}>
                              <TableCell>{line.rangeOrder}</TableCell>
                              <TableCell>{formatCurrency(line.taxableAmount, "CRC")}</TableCell>
                              <TableCell>{formatPayrollRate(line.taxRate)}</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(line.taxAmount, "CRC")}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rule Highlights</CardTitle>
              <CardDescription>
                Quick context for the versions selected by the current date lookup.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-xl border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Percent className="h-4 w-4 text-cyan-300" />
                  <p className="font-medium">CCSS</p>
                </div>
                {activeCcssRule ? (
                  <div className="space-y-2">
                    <p>{activeCcssRule.name}</p>
                    <p className="text-muted-foreground">
                      {formatPayrollRuleWindow(activeCcssRule)}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    No active CCSS rule for the selected date.
                  </p>
                )}
              </div>

              <div className="rounded-xl border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-emerald-300" />
                  <p className="font-medium">Income Tax</p>
                </div>
                {activeIncomeTaxRule ? (
                  <div className="space-y-3">
                    <p>{activeIncomeTaxRule.name}</p>
                    <div className="space-y-2">
                      {activeIncomeTaxRule.incomeTaxBrackets.map((bracket) => (
                        <div
                          key={bracket.id}
                          className="flex items-center justify-between rounded-lg border px-3 py-2"
                        >
                          <div>
                            <p className="font-medium">Bracket {bracket.rangeOrder}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatIncomeTaxBracketRange(bracket)}
                            </p>
                          </div>
                          <Badge variant="outline">
                            {bracket.isExempt ? "Exempt" : formatPayrollRate(bracket.taxRate)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    No active income tax rule for the selected date.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
