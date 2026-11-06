"use client"

import { Calculator, Edit2, Landmark, Percent, Plus, RefreshCw, Trash2 } from "lucide-react"
import * as React from "react"

import { AccessibleField, AccessibleFieldError } from "@/components/ui/accessible-field"
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
import { tryDecimalInput } from "@/lib/money"
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
    : "No disponible"

const createDraftKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const toNumberOrNull = (value: string) => {
  if (!value.trim()) return null
  const parsed = tryDecimalInput(value)
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
      setActiveRuleError(
        messageOf(cause, "No pudimos consultar las reglas de nómina vigentes. Vuelve a intentar."),
      )
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
        setError(messageOf(cause, "No pudimos cargar las reglas de nómina. Vuelve a intentar."))
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
    const employeeRate = tryDecimalInput(ccssForm.employeeRate)
    const employerRate = toNumberOrNull(ccssForm.employerRate)

    if (!ccssForm.name.trim()) {
      setEditorError("Introduce un nombre para la regla.")
      return
    }
    if (!ccssForm.effectiveFrom) {
      setEditorError("Elige la fecha de inicio de vigencia.")
      return
    }
    if (ccssForm.effectiveTo && ccssForm.effectiveTo < ccssForm.effectiveFrom) {
      setEditorError("La fecha final no puede ser anterior al inicio de vigencia.")
      return
    }
    if (!Number.isFinite(employeeRate) || employeeRate < 0 || employeeRate > 1) {
      setEditorError("La tasa del trabajador debe estar entre 0 y 1.")
      return
    }
    if (employerRate !== null && (employerRate < 0 || employerRate > 1)) {
      setEditorError("La tasa patronal debe estar entre 0 y 1 cuando se indique.")
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
          title: "Regla de CCSS actualizada",
          description: `${ccssForm.name} se guardó.`,
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
          title: "Regla de CCSS creada",
          description: `${ccssForm.name} se añadió al historial de reglas de nómina.`,
        })
      }

      await loadRules({ silent: true })
      resetEditor()
    } catch (cause) {
      setEditorError(
        messageOf(
          cause,
          "No pudimos guardar la regla de CCSS. Revisa los datos y vuelve a intentar.",
        ),
      )
    } finally {
      setSavingEditor(false)
    }
  }

  const handleSaveIncomeTaxRule = async () => {
    if (!incomeTaxForm.name.trim()) {
      setEditorError("Introduce un nombre para la regla.")
      return
    }
    if (!incomeTaxForm.effectiveFrom) {
      setEditorError("Elige la fecha de inicio de vigencia.")
      return
    }
    if (incomeTaxForm.effectiveTo && incomeTaxForm.effectiveTo < incomeTaxForm.effectiveFrom) {
      setEditorError("La fecha final no puede ser anterior al inicio de vigencia.")
      return
    }
    if (incomeTaxForm.brackets.length === 0) {
      setEditorError("Añade al menos un tramo de renta.")
      return
    }

    const parsedBrackets = []

    for (const [index, bracket] of incomeTaxForm.brackets.entries()) {
      const amountFrom = tryDecimalInput(bracket.amountFrom)
      const amountTo = toNumberOrNull(bracket.amountTo)
      const taxRate = tryDecimalInput(bracket.taxRate)

      if (!Number.isFinite(amountFrom) || amountFrom < 0) {
        setEditorError(`Tramo ${index + 1} requiere un importe inicial válido.`)
        return
      }
      if (amountTo !== null && amountTo <= amountFrom) {
        setEditorError(`Tramo ${index + 1} debe terminar después de su importe inicial.`)
        return
      }
      if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 1) {
        setEditorError(`Tramo ${index + 1} requiere una tasa entre 0 y 1.`)
        return
      }
      if (index === 0 && amountFrom !== 0) {
        setEditorError("El primer tramo debe comenzar en cero.")
        return
      }
      if (index < incomeTaxForm.brackets.length - 1 && amountTo === null) {
        setEditorError("Solo el último tramo puede quedar sin límite superior.")
        return
      }
      if (bracket.isExempt && taxRate !== 0) {
        setEditorError(`Tramo ${index + 1} está exento y debe tener tasa cero.`)
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
          title: "Regla de renta actualizada",
          description: `${incomeTaxForm.name} se guardó.`,
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
          title: "Regla de renta creada",
          description: `${incomeTaxForm.name} se añadió al historial de reglas de nómina.`,
        })
      }

      await loadRules({ silent: true })
      resetEditor()
    } catch (cause) {
      setEditorError(
        messageOf(
          cause,
          "No pudimos guardar la regla de renta. Revisa los datos y vuelve a intentar.",
        ),
      )
    } finally {
      setSavingEditor(false)
    }
  }

  const handleDeactivateRule = async (rule: PayrollRuleSet) => {
    try {
      setDeactivatingRuleId(rule.id)
      await deactivatePayrollRule(rule.id)
      toast({
        title: "Regla desactivada",
        description: `${rule.name} está inactiva.`,
      })
      await loadRules({ silent: true })
      if (editor?.mode === "edit" && editor.ruleId === rule.id) {
        resetEditor()
      }
    } catch (cause) {
      toast({
        title: "No se pudo desactivar la regla",
        description: messageOf(
          cause,
          "No pudimos desactivar la regla de nómina. Vuelve a intentar.",
        ),
        variant: "destructive",
      })
    } finally {
      setDeactivatingRuleId(null)
    }
  }

  const handleSimulate = async () => {
    const grossSalary = tryDecimalInput(simulatorForm.grossSalary)

    if (!Number.isFinite(grossSalary) || grossSalary <= 0) {
      setSimulationError("El salario bruto debe ser mayor que cero.")
      return
    }
    if (!simulatorForm.periodDate) {
      setSimulationError("Elige la fecha del período.")
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
      setSimulationError(
        messageOf(
          cause,
          "No pudimos calcular el salario neto. Revisa los datos y vuelve a intentar.",
        ),
      )
    } finally {
      setSimulating(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reglas de nómina</CardTitle>
          <CardDescription>Cargando historial y calculadora de nómina.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold tracking-tight">Reglas de nómina</h3>
          <p className="text-sm text-muted-foreground">
            Administra versiones de CCSS e impuesto sobre la renta y calcula el salario neto para
            una fecha en Costa Rica.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AccessibleField className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
            <Label htmlFor="payroll-active-date" className="text-xs text-muted-foreground">
              Vigentes al
            </Label>
            <Input
              id="payroll-active-date"
              type="date"
              value={activeDate}
              onChange={(event) => setActiveDate(event.target.value)}
              className="h-8 w-full min-w-0 border-0 sm:w-[160px] bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
            />
          </AccessibleField>
          <Button type="button" variant="outline" onClick={() => void loadRules({ silent: true })}>
            <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
            Actualizar
          </Button>
        </div>
      </div>

      {error ? (
        <Alert>
          <AlertTitle>Nómina no disponible</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {activeRuleError ? (
        <Alert>
          <AlertTitle>No pudimos consultar las reglas vigentes</AlertTitle>
          <AlertDescription>{activeRuleError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-transparent bg-[var(--marea-teal)] text-[var(--marea-teal-ink)]">
          <CardHeader className="pb-3">
            <CardDescription>CCSS vigente al {activeDate}</CardDescription>
            <CardTitle className="text-lg">
              {activeCcssRule?.name ?? "No hay una regla de CCSS vigente"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">Tasa del trabajador</span>
              <span className="font-medium">
                {activeCcssRule?.ccssDetail
                  ? formatPayrollRate(activeCcssRule.ccssDetail.employeeRate)
                  : "No disponible"}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">Vigencia</span>
              <span className="font-medium">
                {activeCcssRule ? formatPayrollRuleWindow(activeCcssRule) : "Sin coincidencia"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardDescription>Renta vigente al {activeDate}</CardDescription>
            <CardTitle className="text-lg">
              {activeIncomeTaxRule?.name ?? "No hay una regla de renta vigente"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">Tramos</span>
              <span className="font-medium">
                {activeIncomeTaxRule?.incomeTaxBrackets.length ?? 0}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">Tasa máxima</span>
              <span className="font-medium">
                {activeIncomeTaxRule
                  ? formatPayrollRate(getPayrollTopTaxRate(activeIncomeTaxRule.incomeTaxBrackets))
                  : "No disponible"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Historial de versiones</CardDescription>
            <CardTitle className="text-lg">{totalRuleVersions} versiones de reglas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">Versiones de CCSS</span>
              <span className="font-medium">{ccssRules.length}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">Versiones de renta</span>
              <span className="font-medium">{incomeTaxRules.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle>Historial de aportes a la CCSS</CardTitle>
                <CardDescription>
                  Versiones de las tasas del trabajador utilizadas para calcular deducciones de
                  nómina.
                </CardDescription>
              </div>
              <Button type="button" onClick={() => openCreateEditor("CCSS_WORKER")}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva versión
              </Button>
            </CardHeader>
            <CardContent>
              {ccssRules.length === 0 ? (
                <Alert>
                  <AlertTitle>No hay reglas de CCSS</AlertTitle>
                  <AlertDescription>
                    Crea la primera versión del aporte del trabajador.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Tasa</TableHead>
                        <TableHead>Período de vigencia</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
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
                                  Actualizado {formatTimestamp(rule.updatedAt || rule.createdAt)}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {rule.ccssDetail
                                ? formatPayrollRate(rule.ccssDetail.employeeRate)
                                : "No disponible"}
                            </TableCell>
                            <TableCell>{formatPayrollRuleWindow(rule)}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant={rule.isActive ? "secondary" : "outline"}>
                                  {rule.isActive ? "Activo" : "Inactivo"}
                                </Badge>
                                {isSelectedDateRule ? (
                                  <Badge variant="outline">Fecha seleccionada</Badge>
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
            <CardHeader className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle>Historial de impuesto sobre la renta</CardTitle>
                <CardDescription>
                  Tramos progresivos del salario con versiones y períodos de vigencia.
                </CardDescription>
              </div>
              <Button type="button" onClick={() => openCreateEditor("INCOME_TAX")}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva versión
              </Button>
            </CardHeader>
            <CardContent>
              {incomeTaxRules.length === 0 ? (
                <Alert>
                  <AlertTitle>No hay reglas de renta</AlertTitle>
                  <AlertDescription>
                    Crea la primera versión de los tramos de renta.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Tramos</TableHead>
                        <TableHead>Tasa máxima</TableHead>
                        <TableHead>Período de vigencia</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
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
                                  Actualizado {formatTimestamp(rule.updatedAt || rule.createdAt)}
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
                                  {rule.isActive ? "Activo" : "Inactivo"}
                                </Badge>
                                {isSelectedDateRule ? (
                                  <Badge variant="outline">Fecha seleccionada</Badge>
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
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {editor
                  ? editor.kind === "CCSS_WORKER"
                    ? editor.mode === "edit"
                      ? "Editar regla de CCSS"
                      : "Nueva regla de CCSS"
                    : editor.mode === "edit"
                      ? "Editar regla de renta"
                      : "Nueva regla de renta"
                  : "Editar regla de nómina"}
              </CardTitle>
              <CardDescription>
                {editor
                  ? editor.kind === "CCSS_WORKER"
                    ? "Administra las versiones de la tasa del trabajador para la CCSS."
                    : "Administra los tramos progresivos del impuesto sobre la renta."
                  : "Elige una regla del historial o crea una nueva versión."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!editor ? (
                <Alert>
                  <AlertTitle>No hay una regla seleccionada</AlertTitle>
                  <AlertDescription>
                    Elige una versión del historial o crea una para comenzar.
                  </AlertDescription>
                </Alert>
              ) : editor.kind === "CCSS_WORKER" ? (
                <>
                  <AccessibleField className="space-y-2">
                    <Label htmlFor="ccss-rule-name">Nombre de la regla</Label>
                    <Input
                      id="ccss-rule-name"
                      value={ccssForm.name}
                      onChange={(event) =>
                        setCcssForm((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="Aporte CCSS 2027"
                    />
                  </AccessibleField>

                  <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
                    <AccessibleField className="space-y-2">
                      <Label htmlFor="ccss-effective-from">Vigente desde</Label>
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
                    </AccessibleField>
                    <AccessibleField className="space-y-2">
                      <Label htmlFor="ccss-effective-to">Vigente hasta</Label>
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
                    </AccessibleField>
                  </div>

                  <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
                    <AccessibleField className="space-y-2">
                      <Label htmlFor="ccss-employee-rate">Tasa del trabajador</Label>
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
                    </AccessibleField>
                    <AccessibleField className="space-y-2">
                      <Label htmlFor="ccss-employer-rate">Tasa patronal</Label>
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
                        placeholder="Opcional"
                      />
                    </AccessibleField>
                  </div>

                  <AccessibleField className="space-y-2">
                    <Label htmlFor="ccss-base-type">Base de cálculo</Label>
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
                  </AccessibleField>

                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                    <div>
                      <p className="font-medium">Versión activa</p>
                      <p className="text-sm text-muted-foreground">
                        Las versiones inactivas permanecen en los reportes históricos y en los
                        ajustes.
                      </p>
                    </div>
                    <Switch
                      aria-label="Versión CCSS activa"
                      checked={ccssForm.isActive}
                      onCheckedChange={(checked) =>
                        setCcssForm((current) => ({ ...current, isActive: checked }))
                      }
                    />
                  </div>

                  {editorError ? (
                    <AccessibleFieldError className="text-sm text-destructive">
                      {editorError}
                    </AccessibleFieldError>
                  ) : null}

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={resetEditor}>
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleSaveCcssRule()}
                      disabled={savingEditor}
                    >
                      {editor.mode === "edit" ? "Guardar regla" : "Crear regla"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <AccessibleField className="space-y-2">
                    <Label htmlFor="income-tax-rule-name">Nombre de la regla</Label>
                    <Input
                      id="income-tax-rule-name"
                      value={incomeTaxForm.name}
                      onChange={(event) =>
                        setIncomeTaxForm((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="Renta 2027"
                    />
                  </AccessibleField>

                  <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
                    <AccessibleField className="space-y-2">
                      <Label htmlFor="income-tax-effective-from">Vigente desde</Label>
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
                    </AccessibleField>
                    <AccessibleField className="space-y-2">
                      <Label htmlFor="income-tax-effective-to">Vigente hasta</Label>
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
                    </AccessibleField>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                    <div>
                      <p className="font-medium">Versión activa</p>
                      <p className="text-sm text-muted-foreground">
                        Las versiones desactivadas se conservan para las consultas históricas.
                      </p>
                    </div>
                    <Switch
                      aria-label="Versión de renta activa"
                      checked={incomeTaxForm.isActive}
                      onCheckedChange={(checked) =>
                        setIncomeTaxForm((current) => ({ ...current, isActive: checked }))
                      }
                    />
                  </div>

                  <div className="rounded-lg border bg-muted/10 p-3 text-sm text-muted-foreground">
                    Cada tramo incluye el importe inicial y excluye el importe final.{" "}
                    <span className="font-medium text-foreground">
                      El límite inicial está incluido y el final no.
                    </span>
                    Deja el último{" "}
                    <span className="font-medium text-foreground">límite superior</span> vacío para
                    indicar un tramo sin límite.
                  </div>

                  <div className="space-y-3">
                    {incomeTaxForm.brackets.map((bracket, index) => (
                      <div key={bracket.key} className="rounded-xl border p-3">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium">Tramo {index + 1}</p>
                            <p className="text-xs text-muted-foreground">
                              Los tramos se ordenan automáticamente.
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
                          <AccessibleField className="space-y-2">
                            <Label htmlFor={`bracket-from-${bracket.key}`}>Importe desde</Label>
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
                          </AccessibleField>
                          <AccessibleField className="space-y-2">
                            <Label htmlFor={`bracket-to-${bracket.key}`}>Importe hasta</Label>
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
                                index === incomeTaxForm.brackets.length - 1
                                  ? "Sin límite superior"
                                  : ""
                              }
                            />
                          </AccessibleField>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                          <AccessibleField className="space-y-2">
                            <Label htmlFor={`bracket-rate-${bracket.key}`}>Tasa de renta</Label>
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
                          </AccessibleField>
                          <div className="flex items-end">
                            <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
                              <div>
                                <p className="font-medium">Exento</p>
                                <p className="text-xs text-muted-foreground">
                                  Para el tramo exento.
                                </p>
                              </div>
                              <Switch
                                aria-label={"Tramo exento " + (index + 1)}
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
                    Añadir tramo
                  </Button>

                  {editorError ? (
                    <AccessibleFieldError className="text-sm text-destructive">
                      {editorError}
                    </AccessibleFieldError>
                  ) : null}

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={resetEditor}>
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleSaveIncomeTaxRule()}
                      disabled={savingEditor}
                    >
                      {editor.mode === "edit" ? "Guardar regla" : "Crear regla"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Calculadora de salario neto</CardTitle>
              <CardDescription>
                Consulta las reglas vigentes para una fecha y revisa CCSS, impuesto sobre la renta y
                salario neto.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
                <AccessibleField className="space-y-2">
                  <Label htmlFor="payroll-simulator-gross">Salario bruto (CRC)</Label>
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
                </AccessibleField>
                <AccessibleField className="space-y-2">
                  <Label htmlFor="payroll-simulator-date">Fecha del período</Label>
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
                </AccessibleField>
              </div>

              <Button type="button" onClick={() => void handleSimulate()} disabled={simulating}>
                <Calculator className="mr-2 h-4 w-4" />
                Calcular salario neto
              </Button>

              {simulationError ? (
                <AccessibleFieldError className="text-sm text-destructive">
                  {simulationError}
                </AccessibleFieldError>
              ) : null}

              {!simulation ? (
                <Alert>
                  <AlertTitle>Todavía no hay un cálculo</AlertTitle>
                  <AlertDescription>
                    Calcula el salario neto para ver el desglose y las reglas utilizadas.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Salario neto
                      </p>
                      <p className="mt-2 text-xl font-semibold">
                        {formatCurrency(simulation.netSalary, "CRC")}
                      </p>
                    </div>
                    <div className="rounded-xl border p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Impuesto sobre la renta
                      </p>
                      <p className="mt-2 text-xl font-semibold">
                        {formatCurrency(simulation.incomeTaxAmount, "CRC")}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-muted-foreground">Salario bruto</span>
                      <span className="font-medium">
                        {formatCurrency(simulation.grossSalary, "CRC")}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-muted-foreground">Tasa del trabajador · CCSS</span>
                      <span className="font-medium">
                        {formatPayrollRate(simulation.ccssWorkerRate)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-muted-foreground">Aporte del trabajador · CCSS</span>
                      <span className="font-medium">
                        {formatCurrency(simulation.ccssWorkerAmount, "CRC")}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-muted-foreground">Base de renta (salario bruto)</span>
                      <span className="font-medium">
                        {formatCurrency(simulation.taxableBase, "CRC")}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-muted-foreground">Versión de la regla de CCSS</span>
                      <span className="font-medium">#{simulation.ccssRuleSetId}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-muted-foreground">Versión de la regla de renta</span>
                      <span className="font-medium">#{simulation.incomeTaxRuleSetId}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border">
                    <div className="border-b px-3 py-2">
                      <p className="text-sm font-medium">Desglose de renta</p>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tramo</TableHead>
                            <TableHead>Importe gravable</TableHead>
                            <TableHead>Tasa</TableHead>
                            <TableHead className="text-right">Importe del impuesto</TableHead>
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
              <CardTitle>Reglas utilizadas</CardTitle>
              <CardDescription>
                Referencia de las versiones que corresponden a la fecha consultada.
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
                    No hay una regla de CCSS vigente para esta fecha.
                  </p>
                )}
              </div>

              <div className="rounded-xl border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-emerald-300" />
                  <p className="font-medium">Impuesto sobre la renta</p>
                </div>
                {activeIncomeTaxRule ? (
                  <div className="space-y-3">
                    <p>{activeIncomeTaxRule.name}</p>
                    <div className="space-y-2">
                      {activeIncomeTaxRule.incomeTaxBrackets.map((bracket) => (
                        <div
                          key={bracket.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                        >
                          <div>
                            <p className="font-medium">Tramo {bracket.rangeOrder}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatIncomeTaxBracketRange(bracket)}
                            </p>
                          </div>
                          <Badge variant="outline">
                            {bracket.isExempt ? "Exento" : formatPayrollRate(bracket.taxRate)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    No hay una regla de renta vigente para esta fecha.
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
