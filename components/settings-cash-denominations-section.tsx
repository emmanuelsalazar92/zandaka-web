"use client"

import { Edit2, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react"
import * as React from "react"

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
import { toast } from "@/components/ui/use-toast"
import { formatCurrency } from "@/lib/currency-formatter"
import {
  type AccountOption,
  type CashDenomination,
  type CashDenominationType,
  createCashDenomination,
  deactivateCashDenomination,
  fetchCashDenominations,
  updateCashDenomination,
} from "@/lib/settings-api"

type CashDenominationsSectionProps = {
  baseCurrency: string
  accounts: AccountOption[]
}

type DenominationFormState = {
  currency: string
  value: string
  type: CashDenominationType
  label: string
  sortOrder: string
  isActive: boolean
}

const DEFAULT_FORM = (currency: string, sortOrder = 0): DenominationFormState => ({
  currency,
  value: "",
  type: "BILL",
  label: "",
  sortOrder: String(sortOrder),
  isActive: true,
})

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

export function SettingsCashDenominationsSection({
  baseCurrency,
  accounts,
}: CashDenominationsSectionProps) {
  const [selectedCurrency, setSelectedCurrency] = React.useState(baseCurrency || "CRC")
  const [denominations, setDenominations] = React.useState<CashDenomination[]>([])
  const [loading, setLoading] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingDenominationId, setEditingDenominationId] = React.useState<number | null>(null)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<DenominationFormState>(DEFAULT_FORM(selectedCurrency))

  const currencies = React.useMemo(() => {
    const values = new Set<string>()
    ;[baseCurrency, selectedCurrency, form.currency]
      .concat(accounts.map((account) => account.currency))
      .concat(denominations.map((denomination) => denomination.currency))
      .forEach((value) => {
        const normalized = value.trim().toUpperCase()
        if (normalized) values.add(normalized)
      })
    return [...values].sort()
  }, [accounts, baseCurrency, denominations, form.currency, selectedCurrency])

  const nextSortOrder = React.useMemo(() => {
    const currentMax = denominations.reduce(
      (max, denomination) => Math.max(max, denomination.sortOrder),
      -1,
    )
    return currentMax + 1
  }, [denominations])

  const loadDenominations = React.useCallback(async (currency: string) => {
    try {
      setLoading(true)
      setError(null)
      const items = await fetchCashDenominations({
        currency,
        includeInactive: true,
      })
      setDenominations(items)
    } catch (cause) {
      setDenominations([])
      setError(messageOf(cause, "Failed to load cash denominations."))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadDenominations(selectedCurrency)
  }, [loadDenominations, selectedCurrency])

  const resetForm = React.useCallback(
    (currency = selectedCurrency, sortOrder = nextSortOrder) => {
      setEditingDenominationId(null)
      setFormError(null)
      setForm(DEFAULT_FORM(currency, sortOrder))
    },
    [nextSortOrder, selectedCurrency],
  )

  const openCreateForm = () => {
    resetForm(selectedCurrency, nextSortOrder)
    setFormOpen(true)
  }

  const openEditForm = (denomination: CashDenomination) => {
    setEditingDenominationId(denomination.id)
    setFormError(null)
    setForm({
      currency: denomination.currency,
      value: denomination.value.toString(),
      type: denomination.type,
      label: denomination.label ?? "",
      sortOrder: denomination.sortOrder.toString(),
      isActive: denomination.isActive,
    })
    setFormOpen(true)
  }

  const saveDenomination = async () => {
    const value = Number(form.value)
    const sortOrder = Number(form.sortOrder)
    const currency = form.currency.trim().toUpperCase()

    if (!currency) {
      setFormError("Currency is required.")
      return
    }
    if (!Number.isFinite(value) || value <= 0) {
      setFormError("Value must be greater than zero.")
      return
    }
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setFormError("Sort order must be a non-negative integer.")
      return
    }

    try {
      setBusy(true)
      setFormError(null)

      const payload = {
        currency,
        value,
        type: form.type,
        label: form.label.trim() || null,
        sortOrder,
        isActive: form.isActive,
      }

      if (editingDenominationId !== null) {
        await updateCashDenomination(editingDenominationId, payload)
        toast({
          title: "Denomination updated",
          description: `Updated ${payload.label || formatCurrency(value, currency)}.`,
        })
      } else {
        await createCashDenomination(payload)
        toast({
          title: "Denomination created",
          description: `Added ${payload.label || formatCurrency(value, currency)}.`,
        })
      }

      setSelectedCurrency(currency)
      await loadDenominations(currency)
      setFormOpen(false)
      resetForm(currency)
    } catch (cause) {
      setFormError(messageOf(cause, "Failed to save denomination."))
    } finally {
      setBusy(false)
    }
  }

  const handleDeactivate = async (denomination: CashDenomination) => {
    try {
      setBusy(true)
      await deactivateCashDenomination(denomination.id)
      toast({
        title: "Denomination deactivated",
        description: `${denomination.label || formatCurrency(denomination.value, denomination.currency)} is now inactive.`,
      })
      await loadDenominations(selectedCurrency)
    } catch (cause) {
      toast({
        title: "Deactivation failed",
        description: messageOf(cause, "Failed to deactivate denomination."),
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  const handleReactivate = async (denomination: CashDenomination) => {
    try {
      setBusy(true)
      await updateCashDenomination(denomination.id, {
        currency: denomination.currency,
        value: denomination.value,
        type: denomination.type,
        label: denomination.label,
        sortOrder: denomination.sortOrder,
        isActive: true,
      })
      toast({
        title: "Denomination reactivated",
        description: `${denomination.label || formatCurrency(denomination.value, denomination.currency)} is active again.`,
      })
      await loadDenominations(selectedCurrency)
    } catch (cause) {
      toast({
        title: "Reactivation failed",
        description: messageOf(cause, "Failed to reactivate denomination."),
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Cash Denominations</CardTitle>
            <CardDescription>
              Maintain the denomination catalog used to reconcile CASH accounts by currency.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <div className="min-w-[140px]">
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => void loadDenominations(selectedCurrency)}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button type="button" onClick={openCreateForm}>
              <Plus className="mr-2 h-4 w-4" />
              New
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <Alert>
              <AlertTitle>Unable to load denominations</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading denominations...</p>
          ) : denominations.length === 0 ? (
            <Alert>
              <AlertTitle>No denominations configured</AlertTitle>
              <AlertDescription>
                Add the denomination catalog for {selectedCurrency} to enable cash counting.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {denominations.map((denomination) => (
                    <TableRow key={denomination.id}>
                      <TableCell className="min-w-48">
                        <div className="space-y-1">
                          <p className="font-medium">
                            {denomination.label ||
                              formatCurrency(denomination.value, denomination.currency)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(denomination.value, denomination.currency)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {denomination.type === "BILL" ? "Bill" : "Coin"}
                        </Badge>
                      </TableCell>
                      <TableCell>{denomination.sortOrder}</TableCell>
                      <TableCell>
                        <Badge variant={denomination.isActive ? "secondary" : "outline"}>
                          {denomination.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditForm(denomination)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          {denomination.isActive ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleDeactivate(denomination)}
                              disabled={busy}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleReactivate(denomination)}
                              disabled={busy}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
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
          <CardTitle>
            {editingDenominationId !== null ? "Edit Denomination" : "New Denomination"}
          </CardTitle>
          <CardDescription>
            Configure value, type, order, and active state without hardcoding denominations in the
            UI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!formOpen ? (
            <Alert>
              <AlertTitle>Form hidden</AlertTitle>
              <AlertDescription>
                Choose a currency and create a denomination, or edit an existing row.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="cash-denomination-currency">Currency</Label>
                <Input
                  id="cash-denomination-currency"
                  value={form.currency}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      currency: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="CRC"
                  maxLength={10}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cash-denomination-value">Value</Label>
                  <Input
                    id="cash-denomination-value"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.value}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        value: event.target.value,
                      }))
                    }
                    placeholder="500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cash-denomination-type">Type</Label>
                  <Select
                    value={form.type}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        type: value as CashDenominationType,
                      }))
                    }
                  >
                    <SelectTrigger id="cash-denomination-type" className="w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BILL">Bill</SelectItem>
                      <SelectItem value="COIN">Coin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cash-denomination-label">Label</Label>
                <Input
                  id="cash-denomination-label"
                  value={form.label}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      label: event.target.value,
                    }))
                  }
                  placeholder="₡500"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cash-denomination-order">Sort Order</Label>
                  <Input
                    id="cash-denomination-order"
                    type="number"
                    min="0"
                    step="1"
                    value={form.sortOrder}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        sortOrder: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <p className="font-medium">Active</p>
                    <p className="text-sm text-muted-foreground">
                      Inactive denominations remain available in history.
                    </p>
                  </div>
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(checked) =>
                      setForm((current) => ({
                        ...current,
                        isActive: checked,
                      }))
                    }
                  />
                </div>
              </div>

              {formError && <p className="text-sm text-destructive">{formError}</p>}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormOpen(false)
                    resetForm(selectedCurrency, nextSortOrder)
                  }}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={() => void saveDenomination()} disabled={busy}>
                  {editingDenominationId !== null ? "Save Denomination" : "Create Denomination"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
