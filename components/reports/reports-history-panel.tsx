"use client"

import { FileText } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/currency-formatter"
import { type ReportSnapshot } from "@/lib/reports-api"
import { cn } from "@/lib/utils"

import { type ReportHistoryGroup, formatSnapshotTimestamp } from "./report-helpers"

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
    <section className="flex min-h-[34rem] flex-col overflow-hidden rounded-2xl border bg-card">
      <div className="border-b px-5 py-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Report History
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse monthly snapshots and compare generated versions.
        </p>
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
                        className={cn(
                          "w-full rounded-xl border px-4 py-3 text-left transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                          isSelected
                            ? "border-primary bg-primary/8 shadow-sm"
                            : "border-border/70 bg-background hover:bg-accent/50",
                        )}
                        aria-pressed={isSelected}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">
                              v{report.version}
                            </span>
                            {report.isLatest ? (
                              <Badge
                                variant="secondary"
                                className="rounded-full px-2 py-0 text-[11px]"
                              >
                                Latest
                              </Badge>
                            ) : null}
                          </div>
                          <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {formatSnapshotTimestamp(report.generatedAt)}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                          <span className="text-muted-foreground">{report.baseCurrency} base</span>
                          <span className="font-medium text-foreground">
                            {report.consolidatedAmount !== null
                              ? formatCurrency(report.consolidatedAmount, report.baseCurrency)
                              : "No consolidated total"}
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
  )
}
