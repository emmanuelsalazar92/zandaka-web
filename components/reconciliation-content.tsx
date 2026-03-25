"use client"

import { AlertCircle, Plus, RefreshCw, Scale } from "lucide-react"
import * as React from "react"

import { EmptyState } from "@/components/empty-state"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency, formatSignedCurrency } from "@/lib/currency-formatter"
import { cn } from "@/lib/utils"

interface Account {
  id: number
  name: string
  currency: string
  active: boolean
}

type ApiAccount = {
  id: number
  name: string
  currency?: string | null
  is_active?: number | boolean
  active?: boolean
}

type ApiReconciliation = {
  id: number
  accountId?: number
  account_id?: number
  date: string
  realBalance?: number | null
  real_balance?: number | null
  calculatedBalance?: number | null
  calculated_balance?: number | null
  difference?: number | null
  status?: string | null
  isActive?: number | boolean | null
  is_active?: number | boolean | null
  note?: string | null
  createdAt?: string | null
  created_at?: string | null
  closedAt?: string | null
  closed_at?: string | null
}

type ReconciliationStatus = "OPEN" | "BALANCED" | "IGNORED"

interface ReconciliationHistoryItem {
  id: number
  accountId: number
  date: string
  realBalance: number
  calculatedBalance: number
  difference: number
  status: ReconciliationStatus
  note: string | null
  createdAt: string | null
  closedAt: string | null
}

interface NewReconciliationForm {
  accountId: string
  date: string
  realBalance: string
  note: string
}

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "")
const API_BASE_URL = `${API_ROOT}/api`

function toNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toBoolean(value: unknown) {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value === 1
  return Boolean(value)
}

function isBalanced(difference: number) {
  return Math.abs(difference) < 0.01
}

function normalizeStatus(
  status: string | null | undefined,
  difference: number,
): ReconciliationStatus {
  if (status?.toUpperCase() === "IGNORED") return "IGNORED"
  if (status?.toUpperCase() === "OPEN") return "OPEN"
  if (status?.toUpperCase() === "BALANCED") return "BALANCED"
  return isBalanced(difference) ? "BALANCED" : "OPEN"
}

function formatDate(date: string) {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date

  return new Intl.DateTimeFormat("es-CR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(parsed)
}

function getDefaultReconciliationDate() {
  return new Date().toISOString().split("T")[0] ?? ""
}

function parseRealBalance(value: string) {
  const normalized = value.trim().replace(/\s+/g, "").replace(/,/g, ".")
  if (!normalized) return null

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function getApiErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback

  const directMessage = (payload as { message?: unknown }).message
  if (typeof directMessage === "string" && directMessage.trim().length > 0) {
    return directMessage
  }

  const errorPayload = (payload as { error?: { message?: unknown; details?: unknown } }).error
  const nestedMessage = errorPayload?.message
  if (typeof nestedMessage === "string" && nestedMessage.trim().length > 0) {
    return nestedMessage
  }

  const details = errorPayload?.details
  if (Array.isArray(details) && details.length > 0) {
    const firstDetail = details[0]
    if (typeof firstDetail === "string" && firstDetail.trim().length > 0) {
      return firstDetail
    }

    if (firstDetail && typeof firstDetail === "object") {
      const detailMessage = (firstDetail as { message?: unknown }).message
      if (typeof detailMessage === "string" && detailMessage.trim().length > 0) {
        return detailMessage
      }
    }
  }

  return fallback
}

function normalizeReconciliation(
  item: ApiReconciliation,
  fallbackAccountId: number,
): ReconciliationHistoryItem {
  const calculatedBalance = toNumber(item.calculatedBalance ?? item.calculated_balance)
  const realBalance = toNumber(item.realBalance ?? item.real_balance)
  const difference = toNumber(item.difference ?? realBalance - calculatedBalance)

  return {
    id: item.id,
    accountId: toNumber(item.accountId ?? item.account_id ?? fallbackAccountId),
    date: item.date,
    realBalance,
    calculatedBalance,
    difference,
    status: normalizeStatus(item.status, difference),
    note: item.note ?? null,
    createdAt: item.createdAt ?? item.created_at ?? null,
    closedAt: item.closedAt ?? item.closed_at ?? null,
  }
}

async function fetchAccounts(): Promise<Account[]> {
  const response = await fetch(`${API_BASE_URL}/accounts`, {
    headers: { Accept: "application/json" },
  })

  if (!response.ok) {
    throw new Error("Failed to load accounts")
  }

  const data = (await response.json()) as ApiAccount[]
  return data.map((account) => ({
    id: account.id,
    name: account.name,
    currency: account.currency || "CRC",
    active: toBoolean(account.is_active ?? account.active),
  }))
}

async function fetchReconciliations(accountId: number): Promise<ReconciliationHistoryItem[]> {
  const params = new URLSearchParams({
    account_id: accountId.toString(),
    limit: "50",
    offset: "0",
  })

  const response = await fetch(`${API_BASE_URL}/reconciliations?${params.toString()}`, {
    headers: { Accept: "application/json" },
  })

  if (!response.ok) {
    throw new Error("Failed to load reconciliation history")
  }

  const data = (await response.json()) as ApiReconciliation[]
  return data
    .map((item) => normalizeReconciliation(item, accountId))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

async function createReconciliation(payload: {
  accountId: number
  date: string
  realBalance: number
  note?: string
}): Promise<ReconciliationHistoryItem> {
  const response = await fetch(`${API_BASE_URL}/reconciliations`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    let message = "Failed to create reconciliation"

    try {
      const payload = (await response.json()) as unknown
      message = getApiErrorMessage(payload, message)
    } catch {}

    throw new Error(message)
  }

  const data = (await response.json()) as ApiReconciliation
  return normalizeReconciliation(data, payload.accountId)
}

async function ignoreReconciliation(
  reconciliationId: number,
  accountId: number,
): Promise<ReconciliationHistoryItem> {
  const response = await fetch(`${API_BASE_URL}/reconciliations/${reconciliationId}/ignore`, {
    method: "POST",
    headers: { Accept: "application/json" },
  })

  if (!response.ok) {
    let message = "Failed to ignore reconciliation"

    try {
      const payload = (await response.json()) as unknown
      message = getApiErrorMessage(payload, message)
    } catch {}

    throw new Error(message)
  }

  const data = (await response.json()) as ApiReconciliation
  return normalizeReconciliation(data, accountId)
}

function StatusIndicator({ status }: { status: ReconciliationStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === "OPEN" && "border-warning/40 bg-warning/10 text-warning",
        status === "BALANCED" && "border-success/40 bg-success/10 text-success",
        status === "IGNORED" && "border-muted bg-muted text-muted-foreground",
      )}
    >
      {status === "OPEN" ? "Open" : status === "BALANCED" ? "Balanced" : "Ignored"}
    </Badge>
  )
}

export function ReconciliationContent() {
  const [accounts, setAccounts] = React.useState<Account[]>([])
  const [selectedAccountId, setSelectedAccountId] = React.useState("")
  const [reconciliations, setReconciliations] = React.useState<ReconciliationHistoryItem[]>([])
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [accountsLoading, setAccountsLoading] = React.useState(true)
  const [historyLoading, setHistoryLoading] = React.useState(false)
  const [createLoading, setCreateLoading] = React.useState(false)
  const [ignoreLoading, setIgnoreLoading] = React.useState(false)
  const [hasLoadedHistory, setHasLoadedHistory] = React.useState(false)
  const [accountsError, setAccountsError] = React.useState<string | null>(null)
  const [historyError, setHistoryError] = React.useState<string | null>(null)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [ignoreError, setIgnoreError] = React.useState<string | null>(null)
  const [ignoreId, setIgnoreId] = React.useState<number | null>(null)
  const [createForm, setCreateForm] = React.useState<NewReconciliationForm>({
    accountId: "",
    date: getDefaultReconciliationDate(),
    realBalance: "",
    note: "",
  })
  const selectedAccountIdRef = React.useRef("")

  React.useEffect(() => {
    selectedAccountIdRef.current = selectedAccountId
  }, [selectedAccountId])

  const selectableAccounts = React.useMemo(() => {
    const preferred = accounts.filter((account) => account.active)
    const list = preferred.length > 0 ? preferred : accounts
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [accounts])

  const selectedAccount = React.useMemo(
    () => selectableAccounts.find((account) => account.id.toString() === selectedAccountId) ?? null,
    [selectableAccounts, selectedAccountId],
  )

  const parsedRealBalance = React.useMemo(
    () => parseRealBalance(createForm.realBalance),
    [createForm.realBalance],
  )

  const createFormErrors = React.useMemo(
    () => ({
      accountId: createForm.accountId ? "" : "Select an account.",
      date: createForm.date ? "" : "Select a reconciliation date.",
      realBalance:
        createForm.realBalance.trim().length === 0
          ? "Enter the real balance from the bank."
          : parsedRealBalance === null
            ? "Enter a valid numeric amount."
            : "",
    }),
    [createForm.accountId, createForm.date, createForm.realBalance, parsedRealBalance],
  )

  const isCreateFormValid = React.useMemo(
    () => Object.values(createFormErrors).every((value) => value.length === 0),
    [createFormErrors],
  )

  const resetCreateForm = React.useCallback(
    (accountId?: string) => {
      setCreateForm({
        accountId:
          accountId || selectedAccountIdRef.current || selectableAccounts[0]?.id.toString() || "",
        date: getDefaultReconciliationDate(),
        realBalance: "",
        note: "",
      })
      setCreateError(null)
    },
    [selectableAccounts],
  )

  const loadAccounts = React.useCallback(async () => {
    try {
      setAccountsLoading(true)
      setAccountsError(null)

      const accountsData = await fetchAccounts()
      setAccounts(accountsData)

      const preferred = accountsData.filter((account) => account.active)
      const available = preferred.length > 0 ? preferred : accountsData
      const nextSelectedAccountId =
        selectedAccountIdRef.current &&
        accountsData.some((account) => account.id.toString() === selectedAccountIdRef.current)
          ? selectedAccountIdRef.current
          : (available[0]?.id.toString() ?? "")

      setSelectedAccountId(nextSelectedAccountId)

      return nextSelectedAccountId
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load accounts"
      setAccounts([])
      setAccountsError(message)
      return ""
    } finally {
      setAccountsLoading(false)
    }
  }, [])

  const loadReconciliationHistory = React.useCallback(async (accountId: string) => {
    if (!accountId) {
      setReconciliations([])
      setHistoryError(null)
      setHasLoadedHistory(true)
      return
    }

    try {
      setHistoryLoading(true)
      setHistoryError(null)

      const history = await fetchReconciliations(Number(accountId))
      setReconciliations(history)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load reconciliation history"
      setReconciliations([])
      setHistoryError(message)
    } finally {
      setHistoryLoading(false)
      setHasLoadedHistory(true)
    }
  }, [])

  React.useEffect(() => {
    void loadAccounts()
  }, [loadAccounts])

  React.useEffect(() => {
    void loadReconciliationHistory(selectedAccountId)
  }, [loadReconciliationHistory, selectedAccountId])

  const handleOpenCreate = () => {
    resetCreateForm(selectedAccountId || selectableAccounts[0]?.id.toString())
    setIsCreateOpen(true)
  }

  const handleCreate = async () => {
    if (!isCreateFormValid || parsedRealBalance === null) {
      setCreateError("Complete the required fields with valid values.")
      return
    }

    try {
      setCreateLoading(true)
      setCreateError(null)

      const accountId = createForm.accountId
      await createReconciliation({
        accountId: Number(accountId),
        date: createForm.date,
        realBalance: parsedRealBalance,
        note: createForm.note.trim() || undefined,
      })

      setIsCreateOpen(false)
      resetCreateForm(accountId)

      if (accountId === selectedAccountIdRef.current) {
        await loadReconciliationHistory(accountId)
      } else {
        setSelectedAccountId(accountId)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create reconciliation"
      setCreateError(message)
    } finally {
      setCreateLoading(false)
    }
  }

  const handleRefresh = async () => {
    const nextSelectedAccountId = await loadAccounts()
    await loadReconciliationHistory(nextSelectedAccountId || selectedAccountId)
  }

  const handleIgnore = async () => {
    if (ignoreId === null || !selectedAccount) return

    try {
      setIgnoreLoading(true)
      setIgnoreError(null)

      await ignoreReconciliation(ignoreId, selectedAccount.id)
      setIgnoreId(null)
      await loadReconciliationHistory(selectedAccount.id.toString())
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to ignore reconciliation"
      setIgnoreError(message)
    } finally {
      setIgnoreLoading(false)
    }
  }

  const latestReconciliation = reconciliations[0] ?? null

  if (accountsLoading || (!hasLoadedHistory && selectableAccounts.length > 0)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (accountsError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Unable to load reconciliation screen"
        description={accountsError}
        actionLabel="Try Again"
        onAction={() => void handleRefresh()}
      />
    )
  }

  if (selectableAccounts.length === 0) {
    return (
      <EmptyState
        icon={Scale}
        title="No accounts available"
        description="Create or activate an account to view its reconciliation history."
        actionLabel="Refresh"
        onAction={() => void handleRefresh()}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reconciliation History</h2>
          <p className="text-muted-foreground">
            Review the latest reconciliation results for each account.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="min-w-[240px] space-y-2">
            <p className="text-sm font-medium">Account</p>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {selectableAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id.toString()}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Reconciliation
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleRefresh()}
            disabled={accountsLoading || historyLoading}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", historyLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>{selectedAccount?.name ?? "Selected account"}</CardTitle>
            <CardDescription>
              {reconciliations.length > 0
                ? `${reconciliations.length} reconciliation record${reconciliations.length === 1 ? "" : "s"} found`
                : "No reconciliation records yet"}
            </CardDescription>
          </div>

          {latestReconciliation && (
            <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Latest reconciliation
                </p>
                <p className="text-sm font-medium">{formatDate(latestReconciliation.date)}</p>
              </div>
              <StatusIndicator status={latestReconciliation.status} />
            </div>
          )}
        </CardHeader>

        <CardContent>
          {historyError ? (
            <EmptyState
              icon={AlertCircle}
              title="Unable to load reconciliation history"
              description={historyError}
              actionLabel="Retry"
              onAction={() => void loadReconciliationHistory(selectedAccountId)}
            />
          ) : historyLoading ? (
            <div className="flex h-40 items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : reconciliations.length === 0 ? (
            <EmptyState
              icon={Scale}
              title="No reconciliation history"
              description={`There are no reconciliations for ${selectedAccount?.name ?? "this account"} yet.`}
              actionLabel="Refresh"
              onAction={() => void loadReconciliationHistory(selectedAccountId)}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Real Balance</TableHead>
                  <TableHead className="text-right">Calculated Balance</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reconciliations.map((reconciliation) => {
                  const isOpen = reconciliation.status === "OPEN"
                  const currency = selectedAccount?.currency ?? "CRC"

                  return (
                    <TableRow
                      key={reconciliation.id}
                      className={cn(
                        isOpen && "bg-warning/5",
                        reconciliation.status === "IGNORED" && "bg-muted/40",
                      )}
                    >
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{formatDate(reconciliation.date)}</p>
                          {reconciliation.closedAt && (
                            <p className="text-xs text-muted-foreground">
                              Closed {formatDate(reconciliation.closedAt)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(reconciliation.realBalance, currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(reconciliation.calculatedBalance, currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            "font-mono font-semibold",
                            isOpen
                              ? "text-warning"
                              : reconciliation.status === "IGNORED"
                                ? "text-muted-foreground"
                                : "text-success",
                          )}
                        >
                          {formatSignedCurrency(reconciliation.difference, currency)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusIndicator status={reconciliation.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {reconciliation.status === "OPEN" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIgnoreError(null)
                              setIgnoreId(reconciliation.id)
                            }}
                          >
                            Ignore
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">No actions</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          if (createLoading) return
          setIsCreateOpen(open)
          if (!open) {
            resetCreateForm(selectedAccountId || selectableAccounts[0]?.id.toString())
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Reconciliation</DialogTitle>
            <DialogDescription>
              Start a new reconciliation by selecting an account, date, and real bank balance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {createError && (
              <Alert className="border-warning/50 bg-warning/5">
                <AlertCircle className="h-4 w-4 text-warning" />
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="reconciliation-account">Account</Label>
              <Select
                value={createForm.accountId}
                onValueChange={(value) =>
                  setCreateForm((current) => ({
                    ...current,
                    accountId: value,
                  }))
                }
              >
                <SelectTrigger
                  id="reconciliation-account"
                  aria-invalid={Boolean(createFormErrors.accountId)}
                >
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {selectableAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {createFormErrors.accountId && (
                <p className="text-xs text-destructive">{createFormErrors.accountId}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reconciliation-date">Reconciliation Date</Label>
              <Input
                id="reconciliation-date"
                type="date"
                value={createForm.date}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    date: event.target.value,
                  }))
                }
                aria-invalid={Boolean(createFormErrors.date)}
              />
              {createFormErrors.date && (
                <p className="text-xs text-destructive">{createFormErrors.date}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reconciliation-real-balance">Real Balance</Label>
              <Input
                id="reconciliation-real-balance"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 123456.78"
                value={createForm.realBalance}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    realBalance: event.target.value,
                  }))
                }
                className="font-mono"
                aria-invalid={Boolean(createFormErrors.realBalance)}
              />
              {createFormErrors.realBalance ? (
                <p className="text-xs text-destructive">{createFormErrors.realBalance}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Use digits with an optional decimal separator.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reconciliation-note">Note</Label>
              <Textarea
                id="reconciliation-note"
                placeholder="Optional note for this reconciliation"
                value={createForm.note}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false)
                resetCreateForm(selectedAccountId || selectableAccounts[0]?.id.toString())
              }}
              disabled={createLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!isCreateFormValid || createLoading}>
              {createLoading ? "Creating..." : "Create Reconciliation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={ignoreId !== null}
        onOpenChange={(open) => {
          if (ignoreLoading) return
          if (!open) {
            setIgnoreId(null)
            setIgnoreError(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ignore this reconciliation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the active reconciliation as ignored, close it, and let you create a
              new reconciliation for the same account.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {ignoreError && (
            <Alert className="border-warning/50 bg-warning/5">
              <AlertCircle className="h-4 w-4 text-warning" />
              <AlertDescription>{ignoreError}</AlertDescription>
            </Alert>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIgnoreId(null)
                setIgnoreError(null)
              }}
              disabled={ignoreLoading}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleIgnore()
              }}
              disabled={ignoreLoading}
            >
              {ignoreLoading ? "Ignoring..." : "Ignore Reconciliation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
