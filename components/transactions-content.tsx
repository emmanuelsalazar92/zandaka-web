"use client"

import { Plus, Trash2, AlertCircle, Search, Filter, X, Upload } from "lucide-react"
import Link from "next/link"
import * as React from "react"

import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { TransactionTimeline, TransactionTimelineSkeleton } from "@/components/transaction-timeline"
import {
  AppliedHistoryFilters,
  HistoryPagination,
} from "@/components/transactions/history-controls"
import historyStyles from "@/components/transactions/history.module.css"
import { MovementComposer } from "@/components/transactions/movement-composer"
import { TransactionDetailDialog } from "@/components/transactions/transaction-detail-dialog"
import { useTransactionHistory } from "@/components/transactions/use-transaction-history"
import { TransferComposer } from "@/components/transfers/transfer-composer"
import { AccessibleField, AccessibleFieldError } from "@/components/ui/accessible-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { getAccountingDate, formatIsoDateOnly } from "@/lib/date-only"
import { readPublicError } from "@/lib/public-error"
import {
  normalizeAmountInput,
  sanitizeAmountInput,
  transactionAmount,
} from "@/lib/transaction-amount"
import {
  emptyHistoryFilters,
  dashboardHistoryFilters,
  accountContextHistoryFilters,
  reconciliationHistoryFilters,
  historyFilterError,
  type HistoryFilters,
} from "@/lib/transaction-history"
import {
  groupTransactionsForTimeline,
  getTransactionTypeMeta,
  type TimelineTransaction,
  type TransactionType,
} from "@/lib/transaction-timeline"
import { pendingTransferExists } from "@/lib/transfer"
import { cn } from "@/lib/utils"

interface TransactionLine {
  accountId: string
  envelopeId: string
  amount: string
}

const API_BASE_URL = "/api"
export function TransactionsContent() {
  const [detailId, setDetailId] = React.useState<number | null>(null)
  const detailTrigger = React.useRef<HTMLButtonElement | null>(null)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [hasPendingTransfer, setHasPendingTransfer] = React.useState(false)
  const [accountsReload, setAccountsReload] = React.useState(0)
  React.useEffect(() => {
    setHasPendingTransfer(pendingTransferExists(1))
  }, [])
  const [createLoading, setCreateLoading] = React.useState(false)
  const [movementBusy, setMovementBusy] = React.useState(false)
  const [movementNotice, setMovementNotice] = React.useState<{
    title: string
    description: string
  } | null>(null)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [isFiltersOpen, setIsFiltersOpen] = React.useState(false)
  const [transactionsReloadToken, setTransactionsReloadToken] = React.useState(0)
  const [accounts, setAccounts] = React.useState<
    { id: number; name: string; currency: string; active: boolean; institution: string | null }[]
  >([])
  const [accountsLoading, setAccountsLoading] = React.useState(false)
  const [accountsError, setAccountsError] = React.useState<string | null>(null)
  const [envelopesByAccount, setEnvelopesByAccount] = React.useState<
    Record<string, { id: number; name: string; categoryId: number }[]>
  >({})
  const [envelopesLoading, setEnvelopesLoading] = React.useState<Record<string, boolean>>({})
  const [envelopesError, setEnvelopesError] = React.useState<Record<string, string | null>>({})
  const [formData, setFormData] = React.useState({
    date: getAccountingDate(),
    type: "EXPENSE" as TransactionType,
    description: "",
    lines: [{ accountId: "", envelopeId: "", amount: "" }] as TransactionLine[],
  })

  // Filter state - draft (UI) and applied (actual filter)
  const defaultFilters = emptyHistoryFilters
  const [density, setDensity] = React.useState<"compact" | "comfortable">("compact")
  const [filterError, setFilterError] = React.useState<ReturnType<typeof historyFilterError>>(null)
  const [draftFilters, setDraftFilters] = React.useState(defaultFilters)
  const [filters, setFilters] = React.useState(defaultFilters)
  const [fromReconciliation, setFromReconciliation] = React.useState(false)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const initial =
      reconciliationHistoryFilters(params) ??
      dashboardHistoryFilters(params) ??
      accountContextHistoryFilters(params)
    if (initial) {
      setDraftFilters(initial)
      setFilters(initial)
      setFromReconciliation(params.get("source") === "reconciliation")
    }
  }, [])

  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1)
  const [itemsPerPage, setItemsPerPage] = React.useState(10)
  const userId = 1
  const {
    data: transactionsData,
    meta: transactionsMeta,
    loading: transactionsLoading,
    error: transactionsError,
    announcement,
    previousMeta,
    previousCount,
  } = useTransactionHistory(filters, currentPage, itemsPerPage, userId, transactionsReloadToken)

  const activeAccounts = React.useMemo(
    () => accounts.filter((account) => account.active),
    [accounts],
  )

  const transactions = React.useMemo<TimelineTransaction[]>(() => {
    return transactionsData.map((transaction) => {
      const lines = transaction.lines.map((line) => {
        const accountId = line.account_id ?? line.accountId ?? 0
        const envelopeId = line.envelope_id ?? line.envelopeId ?? 0
        const accountName =
          line.account_name ??
          line.accountName ??
          accounts.find((account) => account.id === accountId)?.name ??
          (accountId ? `Cuenta ${accountId}` : "Cuenta sin identificar")
        const envelopeName =
          line.category_name ??
          line.categoryName ??
          envelopesByAccount[accountId.toString()]?.find((env) => env.id === envelopeId)?.name ??
          (envelopeId ? `Sobre ${envelopeId}` : "Sobre sin identificar")

        return {
          accountId,
          account: accountName,
          accountCurrency:
            line.accountCurrency ??
            line.account_currency ??
            accounts.find((account) => account.id === accountId)?.currency ??
            "",
          envelopeId,
          envelope: envelopeName,
          amount: line.amount,
        }
      })

      return {
        id: transaction.id,
        date: transaction.date,
        type: transaction.type,
        description: transaction.description,
        lines,
      }
    })
  }, [transactionsData, accounts, envelopesByAccount])
  const timelineGroups = React.useMemo(
    () => groupTransactionsForTimeline(transactions),
    [transactions],
  )

  React.useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setAccountsLoading(true)
        setAccountsError(null)
        const res = await fetch(`${API_BASE_URL}/accounts`, {
          headers: { Accept: "application/json" },
        })
        if (!res.ok) throw new Error("No pudimos cargar las cuentas. Vuelve a intentar.")
        const data = (await res.json()) as {
          id: number
          name: string
          currency: string
          is_active: number
          institution?: string | null
          institution_name?: string | null
        }[]
        setAccounts(
          data.map((account) => ({
            id: account.id,
            name: account.name,
            currency: account.currency,
            active: account.is_active === 1,
            institution: account.institution ?? account.institution_name ?? null,
          })),
        )
        // A direct action from Resumen opens the composer only after its account context is ready.
        if (new URLSearchParams(window.location.search).get("new") === "1") {
          setIsCreateOpen(true)
        }
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "No pudimos cargar las cuentas. Vuelve a intentar."
        setAccountsError(message)
      } finally {
        setAccountsLoading(false)
      }
    }

    fetchAccounts()
  }, [accountsReload])

  const fetchEnvelopes = React.useCallback(
    async (accountId: string, retry = false) => {
      if (!accountId || accountId === "ALL") return
      if (
        envelopesByAccount[accountId] ||
        envelopesLoading[accountId] ||
        (envelopesError[accountId] && !retry)
      )
        return

      setEnvelopesLoading((prev) => ({ ...prev, [accountId]: true }))
      setEnvelopesError((prev) => ({ ...prev, [accountId]: null }))
      try {
        const res = await fetch(
          `${API_BASE_URL}/reports/envelope-balances?accountId=${accountId}`,
          { headers: { Accept: "application/json" } },
        )
        if (!res.ok) throw new Error("No pudimos cargar los sobres. Vuelve a intentar.")
        const data = (await res.json()) as {
          envelopeId: number
          categoryId: number
          categoryName: string
        }[]
        setEnvelopesByAccount((prev) => ({
          ...prev,
          [accountId]: data.map((env) => ({
            id: env.envelopeId,
            categoryId: env.categoryId,
            name: env.categoryName,
          })),
        }))
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "No pudimos cargar los sobres. Vuelve a intentar."
        setEnvelopesError((prev) => ({ ...prev, [accountId]: message }))
      } finally {
        setEnvelopesLoading((prev) => ({ ...prev, [accountId]: false }))
      }
    },
    [envelopesByAccount, envelopesLoading, envelopesError],
  )

  React.useEffect(() => {
    setFormData((prev) => {
      const nextLines = prev.lines.map((line) => {
        const isValid = activeAccounts.some((account) => account.id.toString() === line.accountId)
        if (isValid) return line
        return { ...line, accountId: "", envelopeId: "" }
      })
      const hasChanges = nextLines.some(
        (line, index) => line.accountId !== prev.lines[index]?.accountId,
      )
      if (!hasChanges) return prev
      return { ...prev, lines: nextLines }
    })
  }, [activeAccounts])

  React.useEffect(() => {
    if (formData.type !== "ADJUSTMENT") return
    const accountIds = new Set(
      formData.lines.map((line) => line.accountId).filter((accountId) => accountId),
    )
    accountIds.forEach((accountId) => {
      void fetchEnvelopes(accountId)
    })
  }, [formData.lines, formData.type, fetchEnvelopes])

  React.useEffect(() => {
    if (draftFilters.accountId && draftFilters.accountId !== "ALL") {
      void fetchEnvelopes(draftFilters.accountId)
    }
  }, [draftFilters.accountId, fetchEnvelopes])

  React.useEffect(() => {
    if (
      !transactionsLoading &&
      !transactionsError &&
      currentPage > Math.max(transactionsMeta.totalPages, 1)
    )
      setCurrentPage(Math.max(transactionsMeta.totalPages, 1))
  }, [transactionsLoading, transactionsError, currentPage, transactionsMeta.totalPages])

  // Count active filters
  const activeFilterCount = React.useMemo(() => {
    let count = 0
    if (filters.dateFrom) count++
    if (filters.dateTo) count++
    if (filters.keyword) count++
    if (filters.type !== "ALL") count++
    if (filters.accountId !== "ALL") count++
    if (filters.envelopeId !== "ALL") count++
    if (filters.amountMin) count++
    if (filters.amountMax) count++
    return count
  }, [filters])

  const applyFilters = () => {
    const error = historyFilterError(draftFilters)
    setFilterError(error)
    if (error) {
      document
        .getElementById(error.field === "dateFrom" ? "filter-date-from" : "filter-amount-min")
        ?.focus()
      return
    }
    setFilters({ ...draftFilters })
    setCurrentPage(1)
  }

  const clearFilters = () => {
    setFilterError(null)
    setDraftFilters(defaultFilters)
    setFilters(defaultFilters)
    setCurrentPage(1)
  }

  const appliedFilters = Object.entries(filters).flatMap(([key, value]) => {
    if (!value || value === "ALL") return []
    const label =
      key === "dateFrom"
        ? "Desde: " + formatIsoDateOnly(value)
        : key === "dateTo"
          ? "Hasta: " + formatIsoDateOnly(value)
          : key === "type"
            ? "Tipo: " + getTransactionTypeMeta(value).label
            : key === "accountId"
              ? "Cuenta: " +
                (accounts.find((account) => String(account.id) === value)?.name ?? "#" + value)
              : key === "envelopeId"
                ? "Sobre: " +
                  (envelopesByAccount[filters.accountId]?.find(
                    (envelope) => String(envelope.categoryId) === value,
                  )?.name ?? "#" + value)
                : key === "keyword"
                  ? '"' + value + '"'
                  : (key === "amountMin" ? "Mínimo: " : "Máximo: ") + value
    return [{ key, label }]
  })
  const removeFilter = (key: string) => {
    const reset = {
      [key]: emptyHistoryFilters[key as keyof HistoryFilters],
      ...(key === "accountId" ? { envelopeId: "ALL" } : {}),
    }
    setFilters((current) => ({ ...current, ...reset }))
    setDraftFilters((current) => ({ ...current, ...reset }))
    setCurrentPage(1)
    setFilterError(null)
  }

  const handleAddLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { accountId: "", envelopeId: "", amount: "" }],
    })
  }

  const handleRemoveLine = (index: number) => {
    setFormData({
      ...formData,
      lines: formData.lines.filter((_, i) => i !== index),
    })
  }

  const handleLineChange = (index: number, field: keyof TransactionLine, value: string) => {
    const newLines = [...formData.lines]
    if (field === "accountId") {
      newLines[index] = { ...newLines[index], accountId: value, envelopeId: "" }
    } else if (field === "amount") {
      newLines[index] = { ...newLines[index], amount: sanitizeAmountInput(value) }
    } else {
      newLines[index] = { ...newLines[index], [field]: value }
    }
    setFormData({ ...formData, lines: newLines })
  }

  const normalizeLineAmountForType = (index: number) => {
    const newLines = [...formData.lines]
    newLines[index] = {
      ...newLines[index],
      amount: normalizeAmountInput(newLines[index].amount, formData.type),
    }
    setFormData({ ...formData, lines: newLines })
  }

  const lineCurrency = (line: TransactionLine) =>
    accounts.find((account) => account.id === Number(line.accountId))?.currency ?? "CRC"

  const lineErrors = formData.lines.map((line) => {
    if (!line.amount.trim()) return null
    try {
      transactionAmount(line.amount, formData.type, lineCurrency(line))
      return null
    } catch {
      return "Introduce un importe distinto de cero, con punto decimal y la precisión de la moneda."
    }
  })

  const linesValid = formData.lines.every(
    (line, index) => line.accountId && line.envelopeId && line.amount.trim() && !lineErrors[index],
  )

  const isOtherValid = formData.type !== "TRANSFER" && formData.lines.length >= 1 && linesValid
  const isFormValid = isOtherValid && formData.description && formData.date

  const resetCreateForm = React.useCallback(() => {
    setFormData({
      date: getAccountingDate(),
      type: "EXPENSE",
      description: "",
      lines: [{ accountId: "", envelopeId: "", amount: "" }],
    })
  }, [])

  const handleCreate = async () => {
    if (!isFormValid || formData.type === "TRANSFER") return

    setCreateLoading(true)
    setCreateError(null)
    try {
      const payload = {
        userId,
        date: formData.date,
        type: formData.type,
        description: formData.description,
        lines: formData.lines.map((line) => ({
          accountId: Number.parseInt(line.accountId),
          envelopeId: Number.parseInt(line.envelopeId),
          amount: transactionAmount(line.amount, formData.type, lineCurrency(line)),
        })),
      }
      const res = await fetch(`${API_BASE_URL}/transactions`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        throw new Error(
          await readPublicError(
            res,
            "No pudimos guardar el movimiento. Revisa los datos y vuelve a intentar.",
          ),
        )
      }
      await res.json()
      setTransactionsReloadToken((current) => current + 1)
      setMovementNotice({
        title: "Ajuste registrado",
        description: "La lista conserva tus filtros actuales.",
      })
      resetCreateForm()
      setIsCreateOpen(false)
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "No pudimos guardar el movimiento. Revisa los datos y vuelve a intentar."
      setCreateError(message)
    } finally {
      setCreateLoading(false)
    }
  }

  const handleCloseCreate = () => {
    resetCreateForm()
    setCreateError(null)
    setIsCreateOpen(false)
  }

  const retryTransactions = React.useCallback(() => {
    setTransactionsReloadToken((current) => current + 1)
  }, [])

  return (
    <div className="marea-surface min-w-0 space-y-6 rounded-2xl bg-background p-3 sm:p-5 [overflow-wrap:anywhere]">
      <PageHeader
        title={<>Movimientos</>}
        description={<>Cada ingreso, gasto y traslado, en un solo lugar.</>}
        actionsLabel="Acciones de movimientos"
        data-testid="transactions-header"
      >
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 lg:justify-end">
          <Button
            variant="outline"
            aria-label="Filtros"
            aria-expanded={isFiltersOpen}
            aria-controls="history-filters"
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className="relative h-auto min-h-11 max-w-full whitespace-normal py-2"
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtros
            {activeFilterCount > 0 && (
              <Badge className="ml-2 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          <Button
            variant="outline"
            asChild
            className="h-auto min-h-11 max-w-full whitespace-normal py-2"
          >
            <Link href="/transactions/import">
              <Upload className="mr-2 h-4 w-4" />
              Importar
            </Link>
          </Button>
          <Dialog
            open={isCreateOpen}
            onOpenChange={(open) => {
              if (!open && movementBusy) return
              if (!open) {
                handleCloseCreate()
                return
              }
              if (pendingTransferExists(userId)) setFormData((d) => ({ ...d, type: "TRANSFER" }))
              setCreateError(null)
              setIsCreateOpen(open)
            }}
          >
            <DialogTrigger asChild>
              <Button className="h-auto min-h-11 max-w-full whitespace-normal py-2">
                <Plus className="mr-2 h-4 w-4" />
                Nuevo movimiento
              </Button>
            </DialogTrigger>
            <DialogContent
              showCloseButton={!movementBusy}
              onEscapeKeyDown={(event) => {
                if (movementBusy) event.preventDefault()
              }}
              onInteractOutside={(event) => {
                if (movementBusy) event.preventDefault()
              }}
              className={cn(
                "max-h-[90dvh]",
                (formData.type === "INCOME" || formData.type === "EXPENSE") && "marea-surface",
                formData.type !== "ADJUSTMENT"
                  ? "grid-cols-1 p-3 sm:max-w-3xl sm:p-6"
                  : "sm:max-w-5xl xl:max-w-6xl",
              )}
            >
              {formData.type === "TRANSFER" ? (
                <TransferComposer
                  userId={userId}
                  accounts={activeAccounts}
                  accountsLoading={accountsLoading}
                  accountsError={accountsError}
                  initialDate={formData.date}
                  initialDescription={formData.description}
                  onTypeChange={(type) => setFormData((d) => ({ ...d, type }))}
                  onClose={handleCloseCreate}
                  onPendingChange={setHasPendingTransfer}
                  onRefreshAccounts={() => setAccountsReload((n) => n + 1)}
                  onConfirmed={() => {
                    setHasPendingTransfer(false)
                    resetCreateForm()
                    setIsCreateOpen(false)
                    setTransactionsReloadToken((n) => n + 1)
                  }}
                />
              ) : formData.type === "INCOME" || formData.type === "EXPENSE" ? (
                <MovementComposer
                  type={formData.type}
                  accounts={activeAccounts}
                  accountsLoading={accountsLoading}
                  accountsError={accountsError}
                  history={transactions}
                  initialDate={formData.date}
                  initialDescription={formData.description}
                  userId={userId}
                  onTypeChange={(type, metadata) =>
                    setFormData((d) => ({ ...d, ...metadata, type }))
                  }
                  onClose={handleCloseCreate}
                  onBusyChange={setMovementBusy}
                  onRefreshAccounts={() => setAccountsReload((n) => n + 1)}
                  onCreated={() => {
                    setMovementNotice({
                      title: formData.type === "INCOME" ? "Ingreso registrado" : "Gasto registrado",
                      description:
                        "El movimiento se confirmó. La lista conserva tus filtros actuales.",
                    })
                    setMovementBusy(false)
                    resetCreateForm()
                    setIsCreateOpen(false)
                    setTransactionsReloadToken((n) => n + 1)
                  }}
                  onReviewHistory={(metadata) => {
                    const review = {
                      ...defaultFilters,
                      dateFrom: metadata.date,
                      dateTo: metadata.date,
                      type: metadata.type,
                      keyword: metadata.description,
                    }
                    setFilters(review)
                    setDraftFilters(review)
                    setCurrentPage(1)
                    setMovementNotice({
                      title: "Revisa el movimiento por confirmar",
                      description:
                        "Filtramos por fecha, tipo y descripción. Compara los detalles antes de registrar otra operación; no hemos confirmado que se guardó.",
                    })
                    resetCreateForm()
                    setIsCreateOpen(false)
                    setTransactionsReloadToken((n) => n + 1)
                  }}
                />
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Nuevo movimiento</DialogTitle>
                    <DialogDescription>
                      Registra un ingreso, gasto, transferencia o ajuste. Usa punto decimal y no
                      incluyas separadores de miles; por ejemplo, 1234.56.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="max-h-[70vh] space-y-4 overflow-y-auto py-4 pr-2">
                    {createError && (
                      <Alert className="border-error/50 bg-error/5">
                        <AlertCircle className="h-4 w-4 text-error" />
                        <AlertDescription className="text-sm">{createError}</AlertDescription>
                      </Alert>
                    )}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(180px,0.9fr)_minmax(160px,0.7fr)_minmax(0,1.4fr)]">
                      <AccessibleField className="space-y-2">
                        <Label htmlFor="date">Fecha</Label>
                        <Input
                          id="date"
                          type="date"
                          value={formData.date}
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        />
                      </AccessibleField>
                      <AccessibleField className="space-y-2">
                        <Label htmlFor="type">Tipo</Label>
                        <Select
                          value={formData.type}
                          onValueChange={(value) =>
                            setFormData({ ...formData, type: value as TransactionType })
                          }
                        >
                          <SelectTrigger id="type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="INCOME">Ingreso</SelectItem>
                            <SelectItem value="EXPENSE">Gasto</SelectItem>
                            <SelectItem value="TRANSFER">Transferencia</SelectItem>
                            <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                          </SelectContent>
                        </Select>
                      </AccessibleField>
                      <AccessibleField className="space-y-2">
                        <Label htmlFor="description">Descripción</Label>
                        <Input
                          id="description"
                          placeholder="Por ejemplo, Compra de alimentos"
                          value={formData.description}
                          onChange={(e) =>
                            setFormData({ ...formData, description: e.target.value })
                          }
                        />
                      </AccessibleField>
                    </div>

                    {/* Lines Editor */}
                    <div className="space-y-3 border-t pt-4">
                      <div className="flex items-center justify-between">
                        <Label className="font-semibold">Detalle por cuenta y sobre</Label>
                        <Button variant="outline" size="sm" onClick={handleAddLine}>
                          <Plus className="h-4 w-4 mr-1" />
                          Añadir detalle
                        </Button>
                      </div>

                      {formData.lines.map((line, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1.1fr)_minmax(220px,0.8fr)_auto] md:items-end"
                        >
                          <AccessibleField className="min-w-0 space-y-1">
                            <Label className="text-xs">Cuenta</Label>
                            <Select
                              value={line.accountId}
                              onValueChange={(value) => handleLineChange(index, "accountId", value)}
                              disabled={accountsLoading || activeAccounts.length === 0}
                            >
                              <SelectTrigger
                                className="h-9 w-full"
                                aria-label={`Cuenta ${index + 1}`}
                              >
                                <SelectValue
                                  placeholder={
                                    accountsLoading
                                      ? "Cargando cuentas…"
                                      : activeAccounts.length === 0
                                        ? "No hay cuentas activas"
                                        : "Elige una cuenta"
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {activeAccounts.map((acc) => (
                                  <SelectItem key={acc.id} value={acc.id.toString()}>
                                    {acc.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {accountsError && (
                              <AccessibleFieldError className="text-xs text-error mt-1">
                                {accountsError}
                              </AccessibleFieldError>
                            )}
                          </AccessibleField>
                          <AccessibleField className="min-w-0 space-y-1">
                            <Label className="text-xs">Sobre</Label>
                            <Select
                              value={line.envelopeId}
                              onValueChange={(value) =>
                                handleLineChange(index, "envelopeId", value)
                              }
                              disabled={!line.accountId || envelopesLoading[line.accountId]}
                            >
                              <SelectTrigger
                                className="h-9 w-full"
                                aria-label={`Sobre ${index + 1}`}
                              >
                                <SelectValue
                                  placeholder={
                                    !line.accountId
                                      ? "Elige primero una cuenta"
                                      : envelopesLoading[line.accountId]
                                        ? "Cargando sobres…"
                                        : "Elige un sobre"
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {(envelopesByAccount[line.accountId] || []).map((env) => (
                                  <SelectItem key={env.id} value={env.id.toString()}>
                                    {env.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {line.accountId && envelopesError[line.accountId] && (
                              <>
                                <AccessibleFieldError className="text-xs text-error mt-1">
                                  {envelopesError[line.accountId]}
                                </AccessibleFieldError>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => void fetchEnvelopes(line.accountId, true)}
                                >
                                  Volver a cargar sobres del detalle {index + 1}
                                </Button>
                              </>
                            )}
                          </AccessibleField>
                          <AccessibleField className="space-y-1">
                            <Label className="text-xs" htmlFor={`transaction-amount-${index}`}>
                              Importe (
                              {accounts.find((account) => account.id.toString() === line.accountId)
                                ?.currency ?? "elige una cuenta"}
                              )
                            </Label>
                            <Input
                              id={`transaction-amount-${index}`}
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={line.amount}
                              onChange={(e) => handleLineChange(index, "amount", e.target.value)}
                              onBlur={() => normalizeLineAmountForType(index)}
                              aria-invalid={Boolean(lineErrors[index])}
                              aria-describedby={
                                lineErrors[index] ? `transaction-amount-error-${index}` : undefined
                              }
                              className="h-9 text-right font-medium tabular-nums"
                            />
                            {lineErrors[index] && (
                              <AccessibleFieldError
                                id={`transaction-amount-error-${index}`}
                                className="text-xs text-error"
                              >
                                {lineErrors[index]}
                              </AccessibleFieldError>
                            )}
                          </AccessibleField>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveLine(index)}
                            aria-label={`Quitar línea ${index + 1}`}
                            disabled={formData.lines.length === 1}
                            className="h-9 w-9 p-0 md:self-end"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={handleCloseCreate}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreate} disabled={!isFormValid || createLoading}>
                      {createLoading ? "Creando…" : "Nuevo movimiento"}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      {movementNotice && (
        <Feedback title={movementNotice.title}>
          <p>{movementNotice.description}</p>
          <Button type="button" variant="ghost" onClick={() => setMovementNotice(null)}>
            Cerrar aviso
          </Button>
        </Feedback>
      )}

      {hasPendingTransfer && (
        <Alert>
          <AlertCircle aria-hidden="true" className="size-4" />
          <AlertDescription className="space-y-2">
            <p>Hay una transferencia por confirmar. Revisa el intento antes de iniciar otra.</p>
            <Button
              variant="outline"
              onClick={() => {
                setFormData((d) => ({ ...d, type: "TRANSFER" }))
                setIsCreateOpen(true)
              }}
            >
              Revisar transferencia
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {/* Filters Panel */}
      <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
        <CollapsibleContent id="history-filters">
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Filtros</CardTitle>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
                    <X className="mr-1 h-3 w-3" />
                    Quitar todos
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className={cn("@container", historyStyles.filters)}>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  applyFilters()
                }}
              >
                <p className="text-sm text-muted-foreground">
                  {Object.keys(defaultFilters).some(
                    (key) =>
                      draftFilters[key as keyof HistoryFilters] !==
                      filters[key as keyof HistoryFilters],
                  )
                    ? "Cambios sin aplicar. El historial conserva los filtros anteriores hasta pulsar Buscar."
                    : "Elige los filtros y pulsa Buscar para aplicarlos."}
                </p>
                {/* Row 1: Date Range and Keyword */}
                <div className="grid grid-cols-1 @min-[44rem]:grid-cols-2 gap-4">
                  <AccessibleField className="space-y-1.5">
                    <Label htmlFor="filter-date-from" className="text-xs text-muted-foreground">
                      Desde
                    </Label>
                    <Input
                      type="date"
                      value={draftFilters.dateFrom}
                      id="filter-date-from"
                      aria-invalid={filterError?.field === "dateFrom" || undefined}
                      aria-describedby={
                        filterError?.field === "dateFrom" ? "history-filter-error" : undefined
                      }
                      onChange={(e) =>
                        setDraftFilters({ ...draftFilters, dateFrom: e.target.value })
                      }
                      className="h-9"
                    />
                  </AccessibleField>
                  <AccessibleField className="space-y-1.5">
                    <Label htmlFor="filter-date-to" className="text-xs text-muted-foreground">
                      Hasta
                    </Label>
                    <Input
                      type="date"
                      value={draftFilters.dateTo}
                      id="filter-date-to"
                      onChange={(e) => setDraftFilters({ ...draftFilters, dateTo: e.target.value })}
                      className="h-9"
                    />
                  </AccessibleField>
                  <AccessibleField className="space-y-1.5 @min-[44rem]:col-span-2">
                    <Label htmlFor="filter-keyword" className="text-xs text-muted-foreground">
                      Descripción
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por descripción…"
                        value={draftFilters.keyword}
                        id="filter-keyword"
                        onChange={(e) =>
                          setDraftFilters({ ...draftFilters, keyword: e.target.value })
                        }
                        className="h-9 pl-8"
                      />
                    </div>
                  </AccessibleField>
                </div>

                {/* Row 2: Type, Account, Envelope */}
                <div className="grid grid-cols-1 @min-[44rem]:grid-cols-2 gap-4">
                  <AccessibleField className="space-y-1.5">
                    <Label htmlFor="filter-type" className="text-xs text-muted-foreground">
                      Tipo
                    </Label>
                    <Select
                      value={draftFilters.type}
                      onValueChange={(value) => setDraftFilters({ ...draftFilters, type: value })}
                    >
                      <SelectTrigger id="filter-type" aria-label="Tipo" className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todos los tipos</SelectItem>
                        <SelectItem value="INCOME">Ingreso</SelectItem>
                        <SelectItem value="EXPENSE">Gasto</SelectItem>
                        <SelectItem value="TRANSFER">Transferencia</SelectItem>
                        <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                      </SelectContent>
                    </Select>
                  </AccessibleField>
                  <AccessibleField className="space-y-1.5">
                    <Label htmlFor="filter-account" className="text-xs text-muted-foreground">
                      Cuenta
                    </Label>
                    <Select
                      value={draftFilters.accountId}
                      onValueChange={(value) =>
                        setDraftFilters({ ...draftFilters, accountId: value, envelopeId: "ALL" })
                      }
                      disabled={accountsLoading || activeAccounts.length === 0}
                    >
                      <SelectTrigger id="filter-account" aria-label="Cuenta" className="h-9">
                        <SelectValue
                          placeholder={
                            accountsLoading
                              ? "Cargando cuentas…"
                              : activeAccounts.length === 0
                                ? "No hay cuentas activas"
                                : "Elige una cuenta"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todas las cuentas</SelectItem>
                        {activeAccounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id.toString()}>
                            {acc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {accountsError && (
                      <>
                        <AccessibleFieldError className="text-xs text-error mt-1">
                          {accountsError}
                        </AccessibleFieldError>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={accountsLoading}
                          onClick={() => setAccountsReload((value) => value + 1)}
                        >
                          Volver a cargar cuentas
                        </Button>
                      </>
                    )}
                  </AccessibleField>
                  <AccessibleField className="space-y-1.5">
                    <Label htmlFor="filter-envelope" className="text-xs text-muted-foreground">
                      Sobre
                    </Label>
                    <Select
                      value={draftFilters.envelopeId}
                      onValueChange={(value) =>
                        setDraftFilters({ ...draftFilters, envelopeId: value })
                      }
                      disabled={
                        draftFilters.accountId === "ALL" ||
                        draftFilters.accountId === "" ||
                        envelopesLoading[draftFilters.accountId]
                      }
                    >
                      <SelectTrigger id="filter-envelope" aria-label="Sobre" className="h-9">
                        <SelectValue
                          placeholder={
                            draftFilters.accountId === "ALL" || draftFilters.accountId === ""
                              ? "Elige primero una cuenta"
                              : envelopesLoading[draftFilters.accountId]
                                ? "Cargando sobres…"
                                : "Elige un sobre"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todos los sobres</SelectItem>
                        {(envelopesByAccount[draftFilters.accountId] || []).map((env) => (
                          <SelectItem key={env.categoryId} value={env.categoryId.toString()}>
                            {env.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {draftFilters.accountId !== "ALL" && envelopesError[draftFilters.accountId] && (
                      <>
                        <AccessibleFieldError className="text-xs text-error mt-1">
                          {envelopesError[draftFilters.accountId]}
                        </AccessibleFieldError>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={envelopesLoading[draftFilters.accountId]}
                          onClick={() => void fetchEnvelopes(draftFilters.accountId, true)}
                        >
                          Volver a cargar sobres
                        </Button>
                      </>
                    )}
                  </AccessibleField>
                </div>

                {/* Row 3: Amount Range */}
                <div className="grid grid-cols-1 @min-[44rem]:grid-cols-2 gap-4">
                  <AccessibleField className="space-y-1.5">
                    <Label htmlFor="filter-amount-min" className="text-xs text-muted-foreground">
                      Importe mínimo
                    </Label>
                    <Input
                      type="number"
                      placeholder="0"
                      step="any"
                      value={draftFilters.amountMin}
                      id="filter-amount-min"
                      aria-invalid={filterError?.field === "amountMin" || undefined}
                      aria-describedby={
                        filterError?.field === "amountMin" ? "history-filter-error" : undefined
                      }
                      onChange={(e) =>
                        setDraftFilters({ ...draftFilters, amountMin: e.target.value })
                      }
                      className="h-9"
                    />
                  </AccessibleField>
                  <AccessibleField className="space-y-1.5">
                    <Label htmlFor="filter-amount-max" className="text-xs text-muted-foreground">
                      Importe máximo
                    </Label>
                    <Input
                      type="number"
                      placeholder="999999"
                      step="any"
                      value={draftFilters.amountMax}
                      id="filter-amount-max"
                      onChange={(e) =>
                        setDraftFilters({ ...draftFilters, amountMax: e.target.value })
                      }
                      className="h-9"
                    />
                  </AccessibleField>
                  <div className="flex items-end @min-[44rem]:col-span-2">
                    <Button type="submit">
                      <Search className="mr-2 h-4 w-4" />
                      Buscar
                    </Button>
                  </div>
                </div>
                {filterError && (
                  <Feedback id="history-filter-error" tone="error" title="Revisa los filtros">
                    {filterError.message}
                  </Feedback>
                )}
                <p className="text-xs text-muted-foreground">
                  Los importes filtran el total neto con signo: los gastos son negativos y los
                  traslados suelen sumar cero. No se convierten monedas.
                </p>
              </form>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <section aria-label="Contexto del historial" className="atlantic-hero min-w-0 p-5 sm:p-6">
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="hero-caption text-sm">
              {activeFilterCount ? "Vista filtrada" : "Tu actividad"}
            </p>
            <p className="mt-2 text-4xl font-semibold tabular-nums [overflow-wrap:anywhere]">
              {transactionsLoading
                ? "Buscando…"
                : transactionsError
                  ? "Sin confirmar"
                  : transactionsMeta.totalItems.toLocaleString("es-CR")}
            </p>
            <p className="hero-caption mt-1 text-sm">Movimientos encontrados</p>
          </div>
          <p className="hero-caption max-w-sm text-sm leading-relaxed">
            Cada importe conserva su moneda. Consulta la ficha para ver todas las líneas del
            movimiento.
          </p>
        </div>
      </section>
      <AppliedHistoryFilters
        filters={appliedFilters}
        onRemove={removeFilter}
        onClear={clearFilters}
      />
      {fromReconciliation && (
        <Feedback role="note" title="Movimientos hasta el corte">
          Aplicamos la cuenta y la fecha de corte solicitadas desde Conciliación. Puedes ampliar el
          período con los filtros; esta consulta no crea ajustes.
        </Feedback>
      )}
      <section aria-labelledby="history-title" className="min-w-0 space-y-4">
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 id="history-title" className="text-xl font-semibold">
              Historial
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Más recientes primero · agrupados por fecha contable.
            </p>
          </div>
          <div
            role="group"
            aria-label="Densidad del historial"
            className="flex min-w-0 flex-wrap gap-1 rounded-lg border p-1"
          >
            <Button
              variant={density === "compact" ? "secondary" : "ghost"}
              aria-pressed={density === "compact"}
              onClick={() => setDensity("compact")}
            >
              Compacta
            </Button>
            <Button
              variant={density === "comfortable" ? "secondary" : "ghost"}
              aria-pressed={density === "comfortable"}
              onClick={() => setDensity("comfortable")}
            >
              Cómoda
            </Button>
          </div>
        </div>
        <p
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-testid="history-status"
          className="text-sm text-muted-foreground"
        >
          {announcement}
        </p>
        <div aria-busy={transactionsLoading} aria-label="Resultados del historial">
          {transactionsLoading ? (
            <TransactionTimelineSkeleton />
          ) : transactionsError ? (
            <EmptyState
              icon={AlertCircle}
              title="No pudimos cargar los movimientos"
              description={transactionsError}
              actionLabel="Volver a intentar"
              onAction={retryTransactions}
            />
          ) : transactions.length === 0 ? (
            <EmptyState
              icon={Search}
              title={
                activeFilterCount
                  ? "Ningún movimiento coincide con los filtros"
                  : "Todavía no hay movimientos"
              }
              description={
                activeFilterCount
                  ? "Amplía el período, quita filtros o busca otra descripción."
                  : "Registra un ingreso, gasto o transferencia para comenzar."
              }
              actionLabel={activeFilterCount ? "Quitar filtros" : "Registrar primer movimiento"}
              onAction={activeFilterCount ? clearFilters : () => setIsCreateOpen(true)}
            />
          ) : (
            <TransactionTimeline
              groups={timelineGroups}
              density={density}
              onOpen={(id, trigger) => {
                detailTrigger.current = trigger
                setDetailId(id)
              }}
            />
          )}
        </div>
        {detailId !== null && (
          <TransactionDetailDialog
            key={detailId}
            transactionId={detailId}
            userId={userId}
            returnFocus={detailTrigger}
            onClose={() => setDetailId(null)}
          />
        )}
        {!transactionsError &&
          (transactionsLoading ? previousMeta.totalItems : transactionsMeta.totalItems) > 0 && (
            <HistoryPagination
              meta={transactionsLoading ? previousMeta : transactionsMeta}
              count={transactionsLoading ? previousCount : transactions.length}
              pageSize={itemsPerPage}
              busy={transactionsLoading}
              onPage={setCurrentPage}
              onPageSize={(size) => {
                setCurrentPage(1)
                setItemsPerPage(size)
              }}
            />
          )}
      </section>
    </div>
  )
}
