"use client"

import {
  AlertTriangle,
  ArrowRightLeft,
  Landmark,
  Layers3,
  MinusCircle,
  Plus,
  TrendingDown,
  Wallet,
  XCircle,
} from "lucide-react"
import * as React from "react"

import { EmptyState } from "@/components/empty-state"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency, formatSignedCurrency } from "@/lib/currency-formatter"
import {
  buildEnvelopeInsights,
  summarizeEnvelopeInsights,
  type EnvelopeInsight,
  type EnvelopeInsightInput,
  type EnvelopeVisualStatus,
} from "@/lib/envelope-insights"
import { cn } from "@/lib/utils"

type EnvelopeRow = EnvelopeInsightInput

type AccountSummary = {
  id: number
  name: string
  currency: string
  active: boolean
  institution: string | null
  type: string | null
  balance: number
}

type CategoryOption = {
  id: number
  name: string
  parentId: number | null
}

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "")
const API_BASE_URL = `${API_ROOT}/api`

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

function formatShare(share: number) {
  return percentFormatter.format(share)
}

function statusBadgeClassName(status: EnvelopeVisualStatus) {
  if (status === "healthy") return "border-success/35 bg-success/10 text-success"
  if (status === "low") return "border-warning/35 bg-warning/10 text-warning"
  if (status === "critical") return "border-error/35 bg-error/10 text-error"
  return "border-muted bg-muted/50 text-muted-foreground"
}

function statusLabel(status: EnvelopeVisualStatus) {
  if (status === "healthy") return "Healthy"
  if (status === "low") return "Low"
  if (status === "critical") return "Critical"
  return "Empty"
}

function barClassName(status: EnvelopeVisualStatus) {
  if (status === "healthy") return "bg-success/80"
  if (status === "low") return "bg-warning/80"
  if (status === "critical") return "bg-error/80"
  return "bg-muted-foreground/35"
}

function normalizeErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "default",
}: {
  title: string
  value: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  tone?: "default" | "warning" | "critical" | "success"
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-muted/20 p-4",
        tone === "warning" && "border-warning/20",
        tone === "critical" && "border-error/20",
        tone === "success" && "border-success/20",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
        <Icon
          className={cn(
            "h-4 w-4 text-muted-foreground",
            tone === "warning" && "text-warning",
            tone === "critical" && "text-error",
            tone === "success" && "text-success",
          )}
        />
      </div>
      <p className="text-xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function EnvelopeDistributionRow({
  envelope,
  accountCurrency,
  onDeactivate,
}: {
  envelope: EnvelopeInsight
  accountCurrency: string
  onDeactivate: (envelopeId: number) => void
}) {
  const isDeactivateDisabled = envelope.balance !== 0 || !envelope.active
  const deactivateTitle = !envelope.active
    ? "Envelope already inactive"
    : envelope.balance !== 0
      ? "Balance must be zero to deactivate"
      : "Deactivate envelope"

  return (
    <div className="group rounded-xl border border-border/80 bg-card/60 p-4 transition-colors hover:border-primary/25 hover:bg-muted/15">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold">{envelope.category}</p>
            <Badge variant="outline" className={statusBadgeClassName(envelope.statusVisual)}>
              {statusLabel(envelope.statusVisual)}
            </Badge>
            {!envelope.active ? <Badge variant="secondary">Inactive</Badge> : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{formatShare(envelope.percentageOfAccount)} of account</span>
              <span>{formatCurrency(envelope.balance, accountCurrency)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted/60">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  barClassName(envelope.statusVisual),
                )}
                style={{ width: `${envelope.barPercentage}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 xl:min-w-[280px] xl:justify-end">
          <div className="text-right">
            <p
              className={cn(
                "font-mono text-lg font-semibold",
                envelope.balance > 0 && envelope.statusVisual === "healthy" && "text-success",
                envelope.statusVisual === "low" && "text-warning",
                envelope.statusVisual === "critical" && "text-error",
                envelope.statusVisual === "empty" && "text-muted-foreground",
              )}
            >
              {formatCurrency(envelope.balance, accountCurrency)}
            </p>
            <p className="text-xs text-muted-foreground">
              {envelope.statusVisual === "critical"
                ? "Needs funding attention"
                : envelope.statusVisual === "low"
                  ? "Low relative share"
                  : envelope.statusVisual === "empty"
                    ? "No funds assigned"
                    : "Healthy envelope"}
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (isDeactivateDisabled) return
              onDeactivate(envelope.id)
            }}
            disabled={isDeactivateDisabled}
            className={cn("shrink-0", isDeactivateDisabled && "opacity-50")}
            title={deactivateTitle}
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function LinkCategoryDialog({
  isOpen,
  onOpenChange,
  selectedAccountLabel,
  selectableCategories,
  categoriesLoading,
  categoriesError,
  hasCategories,
  formData,
  setFormData,
  handleLinkCategory,
  isLinking,
  linkError,
  disabled,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  selectedAccountLabel: string
  selectableCategories: CategoryOption[]
  categoriesLoading: boolean
  categoriesError: string | null
  hasCategories: boolean
  formData: { categoryId: string }
  setFormData: React.Dispatch<React.SetStateAction<{ categoryId: string }>>
  handleLinkCategory: () => Promise<void>
  isLinking: boolean
  linkError: string | null
  disabled: boolean
}) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        onOpenChange(open)
        if (!open) {
          setFormData({ categoryId: "" })
        }
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={disabled}>
          <Plus className="mr-2 h-4 w-4" />
          Link Category
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link Category to Account</DialogTitle>
          <DialogDescription>
            Create an envelope by linking a category to {selectedAccountLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <Select
              value={formData.categoryId}
              onValueChange={(value) => setFormData({ categoryId: value })}
              disabled={categoriesLoading || !hasCategories}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    categoriesLoading
                      ? "Loading categories..."
                      : !hasCategories
                        ? "No active categories"
                        : "Select a category"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {selectableCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categoriesError ? <p className="text-sm text-error">{categoriesError}</p> : null}
            {linkError ? <p className="text-sm text-error">{linkError}</p> : null}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              setFormData({ categoryId: "" })
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleLinkCategory()}
            disabled={!formData.categoryId || isLinking}
          >
            {isLinking ? "Linking..." : "Link Category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EnvelopesContent() {
  const [envelopes, setEnvelopes] = React.useState<EnvelopeRow[]>([])
  const [envelopesLoading, setEnvelopesLoading] = React.useState(false)
  const [envelopesError, setEnvelopesError] = React.useState<string | null>(null)
  const [accounts, setAccounts] = React.useState<AccountSummary[]>([])
  const [accountsLoading, setAccountsLoading] = React.useState(false)
  const [accountsError, setAccountsError] = React.useState<string | null>(null)
  const [categories, setCategories] = React.useState<CategoryOption[]>([])
  const [categoriesLoading, setCategoriesLoading] = React.useState(false)
  const [categoriesError, setCategoriesError] = React.useState<string | null>(null)
  const [selectedAccount, setSelectedAccount] = React.useState("")
  const [isLinkOpen, setIsLinkOpen] = React.useState(false)
  const [isLinking, setIsLinking] = React.useState(false)
  const [linkError, setLinkError] = React.useState<string | null>(null)
  const [deactivateId, setDeactivateId] = React.useState<number | null>(null)
  const [isDeactivating, setIsDeactivating] = React.useState(false)
  const [deactivateError, setDeactivateError] = React.useState<string | null>(null)
  const [formData, setFormData] = React.useState({
    categoryId: "",
  })

  React.useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setAccountsLoading(true)
        setAccountsError(null)

        const res = await fetch(`${API_BASE_URL}/reports/account-balances?isActive=true`, {
          headers: { Accept: "application/json" },
        })
        if (!res.ok) throw new Error("Failed to load accounts")

        const data = (await res.json()) as Array<{
          id: number
          name: string
          currency: string
          institution?: string | null
          type?: string | null
          balance?: number | null
          is_active: number
        }>

        setAccounts(
          data.map((account) => ({
            id: account.id,
            name: account.name,
            currency: account.currency,
            active: account.is_active === 1,
            institution: account.institution ?? null,
            type: account.type ?? null,
            balance: typeof account.balance === "number" ? account.balance : 0,
          })),
        )
      } catch (error) {
        setAccountsError(normalizeErrorMessage(error, "Failed to load accounts"))
      } finally {
        setAccountsLoading(false)
      }
    }

    void fetchAccounts()
  }, [])

  React.useEffect(() => {
    const fetchCategories = async () => {
      try {
        setCategoriesLoading(true)
        setCategoriesError(null)
        const res = await fetch(`${API_BASE_URL}/categories?activeOnly=true`, {
          headers: { Accept: "application/json" },
        })
        if (!res.ok) throw new Error("Failed to load categories")

        const data = (await res.json()) as Array<{
          id: number
          name: string
          parentId?: number | null
          parent_id?: number | null
          parent?: { id?: number | null } | number | null
        }>

        setCategories(
          data.map((category) => ({
            id: category.id,
            name: category.name,
            parentId:
              category.parentId ??
              category.parent_id ??
              (typeof category.parent === "object" && category.parent
                ? (category.parent.id ?? null)
                : (category.parent ?? null)),
          })),
        )
      } catch (error) {
        setCategoriesError(normalizeErrorMessage(error, "Failed to load categories"))
      } finally {
        setCategoriesLoading(false)
      }
    }

    void fetchCategories()
  }, [])

  const activeAccounts = accounts.filter((account) => account.active)
  const selectableCategories = categories.filter((category) => category.parentId !== null)
  const hasCategories = selectableCategories.length > 0

  React.useEffect(() => {
    if (activeAccounts.length === 0) {
      setSelectedAccount("")
      return
    }

    setSelectedAccount((current) =>
      activeAccounts.some((account) => account.id.toString() === current)
        ? current
        : activeAccounts[0].id.toString(),
    )
  }, [activeAccounts])

  const selectedAccountId = Number.parseInt(selectedAccount, 10)
  const isAccountSelected = !Number.isNaN(selectedAccountId)
  const selectedAccountData =
    activeAccounts.find((account) => account.id === selectedAccountId) ?? null

  const fetchEnvelopes = React.useCallback(async (accountId: number) => {
    try {
      setEnvelopesLoading(true)
      setEnvelopesError(null)

      const res = await fetch(`${API_BASE_URL}/reports/envelope-balances?accountId=${accountId}`, {
        headers: { Accept: "application/json" },
      })
      if (!res.ok) throw new Error("Failed to load envelope balances")

      const data = (await res.json()) as Array<{
        envelopeId: number
        categoryId: number
        categoryName: string
        balance: number | null
        currency: string
      }>

      setEnvelopes(
        data.map((item) => ({
          id: item.envelopeId,
          accountId,
          categoryId: item.categoryId,
          category: item.categoryName,
          balance: typeof item.balance === "number" ? item.balance : 0,
          currency: item.currency,
          active: true,
        })),
      )
    } catch (error) {
      setEnvelopesError(normalizeErrorMessage(error, "Failed to load envelope balances"))
      setEnvelopes([])
    } finally {
      setEnvelopesLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (!isAccountSelected) {
      setEnvelopes([])
      setEnvelopesError(null)
      return
    }

    void fetchEnvelopes(selectedAccountId)
  }, [fetchEnvelopes, isAccountSelected, selectedAccountId])

  const handleLinkCategory = async () => {
    if (Number.isNaN(selectedAccountId) || !formData.categoryId || isLinking) return

    try {
      setIsLinking(true)
      setLinkError(null)

      const res = await fetch(`${API_BASE_URL}/accounts/${selectedAccountId}/envelopes`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          categoryId: Number.parseInt(formData.categoryId, 10),
        }),
      })

      if (!res.ok) {
        let message = "Failed to link category"
        try {
          const err = (await res.json()) as {
            error?: { message?: string }
            message?: string
          }
          message = err?.error?.message || err?.message || message
        } catch {}
        throw new Error(message)
      }

      setIsLinkOpen(false)
      setFormData({ categoryId: "" })
      await fetchEnvelopes(selectedAccountId)
    } catch (error) {
      setLinkError(normalizeErrorMessage(error, "Failed to link category"))
    } finally {
      setIsLinking(false)
    }
  }

  const handleDeactivate = async () => {
    if (!deactivateId || isDeactivating) return

    const envelope = envelopes.find((item) => item.id === deactivateId)
    if (!envelope) return
    if (envelope.balance !== 0) {
      setDeactivateError("Cannot deactivate an envelope with a non-zero balance.")
      return
    }

    try {
      setIsDeactivating(true)
      setDeactivateError(null)

      const res = await fetch(`${API_BASE_URL}/envelopes/${deactivateId}/deactivate`, {
        method: "POST",
        headers: { Accept: "application/json" },
      })

      if (!res.ok) {
        let message = "Failed to deactivate envelope."
        try {
          const err = (await res.json()) as { error?: { message?: string }; message?: string }
          message = err?.error?.message || err?.message || message
        } catch {}
        throw new Error(message)
      }

      if (!Number.isNaN(selectedAccountId)) {
        await fetchEnvelopes(selectedAccountId)
      }
      setDeactivateId(null)
    } catch (error) {
      setDeactivateError(normalizeErrorMessage(error, "Failed to deactivate envelope."))
    } finally {
      setIsDeactivating(false)
    }
  }

  const selectedAccountLabel = selectedAccountData?.name ?? "this account"
  const selectedAccountCurrency = selectedAccountData?.currency ?? "CRC"
  const envelopeRows = envelopes.filter((envelope) => envelope.accountId === selectedAccountId)
  const envelopeInsights = buildEnvelopeInsights(
    envelopeRows,
    selectedAccountData?.balance ?? 0,
  ).sort((left, right) => right.balance - left.balance)
  const summary = summarizeEnvelopeInsights(envelopeRows, selectedAccountData?.balance ?? 0)
  const hasNegativeEnvelopes = summary.negativeEnvelopesCount > 0
  const coverageTone =
    summary.assignedPercentage < 0 || summary.assignedPercentage > 100 ? "warning" : "default"

  if (accountsError) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Unable to load envelopes"
        description={accountsError}
        actionLabel="Retry"
        onAction={() => window.location.reload()}
      />
    )
  }

  if (accountsLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Loading envelopes workspace...
          </CardContent>
        </Card>
      </div>
    )
  }

  if (activeAccounts.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="No active accounts"
        description="Activate or create an account before managing its envelope distribution."
      />
    )
  }

  if (!isAccountSelected || !selectedAccountData) {
    return (
      <EmptyState
        icon={Layers3}
        title="Select an account"
        description="Choose an account to understand how its money is distributed across envelopes."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Envelopes</h2>
          <p className="text-muted-foreground">
            Understand how money is distributed inside the selected account.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-[260px] space-y-2">
            <p className="text-sm font-medium">Account</p>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent>
                {activeAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id.toString()}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="pt-0 sm:pt-7">
            <LinkCategoryDialog
              isOpen={isLinkOpen}
              onOpenChange={(open) => {
                setIsLinkOpen(open)
                if (!open) setLinkError(null)
              }}
              selectedAccountLabel={selectedAccountLabel}
              selectableCategories={selectableCategories}
              categoriesLoading={categoriesLoading}
              categoriesError={categoriesError}
              hasCategories={hasCategories}
              formData={formData}
              setFormData={setFormData}
              handleLinkCategory={handleLinkCategory}
              isLinking={isLinking}
              linkError={linkError}
              disabled={!isAccountSelected}
            />
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-muted/10">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-2xl">{selectedAccountData.name}</CardTitle>
                <Badge variant="outline">{selectedAccountData.currency}</Badge>
                {selectedAccountData.type ? (
                  <Badge variant="secondary">{selectedAccountData.type}</Badge>
                ) : null}
              </div>

              <CardDescription className="flex flex-wrap items-center gap-4 text-sm">
                <span className="inline-flex items-center gap-2">
                  <Landmark className="h-4 w-4" />
                  {selectedAccountData.institution || "Institution unavailable"}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Layers3 className="h-4 w-4" />
                  {summary.activeEnvelopesCount} active envelope
                  {summary.activeEnvelopesCount === 1 ? "" : "s"}
                </span>
              </CardDescription>
            </div>

            <div className="rounded-2xl border border-primary/15 bg-primary/5 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Account Balance
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {formatCurrency(selectedAccountData.balance, selectedAccountCurrency)}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            title="Envelope Coverage"
            value={`${summary.assignedPercentage.toFixed(1)}%`}
            description="Envelope total compared with account balance."
            icon={ArrowRightLeft}
            tone={coverageTone}
          />
          <MetricCard
            title="Unassigned Delta"
            value={formatSignedCurrency(summary.availableDelta, selectedAccountCurrency)}
            description="Difference between account balance and summed envelopes."
            icon={MinusCircle}
            tone={Math.abs(summary.availableDelta) < 0.01 ? "success" : "warning"}
          />
          <MetricCard
            title="Largest Envelope"
            value={summary.largestEnvelope ? summary.largestEnvelope.category : "No envelopes yet"}
            description={
              summary.largestEnvelope
                ? formatCurrency(summary.largestEnvelope.balance, selectedAccountCurrency)
                : "Link a category to start."
            }
            icon={Wallet}
          />
          <MetricCard
            title="Smallest Positive"
            value={
              summary.smallestPositiveEnvelope
                ? summary.smallestPositiveEnvelope.category
                : "No positive envelopes"
            }
            description={
              summary.smallestPositiveEnvelope
                ? formatCurrency(summary.smallestPositiveEnvelope.balance, selectedAccountCurrency)
                : "Nothing active with balance yet."
            }
            icon={Layers3}
          />
          <MetricCard
            title="Negative Envelopes"
            value={String(summary.negativeEnvelopesCount)}
            description="Envelopes below zero that need review."
            icon={TrendingDown}
            tone={summary.negativeEnvelopesCount > 0 ? "critical" : "success"}
          />
        </CardContent>
      </Card>

      {envelopesError ? (
        <EmptyState
          icon={AlertTriangle}
          title="Unable to load envelopes"
          description={envelopesError}
          actionLabel="Retry"
          onAction={() => void fetchEnvelopes(selectedAccountId)}
        />
      ) : envelopesLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading envelope distribution...
          </CardContent>
        </Card>
      ) : envelopeInsights.length === 0 ? (
        <EmptyState
          icon={Layers3}
          title="No envelopes linked yet"
          description={`There are no envelopes for ${selectedAccountLabel}. Link a category to start organizing this account.`}
        >
          <div className="mt-4">
            <LinkCategoryDialog
              isOpen={isLinkOpen}
              onOpenChange={(open) => {
                setIsLinkOpen(open)
                if (!open) setLinkError(null)
              }}
              selectedAccountLabel={selectedAccountLabel}
              selectableCategories={selectableCategories}
              categoriesLoading={categoriesLoading}
              categoriesError={categoriesError}
              hasCategories={hasCategories}
              formData={formData}
              setFormData={setFormData}
              handleLinkCategory={handleLinkCategory}
              isLinking={isLinking}
              linkError={linkError}
              disabled={!isAccountSelected}
            />
          </div>
        </EmptyState>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Envelope Distribution</CardTitle>
            <CardDescription>
              Envelopes are sorted by balance so you can quickly see what carries the most weight.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {envelopeInsights.map((envelope) => (
              <EnvelopeDistributionRow
                key={envelope.id}
                envelope={envelope}
                accountCurrency={selectedAccountCurrency}
                onDeactivate={(envelopeId) => {
                  setDeactivateId(envelopeId)
                  setDeactivateError(null)
                }}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {hasNegativeEnvelopes ? (
        <Alert className="border-error/35 bg-error/5">
          <AlertTriangle className="h-4 w-4 text-error" />
          <AlertTitle className="text-error">Negative balance attention needed</AlertTitle>
          <AlertDescription>
            {summary.negativeEnvelopesCount} envelope
            {summary.negativeEnvelopesCount === 1 ? "" : "s"} in {selectedAccountLabel}{" "}
            {summary.negativeEnvelopesCount === 1 ? "is" : "are"} below zero. Review transfers or
            recent spending to bring them back to a healthy state.
          </AlertDescription>
        </Alert>
      ) : null}

      <AlertDialog
        open={deactivateId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeactivateId(null)
            setDeactivateError(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Envelope?</AlertDialogTitle>
            <AlertDialogDescription>
              Deactivate {envelopes.find((envelope) => envelope.id === deactivateId)?.category} from{" "}
              {selectedAccountLabel}.
            </AlertDialogDescription>
            {deactivateError ? (
              <AlertDialogDescription className="text-destructive">
                {deactivateError}
              </AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleDeactivate()
              }}
              disabled={isDeactivating}
            >
              {isDeactivating ? "Deactivating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
