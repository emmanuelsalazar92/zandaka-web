"use client"

import { FileStack, Plus } from "lucide-react"
import * as React from "react"

import { PageHeader } from "@/components/page-header"
import { GenerateReportDialog } from "@/components/reports/generate-report-dialog"
import { formatReportMonth } from "@/components/reports/report-helpers"
import {
  groupSnapshotsByMonth,
  selectDefaultSnapshot,
  type ReportHistoryGroup,
} from "@/components/reports/report-helpers"
import { ReportPreviewPanel } from "@/components/reports/report-preview-panel"
import { ReportsHistoryPanel } from "@/components/reports/reports-history-panel"
import styles from "@/components/reports/reports.module.css"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
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
import { Feedback, LoadingState } from "@/components/ui/feedback"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/use-toast"
import { formatCurrency } from "@/lib/currency-formatter"
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
  const reviewNotice = React.useRef<(() => void) | null>(null)
  const generateLock = React.useRef(false)
  const archiveLock = React.useRef(false)
  const [generationReview, setGenerationReview] = React.useState<string | null>(null)
  const [archiveReview, setArchiveReview] = React.useState<string | null>(null)
  const [confirmation, setConfirmation] = React.useState<string | null>(null)
  const [comparisonId, setComparisonId] = React.useState("")
  const [generationReady, setGenerationReady] = React.useState(false)
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
      setGenerationReady(false)
      setError(null)

      const [snapshots, profile, rates] = await Promise.allSettled([
        fetchReportSnapshots(),
        fetchUserSettings(),
        fetchExchangeRates(),
      ] as const)
      if (snapshots.status === "rejected") throw snapshots.reason
      const snapshotData = snapshots.value
      setGenerationReview(null)
      reviewNotice.current?.()
      reviewNotice.current = null
      setArchiveReview(null)
      setReports(snapshotData)
      const ready = profile.status === "fulfilled" && rates.status === "fulfilled"
      setGenerationReady(ready)
      if (profile.status === "fulfilled") setBaseCurrency(profile.value.baseCurrency)
      if (rates.status === "fulfilled") setExchangeRates(rates.value)
      if (!ready)
        setError(
          "Puedes consultar el historial. Actualiza para verificar perfil y cotizaciones antes de generar otra versión.",
        )

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
    if (generateLock.current || generationReview || !generationReady) return
    generateLock.current = true
    setConfirmation(null)
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
      setConfirmation(
        `Versión ${created.reportMonth} v${created.version} guardada. Puedes consultarla o descargarla.`,
      )
      toast({
        title: "Reporte generado",
        description: `Versión ${created.reportMonth} v${created.version} está lista.`,
      })
    } catch (cause) {
      setGenerationReview(
        "No pudimos confirmar la generación. Conservamos tus datos; cierra este diálogo y actualiza el archivo antes de repetir.",
      )
      reviewNotice.current = toast({
        title: "Generación por revisar",
        description: messageOf(
          cause,
          "No pudimos guardar el reporte. Revisa los datos y vuelve a intentar.",
        ),
        variant: "destructive",
      }).dismiss
    } finally {
      generateLock.current = false
      setGenerating(false)
    }
  }

  const handleArchive = async () => {
    if (!selectedReport || archiveLock.current || archiveReview) return
    archiveLock.current = true
    setConfirmation(null)

    try {
      setArchiveBusy(true)
      await archiveReportSnapshot(selectedReport.id)
      const refreshed = await fetchReportSnapshots()
      const nextSelected = selectDefaultSnapshot(refreshed)
      setReports(refreshed)
      setSelectedReportId(nextSelected?.id ?? null)
      setIsArchiveDialogOpen(false)
      setConfirmation(
        `Versión ${selectedReport.reportMonth} v${selectedReport.version} archivada. Sus datos históricos se conservan.`,
      )
      toast({
        title: "Reporte archivado",
        description: `Versión ${selectedReport.reportMonth} v${selectedReport.version} se archivó.`,
      })
    } catch (cause) {
      setArchiveReview(
        "No pudimos confirmar el archivado. Cierra este diálogo y actualiza el archivo antes de repetir.",
      )
      reviewNotice.current = toast({
        title: "Archivado por revisar",
        description: messageOf(cause, "No pudimos archivar el reporte. Vuelve a intentar."),
        variant: "destructive",
      }).dismiss
    } finally {
      archiveLock.current = false
      setArchiveBusy(false)
    }
  }

  return (
    <div
      className={`marea-surface min-w-0 space-y-6 rounded-2xl bg-background p-3 sm:p-5 ${styles.page}`}
    >
      <PageHeader
        title={<>Reportes</>}
        description={<>Una perspectiva clara de tus versiones históricas.</>}
        actionsLabel="Acciones de reportes"
      >
        <Button
          type="button"
          disabled={!generationReady || loading || generating || !!generationReview}
          onClick={() => setIsGenerateOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Generar reporte
        </Button>
      </PageHeader>

      <Button
        variant="outline"
        disabled={loading || generating || archiveBusy}
        onClick={() => void loadReports()}
      >
        Actualizar archivo
      </Button>
      {confirmation && (
        <Feedback tone="success" title="Operación confirmada">
          {confirmation}
        </Feedback>
      )}
      {generationReview && (
        <Feedback tone="warning" title="Generación por revisar">
          {generationReview}
        </Feedback>
      )}
      {archiveReview && (
        <Feedback tone="warning" title="Archivado por revisar">
          {archiveReview}
        </Feedback>
      )}
      {loading && <LoadingState>Consultando archivo de reportes…</LoadingState>}
      {error ? (
        <Alert>
          <AlertTitle>Consulta de reportes</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className={styles.layout}>
          <section className="rounded-2xl border bg-card p-5">
            <Skeleton className="mb-4 h-5 w-32" />
            <Skeleton className="h-[38rem] w-full rounded-xl" />
          </section>
          <section className="rounded-2xl border bg-card p-5">
            <Skeleton className="mb-4 h-8 w-72" />
            <Skeleton className="h-[38rem] w-full rounded-xl" />
          </section>
        </div>
      ) : error && reports.length === 0 ? (
        <p role="status">No se pudo verificar el archivo. Reintenta la consulta.</p>
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
            onSelect={(report) => {
              setSelectedReportId(report.id)
              setComparisonId("")
            }}
          />
          <div className="min-w-0 space-y-6">
            {selectedReport && (
              <section className="space-y-3" aria-label="Comparación de versiones">
                <label htmlFor="compare-report" className="font-medium">
                  Comparar con otra versión del mismo mes
                </label>
                <select
                  id="compare-report"
                  className="min-h-11 w-full rounded-xl border bg-card p-2"
                  value={comparisonId}
                  onChange={(event) => setComparisonId(event.target.value)}
                >
                  <option value="">Sin comparación</option>
                  {reports
                    .filter(
                      (row) =>
                        row.reportMonth === selectedReport.reportMonth &&
                        row.id !== selectedReport.id,
                    )
                    .map((row) => (
                      <option key={row.id} value={row.id}>
                        {formatReportMonth(row.reportMonth)} · v{row.version} · {row.baseCurrency}
                      </option>
                    ))}
                </select>
                {reports
                  .filter(
                    (row) =>
                      String(row.id) === comparisonId &&
                      row.reportMonth === selectedReport.reportMonth &&
                      row.id !== selectedReport.id,
                  )
                  .map((other) => (
                    <div key={other.id} className={`${styles.context} grid gap-4 sm:grid-cols-2`}>
                      {[selectedReport, other].map((row) => (
                        <div key={row.id}>
                          <h2 className="font-semibold">
                            Versión {row.version} · #{row.id}
                          </h2>
                          <p>Original CRC: {formatCurrency(row.totalCrc, "CRC")}</p>
                          <p>Original USD: {formatCurrency(row.totalUsd, "USD")}</p>
                          <p>
                            Consolidado {row.baseCurrency}:{" "}
                            {row.consolidatedAmount === null
                              ? "No disponible"
                              : formatCurrency(row.consolidatedAmount, row.baseCurrency)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ))}
              </section>
            )}
            <ReportPreviewPanel
              report={selectedReport}
              archiveBusy={archiveBusy}
              onArchive={() => setIsArchiveDialogOpen(true)}
            />
          </div>
        </div>
      )}

      <GenerateReportDialog
        open={isGenerateOpen}
        onOpenChange={setIsGenerateOpen}
        baseCurrency={baseCurrency}
        exchangeRates={exchangeRates}
        generating={generating}
        reviewMessage={generationReview}
        onSubmit={handleGenerate}
      />

      <AlertDialog
        open={isArchiveDialogOpen}
        onOpenChange={(open) => {
          if (!archiveBusy) setIsArchiveDialogOpen(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar el reporte?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedReport
                ? `Se archivará ${selectedReport.reportMonth} v${selectedReport.version} del historial principal, conservando los datos capturados.`
                : "El reporte dejará de aparecer en el historial principal. Su información se conservará."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {archiveReview && (
            <Feedback tone="warning" title="Archivado por revisar">
              {archiveReview}
            </Feedback>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveBusy}>Cancelar</AlertDialogCancel>
            <Button
              loading={archiveBusy}
              onClick={() => void handleArchive()}
              disabled={archiveBusy || !!archiveReview}
            >
              Archivar reporte
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
