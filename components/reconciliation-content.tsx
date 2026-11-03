"use client"

import { AlertCircle, Eye, Plus, RefreshCw, Scale } from "lucide-react"
import Link from "next/link"
import * as React from "react"

import { EmptyState } from "@/components/empty-state"
import { ReconciliationDenominationTable } from "@/components/reconciliation-denomination-table"
import { AccessibleField, AccessibleFieldError } from "@/components/ui/accessible-field"
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
import {
  buildDenominationPayloadLines,
  calculateDenominationCountedTotal,
  createEmptyQuantityMap,
  type DenominationQuantityMap,
} from "@/lib/cash-denomination-helpers"
import { formatCurrency, formatSignedCurrency } from "@/lib/currency-formatter"
import { formatIsoDateOnly, getAccountingDate } from "@/lib/date-only"
import { subtractMoney, tryDecimalInput } from "@/lib/money"
import {
  createReconciliation,
  fetchCashDenominationsForAccount,
  fetchExpectedTotalForAccount,
  fetchReconciliation,
  fetchReconciliationAccounts,
  fetchReconciliations,
  ignoreReconciliation,
  type AccountCashDenominations,
  type ReconciliationAccount,
  type ReconciliationCountMethod,
  type ReconciliationExpectedTotal,
  type ReconciliationRecord,
  type ReconciliationStatus,
} from "@/lib/reconciliation-api"
import { cn } from "@/lib/utils"

interface NewReconciliationForm {
  accountId: string
  date: string
  countMethod: ReconciliationCountMethod
  manualCountedTotal: string
  note: string
  quantities: DenominationQuantityMap
}

function formatDate(date: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return formatIsoDateOnly(date)
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date

  return new Intl.DateTimeFormat("es-CR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(parsed)
}

function getDefaultReconciliationDate() {
  return getAccountingDate()
}

function parseManualCountedTotal(value: string) {
  const normalized = value.trim().replace(/\s+/g, "").replace(/,/g, ".")
  if (!normalized) return null

  const parsed = tryDecimalInput(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function isBalanced(difference: number) {
  return difference === 0
}

function getCountMethodLabel(countMethod: ReconciliationCountMethod) {
  return countMethod === "DENOMINATION_COUNT" ? "Denominaciones" : "Total manual"
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
      {status === "OPEN" ? "Abierta" : status === "BALANCED" ? "Sin diferencia" : "Ignorada"}
    </Badge>
  )
}

export function ReconciliationContent() {
  const [accounts, setAccounts] = React.useState<ReconciliationAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = React.useState("")
  const [reconciliations, setReconciliations] = React.useState<ReconciliationRecord[]>([])
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
    countMethod: "MANUAL_TOTAL",
    manualCountedTotal: "",
    note: "",
    quantities: {},
  })
  const [cashCatalog, setCashCatalog] = React.useState<AccountCashDenominations | null>(null)
  const [cashCatalogLoading, setCashCatalogLoading] = React.useState(false)
  const [cashCatalogError, setCashCatalogError] = React.useState<string | null>(null)
  const [expectedPreview, setExpectedPreview] = React.useState<ReconciliationExpectedTotal | null>(
    null,
  )
  const [expectedPreviewLoading, setExpectedPreviewLoading] = React.useState(false)
  const [expectedPreviewError, setExpectedPreviewError] = React.useState<string | null>(null)
  const [detailId, setDetailId] = React.useState<number | null>(null)
  const [detailRecord, setDetailRecord] = React.useState<ReconciliationRecord | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [detailError, setDetailError] = React.useState<string | null>(null)
  const selectedAccountIdRef = React.useRef("")

  React.useEffect(() => {
    selectedAccountIdRef.current = selectedAccountId
  }, [selectedAccountId])

  const selectableAccounts = React.useMemo(() => {
    const preferred = accounts.filter((account) => account.active)
    const list = preferred.length > 0 ? preferred : accounts
    return [...list].sort((left, right) => left.name.localeCompare(right.name))
  }, [accounts])

  const selectedAccount = React.useMemo(
    () => selectableAccounts.find((account) => account.id.toString() === selectedAccountId) ?? null,
    [selectableAccounts, selectedAccountId],
  )

  const createAccount = React.useMemo(
    () =>
      selectableAccounts.find((account) => account.id.toString() === createForm.accountId) ?? null,
    [createForm.accountId, selectableAccounts],
  )

  const createAccountIsCash = createAccount?.type === "CASH"
  const manualCountedTotal = React.useMemo(
    () => parseManualCountedTotal(createForm.manualCountedTotal),
    [createForm.manualCountedTotal],
  )

  const denominationPayloadLines = React.useMemo(
    () =>
      createForm.countMethod === "DENOMINATION_COUNT" && cashCatalog
        ? buildDenominationPayloadLines(cashCatalog.denominations, createForm.quantities)
        : [],
    [cashCatalog, createForm.countMethod, createForm.quantities],
  )

  const countedTotalPreview = React.useMemo(() => {
    if (createForm.countMethod === "DENOMINATION_COUNT" && cashCatalog) {
      return calculateDenominationCountedTotal(cashCatalog.denominations, createForm.quantities)
    }
    return manualCountedTotal ?? 0
  }, [cashCatalog, createForm.countMethod, createForm.quantities, manualCountedTotal])

  const differencePreview = React.useMemo(() => {
    if (!expectedPreview) return null
    return subtractMoney(countedTotalPreview, expectedPreview.expectedTotal)
  }, [countedTotalPreview, expectedPreview])

  const createFormErrors = React.useMemo(() => {
    if (createForm.countMethod === "DENOMINATION_COUNT") {
      return {
        accountId: createForm.accountId ? "" : "Elige una cuenta.",
        date: createForm.date ? "" : "Elige una fecha de conciliación.",
        countedTotal:
          cashCatalog?.denominations.length === 0
            ? "Configura al menos una denominación para esta moneda."
            : denominationPayloadLines.length === 0
              ? "Introduce al menos una cantidad mayor que cero."
              : "",
      }
    }

    return {
      accountId: createForm.accountId ? "" : "Elige una cuenta.",
      date: createForm.date ? "" : "Elige una fecha de conciliación.",
      countedTotal:
        createForm.manualCountedTotal.trim().length === 0
          ? "Introduce el total contado."
          : manualCountedTotal === null
            ? "Introduce un importe numérico válido."
            : "",
    }
  }, [
    cashCatalog?.denominations.length,
    createForm.accountId,
    createForm.countMethod,
    createForm.date,
    createForm.manualCountedTotal,
    denominationPayloadLines.length,
    manualCountedTotal,
  ])

  const isCreateFormValid = React.useMemo(
    () =>
      Object.values(createFormErrors).every((value) => value.length === 0) &&
      !cashCatalogLoading &&
      !expectedPreviewLoading,
    [cashCatalogLoading, createFormErrors, expectedPreviewLoading],
  )

  const resetCreateForm = React.useCallback(
    (accountId?: string) => {
      const nextAccountId =
        accountId || selectedAccountIdRef.current || selectableAccounts[0]?.id.toString() || ""
      const account =
        selectableAccounts.find((item) => item.id.toString() === nextAccountId) ?? null
      const countMethod: ReconciliationCountMethod =
        account?.type === "CASH" ? "DENOMINATION_COUNT" : "MANUAL_TOTAL"

      setCreateForm({
        accountId: nextAccountId,
        date: getDefaultReconciliationDate(),
        countMethod,
        manualCountedTotal: "",
        note: "",
        quantities: {},
      })
      setCreateError(null)
      setCashCatalog(null)
      setCashCatalogError(null)
      setExpectedPreview(null)
      setExpectedPreviewError(null)
    },
    [selectableAccounts],
  )

  const loadAccounts = React.useCallback(async () => {
    try {
      setAccountsLoading(true)
      setAccountsError(null)

      const accountsData = await fetchReconciliationAccounts()
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
      const message =
        error instanceof Error ? error.message : "No pudimos cargar las cuentas. Vuelve a intentar."
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
        error instanceof Error
          ? error.message
          : "No pudimos cargar el historial de conciliación. Vuelve a intentar."
      setReconciliations([])
      setHistoryError(message)
    } finally {
      setHistoryLoading(false)
      setHasLoadedHistory(true)
    }
  }, [])

  const loadCashCatalog = React.useCallback(async (accountId: string) => {
    if (!accountId) {
      setCashCatalog(null)
      setCashCatalogError(null)
      return
    }

    try {
      setCashCatalogLoading(true)
      setCashCatalogError(null)
      const payload = await fetchCashDenominationsForAccount(Number(accountId))
      setCashCatalog(payload)
      setCreateForm((current) => {
        const nextQuantities = {
          ...createEmptyQuantityMap(payload.denominations),
          ...current.quantities,
        }
        payload.denominations.forEach((denomination) => {
          if (!(denomination.id in nextQuantities)) {
            nextQuantities[denomination.id] = ""
          }
        })
        return {
          ...current,
          quantities: nextQuantities,
        }
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No pudimos cargar las denominaciones. Vuelve a intentar."
      setCashCatalog(null)
      setCashCatalogError(message)
    } finally {
      setCashCatalogLoading(false)
    }
  }, [])

  const loadExpectedPreview = React.useCallback(async (accountId: string, date: string) => {
    if (!accountId || !date) {
      setExpectedPreview(null)
      setExpectedPreviewError(null)
      return
    }

    try {
      setExpectedPreviewLoading(true)
      setExpectedPreviewError(null)
      const payload = await fetchExpectedTotalForAccount(Number(accountId), date)
      setExpectedPreview(payload)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No pudimos consultar el saldo esperado. Vuelve a intentar."
      setExpectedPreview(null)
      setExpectedPreviewError(message)
    } finally {
      setExpectedPreviewLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadAccounts()
  }, [loadAccounts])

  React.useEffect(() => {
    void loadReconciliationHistory(selectedAccountId)
  }, [loadReconciliationHistory, selectedAccountId])

  React.useEffect(() => {
    if (!isCreateOpen) return
    if (createAccount?.type === "CASH") {
      void loadCashCatalog(createForm.accountId)
    } else {
      setCashCatalog(null)
      setCashCatalogError(null)
    }
  }, [createAccount?.type, createForm.accountId, isCreateOpen, loadCashCatalog])

  React.useEffect(() => {
    if (!isCreateOpen) return
    void loadExpectedPreview(createForm.accountId, createForm.date)
  }, [createForm.accountId, createForm.date, isCreateOpen, loadExpectedPreview])

  const handleOpenCreate = () => {
    resetCreateForm(selectedAccountId || selectableAccounts[0]?.id.toString())
    setIsCreateOpen(true)
  }

  const handleCreate = async () => {
    if (!isCreateFormValid) {
      setCreateError("Revisa los campos obligatorios antes de continuar.")
      return
    }

    try {
      setCreateLoading(true)
      setCreateError(null)

      const accountId = createForm.accountId
      await createReconciliation({
        accountId: Number(accountId),
        date: createForm.date,
        countMethod: createForm.countMethod,
        countedTotal:
          createForm.countMethod === "MANUAL_TOTAL" ? (manualCountedTotal ?? undefined) : undefined,
        note: createForm.note.trim() || undefined,
        lines:
          createForm.countMethod === "DENOMINATION_COUNT" ? denominationPayloadLines : undefined,
      })

      setIsCreateOpen(false)
      resetCreateForm(accountId)

      if (accountId === selectedAccountIdRef.current) {
        await loadReconciliationHistory(accountId)
      } else {
        setSelectedAccountId(accountId)
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No pudimos crear la conciliación. Revisa los datos y vuelve a intentar."
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

      await ignoreReconciliation(ignoreId)
      setIgnoreId(null)
      await loadReconciliationHistory(selectedAccount.id.toString())
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No pudimos ignorar la conciliación. Vuelve a intentar."
      setIgnoreError(message)
    } finally {
      setIgnoreLoading(false)
    }
  }

  const handleViewDetail = async (reconciliationId: number) => {
    try {
      setDetailId(reconciliationId)
      setDetailLoading(true)
      setDetailError(null)
      const detail = await fetchReconciliation(reconciliationId)
      setDetailRecord(detail)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No pudimos consultar el detalle. Vuelve a intentar."
      setDetailRecord(null)
      setDetailError(message)
    } finally {
      setDetailLoading(false)
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
        title="No pudimos cargar la conciliación"
        description={accountsError}
        actionLabel="Volver a intentar"
        onAction={() => void handleRefresh()}
      />
    )
  }

  if (selectableAccounts.length === 0) {
    return (
      <EmptyState
        icon={Scale}
        title="No hay cuentas disponibles"
        description="Crea o activa una cuenta para consultar sus conciliaciones."
        actionLabel="Actualizar"
        onAction={() => void handleRefresh()}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Historial de conciliación</h2>
          <p className="text-muted-foreground">
            Compara el saldo contado con el esperado. Para cuentas de efectivo, puedes contar por
            denominaciones.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="min-w-[240px] space-y-2">
            <p className="text-sm font-medium">Cuenta</p>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger aria-label="Cuenta a conciliar">
                <SelectValue placeholder="Elige una cuenta" />
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
            Nueva conciliación
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleRefresh()}
            disabled={accountsLoading || historyLoading}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", historyLoading && "animate-spin")} />
            Actualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>{selectedAccount?.name ?? "Cuenta seleccionada"}</CardTitle>
            <CardDescription>
              {selectedAccount?.type === "CASH"
                ? "Puedes contar esta cuenta de efectivo por denominaciones o introducir un total manual."
                : "Introduce el total contado para esta cuenta."}
            </CardDescription>
          </div>

          {latestReconciliation && (
            <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Última conciliación
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
              title="No pudimos cargar el historial de conciliación"
              description={historyError}
              actionLabel="Volver a intentar"
              onAction={() => void loadReconciliationHistory(selectedAccountId)}
            />
          ) : historyLoading ? (
            <div className="flex h-40 items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : reconciliations.length === 0 ? (
            <EmptyState
              icon={Scale}
              title="Todavía no hay conciliaciones"
              description={`Todavía no hay conciliaciones de ${selectedAccount?.name ?? "esta cuenta"}.`}
              actionLabel="Actualizar"
              onAction={() => void loadReconciliationHistory(selectedAccountId)}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Total contado</TableHead>
                  <TableHead className="text-right">Total esperado</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reconciliations.map((reconciliation) => {
                  const currency = reconciliation.currency || selectedAccount?.currency || "CRC"
                  const isOpen = reconciliation.status === "OPEN"

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
                              Cerrada {formatDate(reconciliation.closedAt)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getCountMethodLabel(reconciliation.countMethod)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(reconciliation.countedTotal, currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(reconciliation.expectedTotal, currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            "font-mono font-semibold",
                            isBalanced(reconciliation.difference)
                              ? "text-success"
                              : reconciliation.status === "IGNORED"
                                ? "text-muted-foreground"
                                : "text-warning",
                          )}
                        >
                          {formatSignedCurrency(reconciliation.difference, currency)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusIndicator status={reconciliation.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleViewDetail(reconciliation.id)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Ver detalle
                          </Button>
                          {reconciliation.status === "OPEN" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setIgnoreError(null)
                                setIgnoreId(reconciliation.id)
                              }}
                            >
                              Ignorar
                            </Button>
                          ) : null}
                        </div>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Nueva conciliación</DialogTitle>
            <DialogDescription>
              {createAccountIsCash
                ? "Elige cómo contar el saldo. El conteo por denominaciones conserva el desglose de cada importe."
                : "Registra el total contado para la cuenta y fecha seleccionadas."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {createError && (
              <Alert className="border-warning/50 bg-warning/5">
                <AlertCircle className="h-4 w-4 text-warning" />
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <AccessibleField className="space-y-2">
                <Label htmlFor="reconciliation-account">Cuenta</Label>
                <Select
                  value={createForm.accountId}
                  onValueChange={(value) => {
                    const account =
                      selectableAccounts.find((item) => item.id.toString() === value) ?? null
                    setCreateForm((current) => ({
                      ...current,
                      accountId: value,
                      countMethod: account?.type === "CASH" ? "DENOMINATION_COUNT" : "MANUAL_TOTAL",
                      manualCountedTotal: "",
                      quantities: {},
                    }))
                    setCashCatalog(null)
                    setCashCatalogError(null)
                    setCreateError(null)
                  }}
                >
                  <SelectTrigger
                    id="reconciliation-account"
                    aria-invalid={Boolean(createFormErrors.accountId)}
                  >
                    <SelectValue placeholder="Elige una cuenta" />
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
                  <AccessibleFieldError className="text-xs text-destructive">
                    {createFormErrors.accountId}
                  </AccessibleFieldError>
                )}
              </AccessibleField>

              <AccessibleField className="space-y-2">
                <Label htmlFor="reconciliation-date">Fecha de conciliación</Label>
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
                  <AccessibleFieldError className="text-xs text-destructive">
                    {createFormErrors.date}
                  </AccessibleFieldError>
                )}
              </AccessibleField>
            </div>

            {createAccountIsCash && (
              <AccessibleField className="space-y-2">
                <Label htmlFor="reconciliation-count-method">Método de conteo</Label>
                <Select
                  value={createForm.countMethod}
                  onValueChange={(value) =>
                    setCreateForm((current) => ({
                      ...current,
                      countMethod: value as ReconciliationCountMethod,
                    }))
                  }
                >
                  <SelectTrigger id="reconciliation-count-method" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DENOMINATION_COUNT">Contar por denominaciones</SelectItem>
                    <SelectItem value="MANUAL_TOTAL">Introducir total manual</SelectItem>
                  </SelectContent>
                </Select>
              </AccessibleField>
            )}

            {createForm.countMethod === "MANUAL_TOTAL" ? (
              <AccessibleField className="space-y-2">
                <Label htmlFor="reconciliation-counted-total">Total contado</Label>
                <Input
                  id="reconciliation-counted-total"
                  type="text"
                  inputMode="decimal"
                  placeholder="Por ejemplo, 123456.78"
                  value={createForm.manualCountedTotal}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      manualCountedTotal: event.target.value,
                    }))
                  }
                  className="font-mono"
                  aria-invalid={Boolean(createFormErrors.countedTotal)}
                />
                {createFormErrors.countedTotal ? (
                  <AccessibleFieldError className="text-xs text-destructive">
                    {createFormErrors.countedTotal}
                  </AccessibleFieldError>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Usa punto decimal y no incluyas separadores de miles. Por ejemplo: 1234.56.
                  </p>
                )}
              </AccessibleField>
            ) : (
              <div className="space-y-4">
                {cashCatalogError && (
                  <Alert className="border-warning/50 bg-warning/5">
                    <AlertCircle className="h-4 w-4 text-warning" />
                    <AlertDescription>{cashCatalogError}</AlertDescription>
                  </Alert>
                )}

                {cashCatalogLoading ? (
                  <div className="flex h-32 items-center justify-center rounded-lg border">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : cashCatalog?.denominations.length ? (
                  <ReconciliationDenominationTable
                    currency={cashCatalog.currency}
                    denominations={cashCatalog.denominations}
                    quantities={createForm.quantities}
                    onQuantityChange={(denominationId, nextValue) =>
                      setCreateForm((current) => ({
                        ...current,
                        quantities: {
                          ...current.quantities,
                          [denominationId]: nextValue,
                        },
                      }))
                    }
                  />
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        No hay denominaciones configuradas para{" "}
                        {createAccount?.currency ?? "esta moneda"}.
                      </span>
                      <Button asChild variant="outline" size="sm">
                        <Link href="/settings">Abrir Ajustes</Link>
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {createFormErrors.countedTotal && !cashCatalogLoading && (
                  <AccessibleFieldError className="text-xs text-destructive">
                    {createFormErrors.countedTotal}
                  </AccessibleFieldError>
                )}
              </div>
            )}

            <AccessibleField className="space-y-2">
              <Label htmlFor="reconciliation-note">Notas</Label>
              <Textarea
                id="reconciliation-note"
                placeholder="Nota opcional para esta conciliación"
                value={createForm.note}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
                rows={3}
              />
            </AccessibleField>

            <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Total contado
                </p>
                <p className="font-mono text-lg font-semibold">
                  {formatCurrency(countedTotalPreview, createAccount?.currency ?? "CRC")}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Total esperado
                </p>
                <p className="font-mono text-lg font-semibold">
                  {expectedPreviewLoading
                    ? "Cargando…"
                    : expectedPreview
                      ? formatCurrency(
                          expectedPreview.expectedTotal,
                          expectedPreview.currency || createAccount?.currency || "CRC",
                        )
                      : "No disponible"}
                </p>
                {expectedPreviewError && (
                  <AccessibleFieldError className="text-xs text-destructive">
                    {expectedPreviewError}
                  </AccessibleFieldError>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Diferencia</p>
                <p
                  className={cn(
                    "font-mono text-lg font-semibold",
                    differencePreview === null
                      ? "text-muted-foreground"
                      : isBalanced(differencePreview)
                        ? "text-success"
                        : "text-warning",
                  )}
                >
                  {differencePreview === null
                    ? "No disponible"
                    : formatSignedCurrency(
                        differencePreview,
                        expectedPreview?.currency || createAccount?.currency || "CRC",
                      )}
                </p>
              </div>
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
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!isCreateFormValid || createLoading}>
              {createLoading ? "Creando…" : "Crear conciliación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailId(null)
            setDetailRecord(null)
            setDetailError(null)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalle de conciliación</DialogTitle>
            <DialogDescription>
              Consulta los saldos guardados y el desglose por denominaciones cuando corresponda.
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex h-40 items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : detailError ? (
            <Alert className="border-warning/50 bg-warning/5">
              <AlertCircle className="h-4 w-4 text-warning" />
              <AlertDescription>{detailError}</AlertDescription>
            </Alert>
          ) : detailRecord ? (
            <div className="space-y-4">
              <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Fecha</p>
                  <p className="font-medium">{formatDate(detailRecord.date)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Método</p>
                  <p className="font-medium">{getCountMethodLabel(detailRecord.countMethod)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Contado</p>
                  <p className="font-mono">
                    {formatCurrency(detailRecord.countedTotal, detailRecord.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Esperado</p>
                  <p className="font-mono">
                    {formatCurrency(detailRecord.expectedTotal, detailRecord.currency)}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Diferencia
                  </p>
                  <p className="font-mono font-semibold">
                    {formatSignedCurrency(detailRecord.difference, detailRecord.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Estado</p>
                  <div className="pt-1">
                    <StatusIndicator status={detailRecord.status} />
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Notas</p>
                  <p className="text-sm text-muted-foreground">
                    {detailRecord.note || "Sin notas"}
                  </p>
                </div>
              </div>

              {detailRecord.countMethod === "DENOMINATION_COUNT" &&
                detailRecord.lines.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Denominación</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailRecord.lines.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell className="font-medium">
                              {line.denominationLabel ||
                                formatCurrency(line.denominationValue, detailRecord.currency)}
                            </TableCell>
                            <TableCell>
                              {line.denominationType === "BILL" ? "Billete" : "Moneda"}
                            </TableCell>
                            <TableCell className="text-right font-mono">{line.quantity}</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(line.lineTotal, detailRecord.currency)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
            </div>
          ) : null}
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
            <AlertDialogTitle>¿Ignorar esta conciliación?</AlertDialogTitle>
            <AlertDialogDescription>
              La conciliación activa se marcará como ignorada y quedará cerrada. Podrás crear otra
              para la misma cuenta.
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
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleIgnore()
              }}
              disabled={ignoreLoading}
            >
              {ignoreLoading ? "Ignoring..." : "Ignorar conciliación"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
