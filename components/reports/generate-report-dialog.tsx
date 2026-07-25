"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
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
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { type ExchangeRate } from "@/lib/settings-api"

type GenerateReportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  baseCurrency: string
  exchangeRates: ExchangeRate[]
  generating: boolean
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
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

const MONTH_OPTIONS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
] as const

const rateModeOptions = (baseCurrency: string) =>
  baseCurrency === "CRC"
    ? [
        { value: "auto", label: "Automatic month-end rate" },
        { value: "stored", label: "Stored exchange rate" },
        { value: "manual", label: "Manual USD to CRC rate" },
      ]
    : [
        { value: "auto", label: "Automatic month-end rate" },
        { value: "stored", label: "Stored exchange rate" },
      ]

export function GenerateReportDialog({
  open,
  onOpenChange,
  baseCurrency,
  exchangeRates,
  generating,
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
        rateMode === "manual" && manualRate.trim() ? Number.parseFloat(manualRate.trim()) : null,
      notes: notes.trim() || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Report</DialogTitle>
          <DialogDescription>
            Create a new historical snapshot for a month and immediately add it to the report
            archive.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>Report Month</Label>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
              <Select value={reportMonthPart} onValueChange={setReportMonthPart}>
                <SelectTrigger className="w-full" aria-label="Report month">
                  <SelectValue placeholder="Select month" />
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
                aria-label="Report year"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-base-currency">Base Currency</Label>
            <Input id="report-base-currency" value={baseCurrency} disabled readOnly />
            <p className="text-xs text-muted-foreground">
              This follows the user profile configured in Settings.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-rate-mode">Exchange Rate Source</Label>
            <Select
              value={rateMode}
              onValueChange={(value) => setRateMode(value as "auto" | "stored" | "manual")}
            >
              <SelectTrigger id="report-rate-mode" className="w-full">
                <SelectValue placeholder="Select how to resolve the rate" />
              </SelectTrigger>
              <SelectContent>
                {rateModeOptions(baseCurrency).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {rateMode === "stored" ? (
            <div className="space-y-2">
              <Label htmlFor="stored-rate">Stored Exchange Rate</Label>
              <Select value={selectedRateId} onValueChange={setSelectedRateId}>
                <SelectTrigger id="stored-rate" className="w-full">
                  <SelectValue placeholder="Select a stored rate" />
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
                  No stored rates available for the current base currency. Automatic lookup will
                  still work.
                </p>
              ) : null}
            </div>
          ) : null}

          {rateMode === "manual" && baseCurrency === "CRC" ? (
            <div className="space-y-2">
              <Label htmlFor="manual-rate">Manual USD to CRC Rate</Label>
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
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="report-notes">Notes</Label>
            <Textarea
              id="report-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional note for this report version"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={generating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                generating ||
                !reportMonth ||
                (rateMode === "stored" && !selectedRateId) ||
                (rateMode === "manual" && baseCurrency === "CRC" && !manualRate.trim())
              }
            >
              {generating ? <Spinner className="h-4 w-4" /> : null}
              Generate Report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
