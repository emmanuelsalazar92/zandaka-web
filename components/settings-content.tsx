"use client"

import { Edit2, Plus, ShieldCheck } from "lucide-react"
import * as React from "react"

import { SettingsCashDenominationsSection } from "@/components/settings-cash-denominations-section"
import { SettingsPayrollRulesSection } from "@/components/settings-payroll-rules-section"
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
  { value: "CRC", label: "CRC (Costa Rican Colon)" },
  { value: "USD", label: "USD (US Dollar)" },
] as const

const formatTimestamp = (value: string) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "Unavailable"
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
      setError(messageOf(cause, "Failed to load settings."))
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
        title: "Profile incomplete",
        description: "Name and base currency are required.",
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
        title: "Profile updated",
        description: `Base currency set to ${updated.baseCurrency}.`,
      })
    } catch (cause) {
      toast({
        title: "Profile update failed",
        description: messageOf(cause, "Failed to update user settings."),
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
      return setRuleFormError("Pattern, integer priority and at least one target are required.")
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
        title: editingRuleId ? "Rule updated" : "Rule created",
        description: `Pattern "${saved.pattern}" saved.`,
      })
      resetRuleForm()
    } catch (cause) {
      setRuleFormError(messageOf(cause, "Failed to save rule."))
    } finally {
      setRuleBusy(false)
    }
  }

  if (loading)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Loading your configuration.</CardDescription>
        </CardHeader>
      </Card>
    )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your preferences, profile, cash denominations, and automation rules
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary">
          {rules.filter((rule) => rule.isActive).length} active rules
        </Badge>
        <Button type="button" variant="outline" onClick={() => void loadAll()}>
          Refresh
        </Button>
      </div>
      {error && (
        <Alert>
          <AlertTitle>Settings unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="cash">Cash</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="rules">Auto Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <CardHeader>
                <CardTitle>User Settings</CardTitle>
                <CardDescription>
                  Manage the basic identity and base currency used by the app.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="settings-name">Name</Label>
                  <Input
                    id="settings-name"
                    value={profileForm.name}
                    onChange={(event) =>
                      setProfileForm((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-currency">Base Currency</Label>
                  <Select
                    value={profileForm.baseCurrency}
                    onValueChange={(value) =>
                      setProfileForm((current) => ({ ...current, baseCurrency: value }))
                    }
                  >
                    <SelectTrigger id="settings-currency" className="w-full">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {BASE_CURRENCIES.map((currency) => (
                        <SelectItem key={currency.value} value={currency.value}>
                          {currency.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => void saveProfile()}
                    disabled={savingProfile || !hasProfileChanges}
                  >
                    Save Profile
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Audit</CardTitle>
                <CardDescription>Useful timestamps for support and debugging.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {profile ? formatTimestamp(profile.createdAt) : "Unavailable"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Updated</p>
                  <p className="font-medium">
                    {profile ? formatTimestamp(profile.updatedAt) : "Unavailable"}
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
                  <CardTitle>Auto Assignment Rules</CardTitle>
                  <CardDescription>
                    Evaluate descriptions by priority to suggest account and envelope targets.
                  </CardDescription>
                </div>
                <Button type="button" onClick={() => void openRuleForm()}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Rule
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {ruleFormOpen && (
                  <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label>Pattern</Label>
                      <Input
                        value={ruleForm.pattern}
                        onChange={(event) =>
                          setRuleForm((current) => ({ ...current, pattern: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Match Type</Label>
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
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Input
                        type="number"
                        value={ruleForm.priority}
                        onChange={(event) =>
                          setRuleForm((current) => ({ ...current, priority: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Account</Label>
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
                          <SelectItem value={NONE}>No account target</SelectItem>
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={String(account.id)}>
                              {account.name} ({account.currency})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Envelope</Label>
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
                          <SelectItem value={NONE}>No envelope target</SelectItem>
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
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Notes</Label>
                      <Textarea
                        rows={3}
                        value={ruleForm.notes}
                        onChange={(event) =>
                          setRuleForm((current) => ({ ...current, notes: event.target.value }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border px-3 py-2 md:col-span-2">
                      <div>
                        <p className="font-medium">Rule Active</p>
                        <p className="text-sm text-muted-foreground">
                          Inactive rules remain stored but are ignored by the matcher.
                        </p>
                      </div>
                      <Switch
                        checked={ruleForm.isActive}
                        onCheckedChange={(checked) =>
                          setRuleForm((current) => ({ ...current, isActive: checked }))
                        }
                      />
                    </div>
                    {ruleFormError && (
                      <p className="text-sm text-destructive md:col-span-2">{ruleFormError}</p>
                    )}
                    <div className="flex gap-2 md:col-span-2 md:justify-end">
                      <Button type="button" variant="outline" onClick={resetRuleForm}>
                        Cancel
                      </Button>
                      <Button type="button" onClick={() => void saveRule()} disabled={ruleBusy}>
                        {editingRuleId ? "Save Rule" : "Create Rule"}
                      </Button>
                    </div>
                  </div>
                )}
                {rules.length === 0 ? (
                  <Alert>
                    <AlertTitle>No rules configured</AlertTitle>
                    <AlertDescription>
                      Create rules for repeated descriptions such as subscriptions, payroll or
                      transfer labels.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pattern</TableHead>
                          <TableHead>Match</TableHead>
                          <TableHead>Target</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Active</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
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
                              {rule.accountEnvelopeLabel || rule.accountName || "Unassigned"}
                            </TableCell>
                            <TableCell>{rule.priority}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Switch
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
                                          title: "Status update failed",
                                          description: messageOf(
                                            cause,
                                            "Failed to update rule status.",
                                          ),
                                          variant: "destructive",
                                        }),
                                      )
                                  }
                                />
                                <span className="text-sm">
                                  {rule.isActive ? "Active" : "Inactive"}
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
                <CardTitle>Rule Tester</CardTitle>
                <CardDescription>
                  Check the current active rules against a description.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rule-test">Transaction Description</Label>
                  <Textarea
                    id="rule-test"
                    rows={4}
                    value={testDescription}
                    onChange={(event) => setTestDescription(event.target.value)}
                    placeholder="Spotify USA monthly subscription"
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    if (!testDescription.trim())
                      return toast({
                        title: "Description required",
                        description: "Enter a transaction description first.",
                        variant: "destructive",
                      })
                    setTestingRules(true)
                    void testAutoAssignmentRule(testDescription)
                      .then(setTestResult)
                      .catch((cause) =>
                        toast({
                          title: "Rule test failed",
                          description: messageOf(cause, "Failed to test active rules."),
                          variant: "destructive",
                        }),
                      )
                      .finally(() => setTestingRules(false))
                  }}
                  disabled={testingRules}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Test Active Rules
                </Button>
                {testResult && (
                  <div className="rounded-lg border p-4 text-sm">
                    <p className="font-medium">
                      {testResult.matched
                        ? `Matched ${testResult.matches.length} rule${testResult.matches.length === 1 ? "" : "s"}`
                        : "No active rule matched"}
                    </p>
                    {testResult.matchedRule && (
                      <div className="mt-3 space-y-1">
                        <p>
                          <span className="text-muted-foreground">Pattern:</span>{" "}
                          {testResult.matchedRule.pattern}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Target:</span>{" "}
                          {testResult.matchedRule.accountEnvelopeLabel ||
                            testResult.matchedRule.accountName ||
                            "Unassigned"}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Priority:</span>{" "}
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
