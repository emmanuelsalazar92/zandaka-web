"use client"

import { Building2, Edit2, FolderTree, Plus, ShieldCheck } from "lucide-react"
import Link from "next/link"
import * as React from "react"

import { SettingsCashDenominationsSection } from "@/components/settings-cash-denominations-section"
import { SettingsPayrollRulesSection } from "@/components/settings-payroll-rules-section"
import { AccessibleField, AccessibleFieldError } from "@/components/ui/accessible-field"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { formatAccountingTimestamp } from "@/lib/date-only"
import {
  type AccountOption,
  type AutoAssignmentMatchType,
  type AutoAssignmentRule,
  type AutoAssignmentRuleTestResult,
  createAutoAssignmentRule,
  type EnvelopeOption,
  fetchAccounts,
  fetchAutoAssignmentRules,
  fetchEnvelopeOptions,
  fetchUserSettings,
  testAutoAssignmentRule,
  toggleAutoAssignmentRuleStatus,
  updateAutoAssignmentRule,
  updateUserSettings,
  type UserSettings,
} from "@/lib/settings-api"

const NONE = "__none__"
const MATCH_TYPES: AutoAssignmentMatchType[] = [
  "CONTAINS",
  "STARTS_WITH",
  "ENDS_WITH",
  "EXACT",
  "REGEX",
]
const BASE_CURRENCIES = [
  { value: "CRC", label: "CRC · Colón costarricense" },
  { value: "USD", label: "USD · Dólar estadounidense" },
] as const

const formatTimestamp = formatAccountingTimestamp
const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

export function SettingsContent() {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [profile, setProfile] = React.useState<UserSettings | null>(null)
  const [profileForm, setProfileForm] = React.useState({ name: "", baseCurrency: "USD" })
  const [savingProfile, setSavingProfile] = React.useState(false)
  const [accounts, setAccounts] = React.useState<AccountOption[]>([])
  const [envelopesByAccount, setEnvelopesByAccount] = React.useState<
    Record<number, EnvelopeOption[]>
  >({})
  const [rules, setRules] = React.useState<AutoAssignmentRule[]>([])
  const [editingRuleId, setEditingRuleId] = React.useState<number | null>(null)
  const [ruleFormOpen, setRuleFormOpen] = React.useState(false)
  const [ruleFormError, setRuleFormError] = React.useState<string | null>(null)
  const [ruleBusy, setRuleBusy] = React.useState(false)
  const [ruleForm, setRuleForm] = React.useState({
    pattern: "",
    matchType: "CONTAINS" as AutoAssignmentMatchType,
    accountId: NONE,
    accountEnvelopeId: NONE,
    priority: "100",
    isActive: true,
    notes: "",
  })
  const [testDescription, setTestDescription] = React.useState("")
  const [testResult, setTestResult] = React.useState<AutoAssignmentRuleTestResult | null>(null)
  const [testingRules, setTestingRules] = React.useState(false)

  const loadAll = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [profileData, accountData, ruleData] = await Promise.all([
        fetchUserSettings(),
        fetchAccounts(),
        fetchAutoAssignmentRules(),
      ])
      setProfile(profileData)
      setProfileForm({ name: profileData.name, baseCurrency: profileData.baseCurrency })
      setAccounts(accountData)
      setRules(ruleData)
    } catch (cause) {
      setError(messageOf(cause, "No pudimos cargar los ajustes. Vuelve a intentar."))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadAll()
  }, [loadAll])

  const ensureEnvelopesLoaded = async (accountId: number) => {
    if (envelopesByAccount[accountId]) return
    const data = await fetchEnvelopeOptions(accountId)
    setEnvelopesByAccount((current) => ({ ...current, [accountId]: data }))
  }

  const selectedAccountId =
    ruleForm.accountId !== NONE ? Number.parseInt(ruleForm.accountId, 10) : null
  const selectedEnvelopes =
    selectedAccountId !== null ? (envelopesByAccount[selectedAccountId] ?? []) : []
  const hasProfileChanges =
    profile !== null &&
    (profileForm.name !== profile.name || profileForm.baseCurrency !== profile.baseCurrency)

  const resetRuleForm = () => {
    setEditingRuleId(null)
    setRuleFormOpen(false)
    setRuleFormError(null)
    setRuleForm({
      pattern: "",
      matchType: "CONTAINS",
      accountId: NONE,
      accountEnvelopeId: NONE,
      priority: "100",
      isActive: true,
      notes: "",
    })
  }

  const openRuleForm = async (rule?: AutoAssignmentRule) => {
    setRuleFormOpen(true)
    setRuleFormError(null)
    if (!rule) return setEditingRuleId(null)
    const accountId = rule.accountId ?? rule.accountEnvelopeAccountId
    if (accountId !== null) await ensureEnvelopesLoaded(accountId)
    setEditingRuleId(rule.id)
    setRuleForm({
      pattern: rule.pattern,
      matchType: rule.matchType,
      accountId: accountId !== null ? String(accountId) : NONE,
      accountEnvelopeId: rule.accountEnvelopeId !== null ? String(rule.accountEnvelopeId) : NONE,
      priority: String(rule.priority),
      isActive: rule.isActive,
      notes: rule.notes ?? "",
    })
  }

  const saveProfile = async () => {
    if (!profileForm.name.trim() || !profileForm.baseCurrency.trim()) {
      return toast({
        title: "Perfil incompleto",
        description: "Introduce tu nombre y elige la moneda de presentación.",
        variant: "destructive",
      })
    }
    try {
      setSavingProfile(true)
      const updated = await updateUserSettings({
        name: profileForm.name,
        baseCurrency: profileForm.baseCurrency,
      })
      setProfile(updated)
      setProfileForm({ name: updated.name, baseCurrency: updated.baseCurrency })
      toast({
        title: "Perfil actualizado",
        description: `Base currency set to ${updated.baseCurrency}.`,
      })
    } catch (cause) {
      toast({
        title: "No se actualizó el perfil",
        description: messageOf(cause, "No pudimos guardar tu perfil. Vuelve a intentar."),
        variant: "destructive",
      })
    } finally {
      setSavingProfile(false)
    }
  }

  const saveRule = async () => {
    const priority = Number.parseInt(ruleForm.priority, 10)
    const accountId = ruleForm.accountId !== NONE ? Number.parseInt(ruleForm.accountId, 10) : null
    const accountEnvelopeId =
      ruleForm.accountEnvelopeId !== NONE ? Number.parseInt(ruleForm.accountEnvelopeId, 10) : null
    if (
      !ruleForm.pattern.trim() ||
      !Number.isInteger(priority) ||
      (accountId === null && accountEnvelopeId === null)
    ) {
      return setRuleFormError(
        "Introduce un patrón, una prioridad entera y al menos una cuenta o sobre de destino.",
      )
    }
    try {
      setRuleBusy(true)
      setRuleFormError(null)
      const payload = {
        pattern: ruleForm.pattern.trim(),
        matchType: ruleForm.matchType,
        accountId,
        accountEnvelopeId,
        priority,
        isActive: ruleForm.isActive,
        notes: ruleForm.notes.trim() || null,
      }
      const saved = editingRuleId
        ? await updateAutoAssignmentRule(editingRuleId, payload)
        : await createAutoAssignmentRule(payload)
      setRules((current) =>
        [...current.filter((item) => item.id !== saved.id), saved].sort(
          (a, b) => a.priority - b.priority || a.id - b.id,
        ),
      )
      toast({
        title: editingRuleId ? "Regla actualizada" : "Regla creada",
        description: `Pattern "${saved.pattern}" saved.`,
      })
      resetRuleForm()
    } catch (cause) {
      setRuleFormError(
        messageOf(cause, "No pudimos guardar la regla. Revisa los datos y vuelve a intentar."),
      )
    } finally {
      setRuleBusy(false)
    }
  }

  if (loading)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ajustes</CardTitle>
          <CardDescription>Cargando tu configuración.</CardDescription>
        </CardHeader>
      </Card>
    )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Ajustes</h2>
        <p className="text-muted-foreground">
          Tu perfil, catálogos y reglas, organizados en un solo lugar.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/institutions"
          className="flex min-h-20 items-center gap-4 rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Building2 className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="font-semibold">Instituciones</p>
            <p className="text-sm text-muted-foreground">
              Bancos y otras entidades de tus cuentas.
            </p>
          </div>
        </Link>
        <Link
          href="/categories"
          className="flex min-h-20 items-center gap-4 rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <FolderTree className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="font-semibold">Categorías</p>
            <p className="text-sm text-muted-foreground">
              Organiza los conceptos de tus sobres y presupuestos.
            </p>
          </div>
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary">
          {rules.filter((rule) => rule.isActive).length} reglas activas
        </Badge>
        <Button type="button" variant="outline" onClick={() => void loadAll()}>
          Actualizar
        </Button>
      </div>
      {error && (
        <Alert>
          <AlertTitle>Ajustes no disponibles</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          <TabsTrigger value="cash">Efectivo</TabsTrigger>
          <TabsTrigger value="payroll">Nómina</TabsTrigger>
          <TabsTrigger value="rules">Reglas automáticas</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <CardHeader>
                <CardTitle>Mi perfil</CardTitle>
                <CardDescription>
                  Configura tu nombre y la moneda de presentación de la aplicación.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <AccessibleField className="space-y-2">
                  <Label htmlFor="settings-name">Nombre</Label>
                  <Input
                    id="settings-name"
                    value={profileForm.name}
                    onChange={(event) =>
                      setProfileForm((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </AccessibleField>
                <AccessibleField className="space-y-2">
                  <Label htmlFor="settings-currency">Moneda de presentación</Label>
                  <Select
                    value={profileForm.baseCurrency}
                    onValueChange={(value) =>
                      setProfileForm((current) => ({ ...current, baseCurrency: value }))
                    }
                  >
                    <SelectTrigger id="settings-currency" className="w-full">
                      <SelectValue placeholder="Elige la moneda" />
                    </SelectTrigger>
                    <SelectContent>
                      {BASE_CURRENCIES.map((currency) => (
                        <SelectItem key={currency.value} value={currency.value}>
                          {currency.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </AccessibleField>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => void saveProfile()}
                    disabled={savingProfile || !hasProfileChanges}
                  >
                    Guardar perfil
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Registro</CardTitle>
                <CardDescription>Fechas de creación y actualización de tu perfil.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Creado</p>
                  <p className="font-medium">
                    {profile ? formatTimestamp(profile.createdAt) : "No disponible"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Actualizado</p>
                  <p className="font-medium">
                    {profile ? formatTimestamp(profile.updatedAt) : "No disponible"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cash" className="space-y-4">
          <SettingsCashDenominationsSection
            baseCurrency={profileForm.baseCurrency}
            accounts={accounts}
          />
        </TabsContent>

        <TabsContent value="payroll" className="space-y-4">
          <SettingsPayrollRulesSection />
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle>Reglas de asignación automática</CardTitle>
                  <CardDescription>
                    Las reglas revisan la descripción por prioridad para sugerir una cuenta y un
                    sobre.
                  </CardDescription>
                </div>
                <Button type="button" onClick={() => void openRuleForm()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva regla
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {ruleFormOpen && (
                  <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
                    <AccessibleField className="space-y-2 md:col-span-2">
                      <Label>Patrón</Label>
                      <Input
                        value={ruleForm.pattern}
                        onChange={(event) =>
                          setRuleForm((current) => ({ ...current, pattern: event.target.value }))
                        }
                      />
                    </AccessibleField>
                    <AccessibleField className="space-y-2">
                      <Label>Tipo de coincidencia</Label>
                      <Select
                        value={ruleForm.matchType}
                        onValueChange={(value) =>
                          setRuleForm((current) => ({
                            ...current,
                            matchType: value as AutoAssignmentMatchType,
                          }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MATCH_TYPES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {{
                                CONTAINS: "Contiene",
                                STARTS_WITH: "Empieza con",
                                ENDS_WITH: "Termina con",
                                EXACT: "Coincidencia exacta",
                                REGEX: "Expresión regular",
                              }[value] ?? value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </AccessibleField>
                    <AccessibleField className="space-y-2">
                      <Label>Prioridad</Label>
                      <Input
                        type="number"
                        value={ruleForm.priority}
                        onChange={(event) =>
                          setRuleForm((current) => ({ ...current, priority: event.target.value }))
                        }
                      />
                    </AccessibleField>
                    <AccessibleField className="space-y-2">
                      <Label>Cuenta</Label>
                      <Select
                        value={ruleForm.accountId}
                        onValueChange={(value) => {
                          setRuleForm((current) => ({
                            ...current,
                            accountId: value,
                            accountEnvelopeId: NONE,
                          }))
                          if (value !== NONE) void ensureEnvelopesLoaded(Number.parseInt(value, 10))
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Sin cuenta de destino</SelectItem>
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={String(account.id)}>
                              {account.name} ({account.currency})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </AccessibleField>
                    <AccessibleField className="space-y-2">
                      <Label>Sobre</Label>
                      <Select
                        value={ruleForm.accountEnvelopeId}
                        onValueChange={(value) =>
                          setRuleForm((current) => ({ ...current, accountEnvelopeId: value }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Sin sobre de destino</SelectItem>
                          {selectedEnvelopes.map((envelope) => (
                            <SelectItem
                              key={envelope.envelopeId}
                              value={String(envelope.envelopeId)}
                            >
                              {envelope.categoryName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </AccessibleField>
                    <AccessibleField className="space-y-2 md:col-span-2">
                      <Label>Notas</Label>
                      <Textarea
                        rows={3}
                        value={ruleForm.notes}
                        onChange={(event) =>
                          setRuleForm((current) => ({ ...current, notes: event.target.value }))
                        }
                      />
                    </AccessibleField>
                    <div className="flex items-center justify-between rounded-lg border px-3 py-2 md:col-span-2">
                      <div>
                        <p className="font-medium">Regla activa</p>
                        <p className="text-sm text-muted-foreground">
                          Las reglas inactivas se conservan y no se usan para sugerir asignaciones.
                        </p>
                      </div>
                      <Switch
                        aria-label="Regla activa"
                        checked={ruleForm.isActive}
                        onCheckedChange={(checked) =>
                          setRuleForm((current) => ({ ...current, isActive: checked }))
                        }
                      />
                    </div>
                    {ruleFormError && (
                      <AccessibleFieldError className="text-sm text-destructive md:col-span-2">
                        {ruleFormError}
                      </AccessibleFieldError>
                    )}
                    <div className="flex gap-2 md:col-span-2 md:justify-end">
                      <Button type="button" variant="outline" onClick={resetRuleForm}>
                        Cancelar
                      </Button>
                      <Button type="button" onClick={() => void saveRule()} disabled={ruleBusy}>
                        {editingRuleId ? "Guardar regla" : "Crear regla"}
                      </Button>
                    </div>
                  </div>
                )}
                {rules.length === 0 ? (
                  <Alert>
                    <AlertTitle>No hay reglas configuradas</AlertTitle>
                    <AlertDescription>
                      Crea reglas para descripciones habituales, como suscripciones, salarios o
                      transferencias.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Patrón</TableHead>
                          <TableHead>Coincidencia</TableHead>
                          <TableHead>Destino</TableHead>
                          <TableHead>Prioridad</TableHead>
                          <TableHead>Activo</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rules.map((rule) => (
                          <TableRow key={rule.id}>
                            <TableCell className="min-w-48">
                              <p className="font-medium">{rule.pattern}</p>
                              {rule.notes && (
                                <p className="text-xs text-muted-foreground">{rule.notes}</p>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{rule.matchType}</Badge>
                            </TableCell>
                            <TableCell className="min-w-64">
                              {rule.accountEnvelopeLabel || rule.accountName || "Sin asignar"}
                            </TableCell>
                            <TableCell>{rule.priority}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Switch
                                  aria-label={"Regla activa: " + rule.pattern}
                                  checked={rule.isActive}
                                  onCheckedChange={(checked) =>
                                    void toggleAutoAssignmentRuleStatus(rule.id, checked)
                                      .then((updated) =>
                                        setRules((current) =>
                                          current.map((item) =>
                                            item.id === updated.id ? updated : item,
                                          ),
                                        ),
                                      )
                                      .catch((cause) =>
                                        toast({
                                          title: "No se actualizó el estado",
                                          description: messageOf(
                                            cause,
                                            "No pudimos cambiar el estado de la regla. Vuelve a intentar.",
                                          ),
                                          variant: "destructive",
                                        }),
                                      )
                                  }
                                />
                                <span className="text-sm">
                                  {rule.isActive ? "Activo" : "Inactivo"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  aria-label={`Edit rule ${rule.pattern}`}
                                  title={`Edit rule ${rule.pattern}`}
                                  onClick={() => void openRuleForm(rule)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Probar reglas</CardTitle>
                <CardDescription>Comprueba las reglas activas con una descripción.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <AccessibleField className="space-y-2">
                  <Label htmlFor="rule-test">Descripción del movimiento</Label>
                  <Textarea
                    id="rule-test"
                    rows={4}
                    value={testDescription}
                    onChange={(event) => setTestDescription(event.target.value)}
                    placeholder="Suscripción mensual de Spotify"
                  />
                </AccessibleField>
                <Button
                  type="button"
                  onClick={() => {
                    if (!testDescription.trim())
                      return toast({
                        title: "Falta la descripción",
                        description: "Introduce primero la descripción de un movimiento.",
                        variant: "destructive",
                      })
                    setTestingRules(true)
                    void testAutoAssignmentRule(testDescription)
                      .then(setTestResult)
                      .catch((cause) =>
                        toast({
                          title: "No se completó la prueba",
                          description: messageOf(
                            cause,
                            "No pudimos probar las reglas activas. Vuelve a intentar.",
                          ),
                          variant: "destructive",
                        }),
                      )
                      .finally(() => setTestingRules(false))
                  }}
                  disabled={testingRules}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Probar reglas activas
                </Button>
                {testResult && (
                  <div className="rounded-lg border p-4 text-sm">
                    <p className="font-medium">
                      {testResult.matched
                        ? `Matched ${testResult.matches.length} rule${testResult.matches.length === 1 ? "" : "s"}`
                        : "Ninguna regla activa coincide"}
                    </p>
                    {testResult.matchedRule && (
                      <div className="mt-3 space-y-1">
                        <p>
                          <span className="text-muted-foreground">Patrón:</span>{" "}
                          {testResult.matchedRule.pattern}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Destino:</span>{" "}
                          {testResult.matchedRule.accountEnvelopeLabel ||
                            testResult.matchedRule.accountName ||
                            "Sin asignar"}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Prioridad:</span>{" "}
                          {testResult.matchedRule.priority}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
