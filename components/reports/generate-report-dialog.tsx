"use client"

import * as React from "react"

import { AccessibleField } from "@/components/ui/accessible-field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea"
import { getAccountingDate } from "@/lib/date-only"
import { tryDecimalInput } from "@/lib/money"
import { type ExchangeRate } from "@/lib/settings-api"

type GenerateReportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  baseCurrency: string
  exchangeRates: ExchangeRate[]
  generating: boolean
  reviewMessage?: string | null
  onSubmit: (input: {
    reportMonth: string
    baseCurrency: string
    rateMode: "auto" | "stored" | "manual"
    exchangeRateId: number | null
    usdToCrcRate: number | null
    notes: string | null
  }) => Promise<void>
}

const currentMonthValue = () => {
  return getAccountingDate().slice(0, 7)
}

const MONTH_OPTIONS = [
  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
] as const

const rateModeOptions = (baseCurrency: string) =>
  baseCurrency === "CRC"
    ? [
        { value: "auto", label: "Cotización automática de fin de mes" },
        { value: "stored", label: "Cotización guardada" },
        { value: "manual", label: "Cotización manual de USD a CRC" },
      ]
    : [
        { value: "auto", label: "Cotización automática de fin de mes" },
        { value: "stored", label: "Cotización guardada" },
      ]

export function GenerateReportDialog({
  open,
  onOpenChange,
  baseCurrency,
  exchangeRates,
  generating,
  reviewMessage,
  onSubmit,
}: GenerateReportDialogProps) {
  const [reportMonth, setReportMonth] = React.useState(currentMonthValue)
  const [rateMode, setRateMode] = React.useState<"auto" | "stored" | "manual">("auto")
  const [selectedRateId, setSelectedRateId] = React.useState<string>("")
  const [manualRate, setManualRate] = React.useState("")
  const [notes, setNotes] = React.useState("")

  const [initialYear, initialMonth] = currentMonthValue().split("-")
  const [reportYear, setReportYear] = React.useState(initialYear)
  const [reportMonthPart, setReportMonthPart] = React.useState(initialMonth)

  React.useEffect(() => {
    if (!open) return
    const nextReportMonth = currentMonthValue()
    const [nextYear, nextMonth] = nextReportMonth.split("-")
    setReportMonth(nextReportMonth)
    setReportYear(nextYear)
    setReportMonthPart(nextMonth)
    setRateMode("auto")
    setSelectedRateId("")
    setManualRate("")
    setNotes("")
  }, [open])

  React.useEffect(() => {
    if (!reportYear || !reportMonthPart) return
    setReportMonth(`${reportYear}-${reportMonthPart}`)
  }, [reportYear, reportMonthPart])

  const eligibleRates = React.useMemo(() => {
    const targetPair =
      baseCurrency === "CRC"
        ? { fromCurrency: "USD", toCurrency: "CRC" }
        : { fromCurrency: "CRC", toCurrency: "USD" }

    return exchangeRates
      .filter(
        (rate) =>
          rate.fromCurrency === targetPair.fromCurrency &&
          rate.toCurrency === targetPair.toCurrency,
      )
      .sort((left, right) => {
        if (left.effectiveDate !== right.effectiveDate) {
          return right.effectiveDate.localeCompare(left.effectiveDate)
        }
        return right.id - left.id
      })
  }, [baseCurrency, exchangeRates])

  React.useEffect(() => {
    if (rateMode !== "manual" || baseCurrency === "CRC") return
    setRateMode("auto")
  }, [baseCurrency, rateMode])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    await onSubmit({
      reportMonth,
      baseCurrency,
      rateMode,
      exchangeRateId:
        rateMode === "stored" && selectedRateId ? Number.parseInt(selectedRateId, 10) : null,
      usdToCrcRate:
        rateMode === "manual" && manualRate.trim() ? tryDecimalInput(manualRate.trim()) : null,
      notes: notes.trim() || null,
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!generating) onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generar reporte</DialogTitle>
          <DialogDescription>
            Guarda una versión de los saldos actuales identificada por mes de referencia. La captura
            no reconstruye un cierre contable mensual.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <fieldset disabled={generating} className="min-w-0 space-y-4">
            <div className="space-y-2">
              <Label>Mes de referencia</Label>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                <Select value={reportMonthPart} onValueChange={setReportMonthPart}>
                  <SelectTrigger className="w-full" aria-label="Mes del reporte">
                    <SelectValue placeholder="Elige el mes" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_OPTIONS.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="report-year"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={reportYear}
                  onChange={(event) =>
                    setReportYear(event.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="2026"
                  aria-label="Año del reporte"
                  required
                />
              </div>
            </div>

            <AccessibleField className="space-y-2">
              <Label htmlFor="report-base-currency">Moneda de presentación</Label>
              <Input id="report-base-currency" value={baseCurrency} disabled readOnly />
              <p className="text-xs text-muted-foreground">
                Corresponde a la moneda de tu perfil en Ajustes.
              </p>
            </AccessibleField>

            <AccessibleField className="space-y-2">
              <Label htmlFor="report-rate-mode">Origen de la cotización</Label>
              <Select
                value={rateMode}
                onValueChange={(value) => setRateMode(value as "auto" | "stored" | "manual")}
              >
                <SelectTrigger id="report-rate-mode" className="w-full">
                  <SelectValue placeholder="Elige cómo obtener la cotización" />
                </SelectTrigger>
                <SelectContent>
                  {rateModeOptions(baseCurrency).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </AccessibleField>

            {rateMode === "stored" ? (
              <AccessibleField className="space-y-2">
                <Label htmlFor="stored-rate">Cotización guardada</Label>
                <Select value={selectedRateId} onValueChange={setSelectedRateId}>
                  <SelectTrigger id="stored-rate" className="w-full">
                    <SelectValue placeholder="Elige una cotización guardada" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleRates.map((rate) => (
                      <SelectItem key={rate.id} value={String(rate.id)}>
                        {rate.effectiveDate} • {rate.fromCurrency} → {rate.toCurrency} •{" "}
                        {rate.rate.toFixed(4)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {eligibleRates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No hay cotizaciones guardadas para esta moneda. Puedes usar la consulta
                    automática.
                  </p>
                ) : null}
              </AccessibleField>
            ) : null}

            {rateMode === "manual" && baseCurrency === "CRC" ? (
              <AccessibleField className="space-y-2">
                <Label htmlFor="manual-rate">Cotización manual de USD a CRC</Label>
                <Input
                  id="manual-rate"
                  type="number"
                  min="0"
                  step="0.0001"
                  inputMode="decimal"
                  value={manualRate}
                  onChange={(event) => setManualRate(event.target.value)}
                  placeholder="512.3400"
                />
              </AccessibleField>
            ) : null}

            <AccessibleField className="space-y-2">
              <Label htmlFor="report-notes">Notas</Label>
              <Textarea
                id="report-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Nota opcional para esta versión del reporte"
              />
            </AccessibleField>
          </fieldset>
          {reviewMessage && (
            <Feedback tone="warning" title="Generación por revisar">
              {reviewMessage}
            </Feedback>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={generating}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={generating}
              disabled={
                generating ||
                !!reviewMessage ||
                !reportMonth ||
                (rateMode === "stored" && !selectedRateId) ||
                (rateMode === "manual" && baseCurrency === "CRC" && !manualRate.trim())
              }
            >
              Generar reporte
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
