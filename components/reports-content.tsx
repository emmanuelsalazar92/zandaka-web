"use client"

import { FileStack, Plus } from "lucide-react"
import * as React from "react"

import { GenerateReportDialog } from "@/components/reports/generate-report-dialog"
import {
  groupSnapshotsByMonth,
  selectDefaultSnapshot,
  type ReportHistoryGroup,
} from "@/components/reports/report-helpers"
import { ReportPreviewPanel } from "@/components/reports/report-preview-panel"
import { ReportsHistoryPanel } from "@/components/reports/reports-history-panel"
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
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/use-toast"
import {
  archiveReportSnapshot,
  fetchReportSnapshots,
  generateReportSnapshot,
  type ReportSnapshot,
} from "@/lib/reports-api"
import {
  createExchangeRate,
  fetchExchangeRateByDate,
  fetchExchangeRates,
  fetchUserSettings,
  type ExchangeRate,
} from "@/lib/settings-api"

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

const resolveMonthEndDate = (reportMonth: string) => {
  const [year, month] = reportMonth.split("-").map((value) => Number.parseInt(value, 10))
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new Error("Invalid report month.")
  }

  const monthEnd = new Date(Date.UTC(year, month, 0))
  const today = new Date()
  const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
  const resolvedDate = monthEnd.getTime() > todayUtc.getTime() ? todayUtc : monthEnd
  const resolvedYear = resolvedDate.getUTCFullYear()
  const resolvedMonth = String(resolvedDate.getUTCMonth() + 1).padStart(2, "0")
  const resolvedDay = String(resolvedDate.getUTCDate()).padStart(2, "0")
  return `${resolvedYear}-${resolvedMonth}-${resolvedDay}`
}

const findStoredMonthEndRate = (
  rates: ExchangeRate[],
  baseCurrency: string,
  effectiveDate: string,
) => {
  const targetPair =
    baseCurrency === "CRC"
      ? { fromCurrency: "USD", toCurrency: "CRC" }
      : { fromCurrency: "CRC", toCurrency: "USD" }

  return (
    rates.find(
      (rate) =>
        rate.effectiveDate === effectiveDate &&
        rate.fromCurrency === targetPair.fromCurrency &&
        rate.toCurrency === targetPair.toCurrency,
    ) ?? null
  )
}

export function ReportsContent() {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reports, setReports] = React.useState<ReportSnapshot[]>([])
  const [selectedReportId, setSelectedReportId] = React.useState<number | null>(null)
  const [baseCurrency, setBaseCurrency] = React.useState("CRC")
  const [exchangeRates, setExchangeRates] = React.useState<
    Awaited<ReturnType<typeof fetchExchangeRates>>
  >([])
  const [isGenerateOpen, setIsGenerateOpen] = React.useState(false)
  const [generating, setGenerating] = React.useState(false)
  const [archiveBusy, setArchiveBusy] = React.useState(false)
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = React.useState(false)

  const loadReports = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [snapshotData, profileData, exchangeRateData] = await Promise.all([
        fetchReportSnapshots(),
        fetchUserSettings(),
        fetchExchangeRates(),
      ])

      setReports(snapshotData)
      setBaseCurrency(profileData.baseCurrency)
      setExchangeRates(exchangeRateData)

      setSelectedReportId((current) => {
        if (current !== null && snapshotData.some((report) => report.id === current)) {
          return current
        }

        return selectDefaultSnapshot(snapshotData)?.id ?? null
      })
    } catch (cause) {
      setError(messageOf(cause, "Failed to load reports."))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadReports()
  }, [loadReports])

  const groupedReports = React.useMemo<ReportHistoryGroup[]>(
    () => groupSnapshotsByMonth(reports),
    [reports],
  )

  const selectedReport = React.useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? null,
    [reports, selectedReportId],
  )

  const handleGenerate = async (input: {
    reportMonth: string
    baseCurrency: string
    rateMode: "auto" | "stored" | "manual"
    exchangeRateId: number | null
    usdToCrcRate: number | null
    notes: string | null
  }) => {
    try {
      setGenerating(true)
      let payload = { ...input }

      if (input.rateMode === "auto") {
        const effectiveDate = resolveMonthEndDate(input.reportMonth)
        let storedRate = findStoredMonthEndRate(exchangeRates, input.baseCurrency, effectiveDate)

        if (!storedRate) {
          const resolvedRate = await fetchExchangeRateByDate(effectiveDate)
          const rateValue =
            input.baseCurrency === "CRC" ? resolvedRate.compra : 1 / resolvedRate.venta

          storedRate = await createExchangeRate({
            fromCurrency: input.baseCurrency === "CRC" ? "USD" : "CRC",
            toCurrency: input.baseCurrency === "CRC" ? "CRC" : "USD",
            rate: rateValue,
            effectiveDate,
          })

          setExchangeRates((current) => {
            const duplicate = findStoredMonthEndRate(current, input.baseCurrency, effectiveDate)
            return duplicate ? current : [storedRate as ExchangeRate, ...current]
          })
        }

        payload = {
          ...payload,
          rateMode: "stored",
          exchangeRateId: storedRate.id,
          usdToCrcRate: input.baseCurrency === "CRC" ? null : input.usdToCrcRate,
        }
      }

      const created = await generateReportSnapshot(payload)
      const refreshed = await fetchReportSnapshots()
      setReports(refreshed)
      setSelectedReportId(created.id)
      setIsGenerateOpen(false)
      toast({
        title: "Report generated",
        description: `Snapshot ${created.reportMonth} v${created.version} is ready.`,
      })
    } catch (cause) {
      toast({
        title: "Report generation failed",
        description: messageOf(cause, "Failed to generate the report snapshot."),
        variant: "destructive",
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleArchive = async () => {
    if (!selectedReport) return

    try {
      setArchiveBusy(true)
      await archiveReportSnapshot(selectedReport.id)
      const refreshed = await fetchReportSnapshots()
      const nextSelected = selectDefaultSnapshot(refreshed)
      setReports(refreshed)
      setSelectedReportId(nextSelected?.id ?? null)
      setIsArchiveDialogOpen(false)
      toast({
        title: "Report archived",
        description: `Snapshot ${selectedReport.reportMonth} v${selectedReport.version} moved out of the main history.`,
      })
    } catch (cause) {
      toast({
        title: "Archive failed",
        description: messageOf(cause, "Failed to archive the selected report."),
        variant: "destructive",
      })
    } finally {
      setArchiveBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Reports</h2>
          <p className="text-muted-foreground">
            View, generate, and download historical financial snapshots.
          </p>
        </div>

        <Button type="button" onClick={() => setIsGenerateOpen(true)}>
          <Plus className="h-4 w-4" />
          Generate Report
        </Button>
      </div>

      {error ? (
        <Alert>
          <AlertTitle>Reports unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <section className="rounded-2xl border bg-card p-5">
            <Skeleton className="mb-4 h-5 w-32" />
            <Skeleton className="h-[38rem] w-full rounded-xl" />
          </section>
          <section className="rounded-2xl border bg-card p-5">
            <Skeleton className="mb-4 h-8 w-72" />
            <Skeleton className="h-[38rem] w-full rounded-xl" />
          </section>
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl border bg-card p-6">
          <Empty className="border border-dashed bg-muted/10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileStack />
              </EmptyMedia>
              <EmptyTitle>No reports yet</EmptyTitle>
              <EmptyDescription>
                Generate your first historical financial snapshot to preview and download it here.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" onClick={() => setIsGenerateOpen(true)}>
                <Plus className="h-4 w-4" />
                Generate your first report
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <ReportsHistoryPanel
            groups={groupedReports}
            selectedReportId={selectedReportId}
            loading={loading}
            onSelect={(report) => setSelectedReportId(report.id)}
          />
          <ReportPreviewPanel
            report={selectedReport}
            archiveBusy={archiveBusy}
            onArchive={() => setIsArchiveDialogOpen(true)}
          />
        </div>
      )}

      <GenerateReportDialog
        open={isGenerateOpen}
        onOpenChange={setIsGenerateOpen}
        baseCurrency={baseCurrency}
        exchangeRates={exchangeRates}
        generating={generating}
        onSubmit={handleGenerate}
      />

      <AlertDialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive report?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedReport
                ? `This will hide ${selectedReport.reportMonth} v${selectedReport.version} from the main report history without deleting the snapshot data.`
                : "This will hide the selected report from the main report history without deleting it."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleArchive()} disabled={archiveBusy}>
              Archive report
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
