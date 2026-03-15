"use client"

import { AlertCircle, RefreshCw, Scale } from "lucide-react"
import * as React from "react"

import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

type ReconciliationStatus = "BALANCED" | "DIFFERENCE"

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
  if (status?.toUpperCase() === "BALANCED") return "BALANCED"
  return isBalanced(difference) ? "BALANCED" : "DIFFERENCE"
}

function formatCurrency(amount: number, currency = "CRC") {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "CRC" ? 0 : 2,
  }).format(amount)
}

function formatSignedCurrency(amount: number, currency = "CRC") {
  const formatted = formatCurrency(Math.abs(amount), currency)
  if (isBalanced(amount)) return formatted
  return `${amount > 0 ? "+" : "-"}${formatted}`
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
    .map((item) => {
      const calculatedBalance = toNumber(item.calculatedBalance ?? item.calculated_balance)
      const realBalance = toNumber(item.realBalance ?? item.real_balance)
      const difference = toNumber(item.difference ?? realBalance - calculatedBalance)

      return {
        id: item.id,
        accountId: toNumber(item.accountId ?? item.account_id ?? accountId),
        date: item.date,
        realBalance,
        calculatedBalance,
        difference,
        status: normalizeStatus(item.status, difference),
        note: item.note ?? null,
        createdAt: item.createdAt ?? item.created_at ?? null,
        closedAt: item.closedAt ?? item.closed_at ?? null,
      }
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

function StatusIndicator({ status }: { status: ReconciliationStatus }) {
  const isDifference = status === "DIFFERENCE"

  return (
    <Badge
      variant="outline"
      className={cn(
        isDifference
          ? "border-warning/40 bg-warning/10 text-warning"
          : "border-success/40 bg-success/10 text-success",
      )}
    >
      {isDifference ? "Difference" : "Balanced"}
    </Badge>
  )
}

export function ReconciliationContent() {
  const [accounts, setAccounts] = React.useState<Account[]>([])
  const [selectedAccountId, setSelectedAccountId] = React.useState("")
  const [reconciliations, setReconciliations] = React.useState<ReconciliationHistoryItem[]>([])
  const [accountsLoading, setAccountsLoading] = React.useState(true)
  const [historyLoading, setHistoryLoading] = React.useState(false)
  const [hasLoadedHistory, setHasLoadedHistory] = React.useState(false)
  const [accountsError, setAccountsError] = React.useState<string | null>(null)
  const [historyError, setHistoryError] = React.useState<string | null>(null)
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

  const handleRefresh = async () => {
    const nextSelectedAccountId = await loadAccounts()
    await loadReconciliationHistory(nextSelectedAccountId || selectedAccountId)
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {reconciliations.map((reconciliation) => {
                  const isDifference = reconciliation.status === "DIFFERENCE"
                  const currency = selectedAccount?.currency ?? "CRC"

                  return (
                    <TableRow
                      key={reconciliation.id}
                      className={cn(isDifference && "bg-warning/5")}
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
                            isDifference ? "text-warning" : "text-success",
                          )}
                        >
                          {formatSignedCurrency(reconciliation.difference, currency)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusIndicator status={reconciliation.status} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
