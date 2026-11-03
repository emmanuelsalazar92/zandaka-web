"use client"

import { Edit2, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react"
import * as React from "react"

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
import { toast } from "@/components/ui/use-toast"
import { formatCurrency } from "@/lib/currency-formatter"
import { tryDecimalInput, assertMoney } from "@/lib/money"
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
      setError(messageOf(cause, "No pudimos cargar las denominaciones. Vuelve a intentar."))
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
    const value = tryDecimalInput(form.value)
    const sortOrder = Number(form.sortOrder)
    const currency = form.currency.trim().toUpperCase()

    if (!currency) {
      setFormError("Elige una moneda.")
      return
    }
    if (!Number.isFinite(value) || value <= 0) {
      setFormError("El valor debe ser mayor que cero.")
      return
    }
    try {
      assertMoney(value, currency)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Revisa el importe")
      return
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setFormError("El orden debe ser un entero igual o mayor que cero.")
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
          title: "Denominación actualizada",
          description: `Updated ${payload.label || formatCurrency(value, currency)}.`,
        })
      } else {
        await createCashDenomination(payload)
        toast({
          title: "Denominación creada",
          description: `Added ${payload.label || formatCurrency(value, currency)}.`,
        })
      }

      setSelectedCurrency(currency)
      await loadDenominations(currency)
      setFormOpen(false)
      resetForm(currency)
    } catch (cause) {
      setFormError(
        messageOf(
          cause,
          "No pudimos guardar la denominación. Revisa los datos y vuelve a intentar.",
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  const handleDeactivate = async (denomination: CashDenomination) => {
    try {
      setBusy(true)
      await deactivateCashDenomination(denomination.id)
      toast({
        title: "Denominación desactivada",
        description: `${denomination.label || formatCurrency(denomination.value, denomination.currency)} está inactiva.`,
      })
      await loadDenominations(selectedCurrency)
    } catch (cause) {
      toast({
        title: "No se completó la desactivación",
        description: messageOf(cause, "No pudimos desactivar la denominación. Vuelve a intentar."),
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
        title: "Denominación reactivada",
        description: `${denomination.label || formatCurrency(denomination.value, denomination.currency)} is active again.`,
      })
      await loadDenominations(selectedCurrency)
    } catch (cause) {
      toast({
        title: "No se completó la reactivación",
        description: messageOf(cause, "No pudimos reactivar la denominación. Vuelve a intentar."),
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
            <CardTitle>Denominaciones de efectivo</CardTitle>
            <CardDescription>
              Configura billetes y monedas para conciliar tus cuentas de efectivo.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <div className="min-w-[140px]">
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger
                  className="w-full"
                  aria-label="Moneda del catálogo de denominaciones"
                >
                  <SelectValue placeholder="Moneda" />
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
              Actualizar
            </Button>
            <Button type="button" onClick={openCreateForm}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <Alert>
              <AlertTitle>No pudimos cargar las denominaciones</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando denominaciones…</p>
          ) : denominations.length === 0 ? (
            <Alert>
              <AlertTitle>No hay denominaciones configuradas</AlertTitle>
              <AlertDescription>
                Añade las denominaciones de {selectedCurrency} para habilitar el conteo de efectivo.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Etiqueta</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Orden</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
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
                          {denomination.type === "BILL" ? "Billete" : "Moneda"}
                        </Badge>
                      </TableCell>
                      <TableCell>{denomination.sortOrder}</TableCell>
                      <TableCell>
                        <Badge variant={denomination.isActive ? "secondary" : "outline"}>
                          {denomination.isActive ? "Activo" : "Inactivo"}
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
            {editingDenominationId !== null ? "Editar denominación" : "Nueva denominación"}
          </CardTitle>
          <CardDescription>
            Configura el valor, tipo, orden y estado de cada denominación.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!formOpen ? (
            <Alert>
              <AlertTitle>Formulario oculto</AlertTitle>
              <AlertDescription>
                Elige una moneda y crea una denominación, o edita una existente.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <AccessibleField className="space-y-2">
                <Label htmlFor="cash-denomination-currency">Moneda</Label>
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
              </AccessibleField>

              <div className="grid gap-4 md:grid-cols-2">
                <AccessibleField className="space-y-2">
                  <Label htmlFor="cash-denomination-value">Valor</Label>
                  <Input
                    id="cash-denomination-value"
                    type="number"
                    min="0"
                    step="any"
                    value={form.value}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        value: event.target.value,
                      }))
                    }
                    placeholder="500"
                  />
                </AccessibleField>

                <AccessibleField className="space-y-2">
                  <Label htmlFor="cash-denomination-type">Tipo</Label>
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
                      <SelectValue placeholder="Elige el tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BILL">Billete</SelectItem>
                      <SelectItem value="COIN">Moneda</SelectItem>
                    </SelectContent>
                  </Select>
                </AccessibleField>
              </div>

              <AccessibleField className="space-y-2">
                <Label htmlFor="cash-denomination-label">Etiqueta</Label>
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
              </AccessibleField>

              <div className="grid gap-4 md:grid-cols-2">
                <AccessibleField className="space-y-2">
                  <Label htmlFor="cash-denomination-order">Orden</Label>
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
                </AccessibleField>

                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <p className="font-medium">Activo</p>
                    <p className="text-sm text-muted-foreground">
                      Las denominaciones inactivas se conservan en el historial.
                    </p>
                  </div>
                  <Switch
                    aria-label="Denominación activa"
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

              {formError && (
                <AccessibleFieldError className="text-sm text-destructive">
                  {formError}
                </AccessibleFieldError>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormOpen(false)
                    resetForm(selectedCurrency, nextSortOrder)
                  }}
                >
                  Cancelar
                </Button>
                <Button type="button" onClick={() => void saveDenomination()} disabled={busy}>
                  {editingDenominationId !== null ? "Guardar denominación" : "Crear denominación"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
