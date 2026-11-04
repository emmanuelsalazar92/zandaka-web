"use client"

import { FileStack, Plus } from "lucide-react"
import * as React from "react"

import { PageHeader } from "@/components/page-header"
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
    throw new Error("Elige un mes válido para el reporte.")
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
      setError(messageOf(cause, "No pudimos cargar los reportes. Vuelve a intentar."))
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
          const rateValue = input.baseCurrency === "CRC" ? resolvedRate.compra : resolvedRate.venta

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
        title: "Reporte generado",
        description: `Versión ${created.reportMonth} v${created.version} está lista.`,
      })
    } catch (cause) {
      toast({
        title: "No se generó el reporte",
        description: messageOf(
          cause,
          "No pudimos guardar el reporte. Revisa los datos y vuelve a intentar.",
        ),
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
        title: "Reporte archivado",
        description: `Versión ${selectedReport.reportMonth} v${selectedReport.version} se archivó.`,
      })
    } catch (cause) {
      toast({
        title: "No se archivó el reporte",
        description: messageOf(cause, "No pudimos archivar el reporte. Vuelve a intentar."),
        variant: "destructive",
      })
    } finally {
      setArchiveBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>Reportes</>}
        description={<>Una perspectiva clara de tus versiones históricas.</>}
        actionsLabel="Acciones de reportes"
      >
        <Button type="button" onClick={() => setIsGenerateOpen(true)}>
          <Plus className="h-4 w-4" />
          Generar reporte
        </Button>
      </PageHeader>

      {error ? (
        <Alert>
          <AlertTitle>Reportes no disponibles</AlertTitle>
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
              <EmptyTitle>Todavía no hay reportes</EmptyTitle>
              <EmptyDescription>
                Genera tu primera versión de saldos para consultarla y descargarla aquí.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" onClick={() => setIsGenerateOpen(true)}>
                <Plus className="h-4 w-4" />
                Generar mi primer reporte
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
            <AlertDialogTitle>¿Archivar el reporte?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedReport
                ? `Se archivará ${selectedReport.reportMonth} v${selectedReport.version} from the main report history without deleting the snapshot data.`
                : "El reporte dejará de aparecer en el historial principal. Su información se conservará."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleArchive()} disabled={archiveBusy}>
              Archivar reporte
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
