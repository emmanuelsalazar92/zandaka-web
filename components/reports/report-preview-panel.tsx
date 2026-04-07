"use client"

import { Archive, Download, FileSearch } from "lucide-react"
import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/currency-formatter"
import { getReportPdfUrl, type ReportSnapshot } from "@/lib/reports-api"

import { formatReportMonth, formatSnapshotTimestamp } from "./report-helpers"

type ReportPreviewPanelProps = {
  report: ReportSnapshot | null
  archiveBusy?: boolean
  onArchive?: () => void
}

export function ReportPreviewPanel({
  report,
  archiveBusy = false,
  onArchive,
}: ReportPreviewPanelProps) {
  const [previewLoading, setPreviewLoading] = React.useState(Boolean(report))

  React.useEffect(() => {
    setPreviewLoading(Boolean(report))
  }, [report])

  if (!report) {
    return (
      <section className="flex min-h-[34rem] items-center justify-center rounded-2xl border bg-card">
        <div className="max-w-md px-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <FileSearch className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">Select a report</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a historical snapshot from the left panel to preview the exact PDF stored for
            that version.
          </p>
        </div>
      </section>
    )
  }

  const previewUrl = `${getReportPdfUrl(report.id, "inline")}&t=${encodeURIComponent(
    report.updatedAt || report.generatedAt || String(report.id),
  )}`
  const downloadUrl = getReportPdfUrl(report.id, "attachment")

  return (
    <section className="flex min-h-[34rem] flex-col overflow-hidden rounded-2xl border bg-card">
      <div className="border-b px-5 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">{formatReportMonth(report.reportMonth)}</h3>
              <Badge variant="outline">v{report.version}</Badge>
              {report.isLatest ? <Badge variant="secondary">Latest</Badge> : null}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span>Generated {formatSnapshotTimestamp(report.generatedAt)}</span>
              <span>Base {report.baseCurrency}</span>
              <span>
                Consolidated{" "}
                {report.consolidatedAmount !== null
                  ? formatCurrency(report.consolidatedAmount, report.baseCurrency)
                  : "N/A"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={onArchive}
              disabled={archiveBusy}
            >
              <Archive className="h-4 w-4" />
              Archive
            </Button>
            <Button type="button" asChild className="shrink-0">
              <a href={downloadUrl}>
                <Download className="h-4 w-4" />
                Download PDF
              </a>
            </Button>
          </div>
        </div>
      </div>

      <div className="relative flex-1 bg-muted/20">
        {previewLoading ? (
          <div className="absolute inset-0 z-10 space-y-4 p-5">
            <Skeleton className="h-full w-full rounded-xl" />
          </div>
        ) : null}

        <iframe
          key={previewUrl}
          title={`Report preview ${report.id}`}
          src={previewUrl}
          className="h-[calc(100vh-17rem)] min-h-[40rem] w-full border-0"
          onLoad={() => setPreviewLoading(false)}
        />
      </div>
    </section>
  )
}
