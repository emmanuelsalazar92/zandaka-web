"use client"

import { FileText } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/currency-formatter"
import { type ReportSnapshot } from "@/lib/reports-api"

import { type ReportHistoryGroup, formatSnapshotTimestamp } from "./report-helpers"
import styles from "./reports.module.css"

type ReportsHistoryPanelProps = {
  groups: ReportHistoryGroup[]
  selectedReportId: number | null
  loading: boolean
  onSelect: (report: ReportSnapshot) => void
}

function HistoryPanelSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, groupIndex) => (
        <div key={groupIndex} className="space-y-3">
          <Skeleton className="h-4 w-28" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((__, itemIndex) => (
              <Skeleton key={itemIndex} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ReportsHistoryPanel({
  groups,
  selectedReportId,
  loading,
  onSelect,
}: ReportsHistoryPanelProps) {
  return (
    <>
      <div className={`${styles.mobile} space-y-2`}>
        <label htmlFor="mobile-report-version" className="text-sm font-medium">
          Versión a consultar
        </label>
        <select
          id="mobile-report-version"
          value={selectedReportId ?? ""}
          disabled={loading}
          className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base text-foreground"
          onChange={(event) => {
            const report = groups
              .flatMap((group) => group.items)
              .find((item) => item.id === Number(event.target.value))
            if (report) onSelect(report)
          }}
        >
          <option value="" disabled>
            Elige un reporte
          </option>
          {groups.map((group) => (
            <optgroup key={group.reportMonth} label={group.label}>
              {group.items.map((report) => (
                <option key={report.id} value={report.id}>
                  {group.label} · v{report.version}
                  {report.isLatest ? " · más reciente" : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <section
        className={`${styles.history} min-h-[34rem] flex-col overflow-hidden rounded-2xl border bg-card`}
      >
        <div className="border-b px-5 py-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Historial de reportes
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">Cada período conserva sus versiones.</p>
        </div>

        <ScrollArea className="h-[calc(100vh-15rem)] min-h-[28rem]">
          <div className="space-y-6 p-4">
            {loading ? (
              <HistoryPanelSkeleton />
            ) : (
              groups.map((group) => (
                <div key={group.reportMonth} className="space-y-2">
                  <div className="px-1">
                    <p className="text-sm font-semibold text-foreground">{group.label}</p>
                  </div>
                  <div className="space-y-2">
                    {group.items.map((report) => {
                      const isSelected = report.id === selectedReportId
                      return (
                        <button
                          key={report.id}
                          type="button"
                          onClick={() => onSelect(report)}
                          className={styles.row}
                          aria-pressed={isSelected}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">
                                v{report.version}
                              </span>
                              {report.isLatest ? (
                                <Badge
                                  variant="secondary"
                                  className="rounded-full px-2 py-0 text-[11px]"
                                >
                                  Más reciente
                                </Badge>
                              ) : null}
                            </div>
                            <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {formatSnapshotTimestamp(report.generatedAt)}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                            <span className="text-muted-foreground">
                              {report.baseCurrency} base
                            </span>
                            <span className="font-medium text-foreground">
                              {report.consolidatedAmount !== null
                                ? formatCurrency(report.consolidatedAmount, report.baseCurrency)
                                : "Sin total consolidado"}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </section>
    </>
  )
}
