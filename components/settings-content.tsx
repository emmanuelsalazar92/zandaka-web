"use client"

import { Edit2, Plus, ShieldCheck } from "lucide-react"
import * as React from "react"

import { PageHeader } from "@/components/page-header"
import { SettingsNavigation } from "@/components/settings/settings-navigation"
import styles from "@/components/settings/settings.module.css"
import { SettingsCashDenominationsSection } from "@/components/settings-cash-denominations-section"
import { SettingsPayrollRulesSection } from "@/components/settings-payroll-rules-section"
import { AccessibleField, AccessibleFieldError } from "@/components/ui/accessible-field"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Feedback } from "@/components/ui/feedback"
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
import { matchLabels, ruleDestination, rulePriority } from "@/lib/settings-presentation"

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
  const [ready, setReady] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [loadErrors, setLoadErrors] = React.useState({
    profile: false,
    accounts: false,
    rules: false,
  })
  const [section, setSection] = React.useState("profile")
  const [visited, setVisited] = React.useState(new Set(["profile"]))
  const profileDirty = React.useRef(false)
  const testRevision = React.useRef(0)
  const testPending = React.useRef(false)
  const [testError, setTestError] = React.useState<string | null>(null)
  const [togglingRule, setTogglingRule] = React.useState<number | null>(null)
  const togglePending = React.useRef(false)
  const chooseSection = React.useCallback((next: string) => {
    const value = ["profile", "cash", "payroll", "rules"].includes(next) ? next : "profile"
    setSection(value)
    setVisited((current) => new Set([...current, value]))
  }, [])
  React.useEffect(() => {
    const sync = () =>
      chooseSection(new URLSearchParams(window.location.search).get("section") ?? "profile")
    sync()
    window.addEventListener("popstate", sync)
    return () => window.removeEventListener("popstate", sync)
  }, [chooseSection])
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
      const results = await Promise.allSettled([
        fetchUserSettings(),
        fetchAccounts(),
        fetchAutoAssignmentRules(),
      ] as const)
      const [profileData, accountData, ruleData] = results
      if (profileData.status === "fulfilled") {
        setProfile(profileData.value)
        if (!profileDirty.current)
          setProfileForm({
            name: profileData.value.name,
            baseCurrency: profileData.value.baseCurrency,
          })
      }
      if (accountData.status === "fulfilled") setAccounts(accountData.value)
      if (ruleData.status === "fulfilled") {
        testRevision.current++
        setTestResult(null)
        setRules(ruleData.value)
      }
      setLoadErrors({
        profile: profileData.status === "rejected",
        accounts: accountData.status === "rejected",
        rules: ruleData.status === "rejected",
      })
      if (results.some((result) => result.status === "rejected"))
        setError(
          "Algunas secciones no están disponibles. Puedes seguir usando las demás; tus borradores se conservan.",
        )
    } catch (cause) {
      setError(messageOf(cause, "No pudimos cargar los ajustes. Vuelve a intentar."))
    } finally {
      setLoading(false)
      setReady(true)
    }
  }, [])

  React.useEffect(() => {
    void loadAll()
  }, [loadAll])

  const ensureEnvelopesLoaded = async (accountId: number) => {
    if (envelopesByAccount[accountId]) return
    try {
      const data = await fetchEnvelopeOptions(accountId)
      setEnvelopesByAccount((current) => ({ ...current, [accountId]: data }))
    } catch {
      setRuleFormError(
        "No pudimos cargar los sobres de esta cuenta. Vuelve a seleccionar la cuenta para reintentar.",
      )
    }
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
    if (accountId !== null) await ensureEnvelopesLoaded(accountId)
  }

  const saveProfile = async () => {
    if (savingProfile || loadErrors.profile || !profile) return
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
      profileDirty.current = false
      setProfile(updated)
      setProfileForm({ name: updated.name, baseCurrency: updated.baseCurrency })
      toast({
        title: "Perfil actualizado",
        description: `Moneda de presentación: ${updated.baseCurrency}.`,
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
    if (ruleBusy || loadErrors.rules || loadErrors.accounts) return
    const priority = rulePriority(ruleForm.priority)
    const accountId = ruleForm.accountId !== NONE ? Number.parseInt(ruleForm.accountId, 10) : null
    const accountEnvelopeId =
      ruleForm.accountEnvelopeId !== NONE ? Number.parseInt(ruleForm.accountEnvelopeId, 10) : null
    if (
      !ruleForm.pattern.trim() ||
      priority === null ||
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
          (a, b) =>
            a.priority - b.priority || b.updatedAt.localeCompare(a.updatedAt) || a.id - b.id,
        ),
      )
      toast({
        title: editingRuleId ? "Regla actualizada" : "Regla creada",
        description: `Patrón «${saved.pattern}» guardado.`,
      })
      testRevision.current++
      setTestResult(null)
      resetRuleForm()
    } catch (cause) {
      setRuleFormError(
        messageOf(cause, "No pudimos guardar la regla. Revisa los datos y vuelve a intentar."),
      )
    } finally {
      setRuleBusy(false)
    }
  }

  const activeRuleCount = rules.filter((rule) => rule.isActive).length
  return (
    <div
      className={`marea-surface min-w-0 space-y-6 rounded-2xl bg-background p-3 sm:p-5 ${styles.page}`}
    >
      <PageHeader
        title={<>Ajustes</>}
        description={<>Tu perfil, catálogos y reglas, organizados en un solo lugar.</>}
        actionsLabel="Acciones de ajustes"
      />
      <SettingsNavigation current={section} onSectionChange={chooseSection} />
      <section className={styles.intro} aria-label="Tu configuración">
        <p className="!mt-0 text-sm font-medium">Tu espacio · Ajustes</p>
        <h2>Todo a tu manera.</h2>
        <p>
          Tu perfil, tus catálogos y las reglas que simplifican el día a día. Elige una sección para
          ajustar cada detalle.
        </p>
      </section>
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary">
          {loadErrors.rules || loading
            ? "Reglas por confirmar"
            : `${activeRuleCount} ${activeRuleCount === 1 ? "regla activa" : "reglas activas"}`}
        </Badge>
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadAll()}
          disabled={loading || savingProfile || ruleBusy || togglingRule !== null}
        >
          Actualizar
        </Button>
      </div>
      {error && (
        <Alert>
          <AlertTitle>Disponibilidad de ajustes</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {loading && (
        <p role="status" className="text-sm text-muted-foreground">
          Cargando ajustes…
        </p>
      )}
      {ready && (
        <div className="space-y-4">
          {visited.has("profile") && (
            <section
              aria-label="Perfil y preferencias"
              hidden={section !== "profile"}
              className="space-y-4"
            >
              {loadErrors.profile && (
                <Feedback tone="error" title="Perfil no disponible">
                  Actualiza los ajustes para volver a consultar el perfil.
                </Feedback>
              )}
              <fieldset
                disabled={loading || loadErrors.profile || savingProfile}
                className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"
              >
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
                        onChange={(event) => {
                          profileDirty.current = true
                          setProfileForm((current) => ({ ...current, name: event.target.value }))
                        }}
                      />
                    </AccessibleField>
                    <AccessibleField className="space-y-2">
                      <Label htmlFor="settings-currency">Moneda de presentación</Label>
                      <Select
                        value={profileForm.baseCurrency}
                        onValueChange={(value) => {
                          profileDirty.current = true
                          setProfileForm((current) => ({ ...current, baseCurrency: value }))
                        }}
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
                    <CardDescription>
                      Fechas de creación y actualización de tu perfil.
                    </CardDescription>
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
              </fieldset>
            </section>
          )}

          {visited.has("cash") && (
            <section aria-label="Efectivo" hidden={section !== "cash"} className="space-y-4">
              <SettingsCashDenominationsSection
                baseCurrency={profileForm.baseCurrency}
                accounts={accounts}
              />
            </section>
          )}

          {visited.has("payroll") && (
            <section aria-label="Nómina" hidden={section !== "payroll"} className="space-y-4">
              <SettingsPayrollRulesSection />
            </section>
          )}

          {visited.has("rules") && (
            <section aria-label="Automatización" hidden={section !== "rules"} className="space-y-4">
              <div className={styles.rules}>
                <Card>
                  <CardHeader className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <CardTitle>Reglas de asignación automática</CardTitle>
                      <CardDescription>
                        El número menor tiene prioridad. En empate se usa la regla actualizada más
                        recientemente y luego su identificador. Se evalúan solo las reglas activas.
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      disabled={loading || loadErrors.rules || loadErrors.accounts || ruleBusy}
                      onClick={() => {
                        resetRuleForm()
                        void openRuleForm()
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Nueva regla
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(loadErrors.rules || loadErrors.accounts) && (
                      <Feedback tone="error" title="Automatización incompleta">
                        Actualiza los ajustes para consultar las reglas y cuentas antes de editar.
                      </Feedback>
                    )}
                    {ruleFormOpen && (
                      <fieldset
                        disabled={ruleBusy}
                        className="grid min-w-0 gap-4 rounded-lg border p-4 md:grid-cols-2"
                      >
                        <AccessibleField className="space-y-2 md:col-span-2">
                          <Label>Patrón</Label>
                          <Input
                            value={ruleForm.pattern}
                            onChange={(event) =>
                              setRuleForm((current) => ({
                                ...current,
                                pattern: event.target.value,
                              }))
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
                              setRuleForm((current) => ({
                                ...current,
                                priority: event.target.value,
                              }))
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
                              if (value !== NONE)
                                void ensureEnvelopesLoaded(Number.parseInt(value, 10))
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
                              Las reglas inactivas se conservan y no se usan para sugerir
                              asignaciones.
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
                      </fieldset>
                    )}
                    {!loading && !loadErrors.rules && rules.length === 0 ? (
                      <Alert>
                        <AlertTitle>No hay reglas configuradas</AlertTitle>
                        <AlertDescription>
                          Crea reglas para descripciones habituales, como suscripciones, salarios o
                          transferencias.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <ul aria-label="Reglas configuradas">
                        {rules.map((rule) => (
                          <li key={rule.id} className={styles.rule}>
                            <h3>{rule.pattern}</h3>
                            {rule.notes && (
                              <p className="mt-1 text-sm text-muted-foreground">{rule.notes}</p>
                            )}
                            <dl>
                              <dt>Coincidencia</dt>
                              <dd>{matchLabels[rule.matchType]}</dd>
                              <dt>Destino</dt>
                              <dd>{ruleDestination(rule)}</dd>
                              <dt>Prioridad</dt>
                              <dd>{rule.priority}</dd>
                            </dl>
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <Switch
                                  aria-label={"Regla activa: " + rule.pattern}
                                  checked={rule.isActive}
                                  disabled={
                                    togglingRule !== null || ruleBusy || loadErrors.rules || loading
                                  }
                                  onCheckedChange={(checked) => {
                                    if (togglePending.current) return
                                    togglePending.current = true
                                    setTogglingRule(rule.id)
                                    testRevision.current++
                                    setTestResult(null)
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
                                            "Vuelve a consultar la regla antes de reintentar.",
                                          ),
                                          variant: "destructive",
                                        }),
                                      )
                                      .finally(() => {
                                        togglePending.current = false
                                        setTogglingRule(null)
                                      })
                                  }}
                                />
                                <span className="text-sm">
                                  {rule.isActive ? "Activa" : "Inactiva"}
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                disabled={
                                  ruleBusy ||
                                  loading ||
                                  loadErrors.rules ||
                                  loadErrors.accounts ||
                                  togglingRule !== null
                                }
                                aria-label={`Editar regla ${rule.pattern}`}
                                onClick={() => void openRuleForm(rule)}
                              >
                                <Edit2 aria-hidden="true" className="size-4" />
                                Editar
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Probar reglas</CardTitle>
                    <CardDescription>
                      Simula una descripción. Esta prueba no crea movimientos ni modifica registros.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <AccessibleField className="space-y-2">
                      <Label htmlFor="rule-test">Descripción del movimiento</Label>
                      <Textarea
                        id="rule-test"
                        rows={4}
                        value={testDescription}
                        onChange={(event) => {
                          testRevision.current++
                          setTestDescription(event.target.value)
                          setTestResult(null)
                          setTestError(null)
                        }}
                        placeholder="Suscripción mensual de Spotify"
                      />
                    </AccessibleField>
                    <Button
                      type="button"
                      onClick={() => {
                        if (testPending.current || !testDescription.trim()) return
                        const revision = ++testRevision.current
                        testPending.current = true
                        setTestingRules(true)
                        setTestResult(null)
                        setTestError(null)
                        void testAutoAssignmentRule(testDescription.trim())
                          .then((result) => {
                            if (revision === testRevision.current) setTestResult(result)
                          })
                          .catch(() => {
                            if (revision === testRevision.current)
                              setTestError("No pudimos probar las reglas. Vuelve a intentar.")
                          })
                          .finally(() => {
                            testPending.current = false
                            setTestingRules(false)
                          })
                      }}
                      disabled={
                        testingRules ||
                        !testDescription.trim() ||
                        loading ||
                        loadErrors.rules ||
                        ruleBusy ||
                        togglingRule !== null
                      }
                    >
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Probar reglas activas
                    </Button>
                    {testError && (
                      <Feedback tone="error" title="Prueba no disponible">
                        {testError}
                      </Feedback>
                    )}
                    {testResult && (
                      <div role="status" className={`${styles.hint} text-sm`}>
                        <p className="font-medium">
                          {testResult.matched
                            ? `${testResult.matches.length} ${testResult.matches.length === 1 ? "regla coincide" : "reglas coinciden"}`
                            : "Ninguna regla activa coincide"}
                        </p>
                        <p className="mt-2">Descripción probada: {testResult.description}</p>
                        {testResult.matchedRule && (
                          <div className="mt-3 space-y-1">
                            <p>
                              <span>Regla seleccionada:</span> {testResult.matchedRule.pattern}
                            </p>
                            <p>
                              <span>Destino:</span> {ruleDestination(testResult.matchedRule)}
                            </p>
                            <p>
                              <span>Prioridad:</span> {testResult.matchedRule.priority}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
