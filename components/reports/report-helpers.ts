import { type ReportSnapshot } from "@/lib/reports-api"

export type ReportHistoryGroup = {
  reportMonth: string
  label: string
  items: ReportSnapshot[]
}

const REPORTS_LOCALE = "en-US"

const sqliteUtcToDate = (value: string) => {
  if (!value) return null
  const normalized = value.includes("T") ? value : value.replace(" ", "T")
  const parsed = new Date(normalized.endsWith("Z") ? normalized : `${normalized}Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const formatReportMonth = (value: string) => {
  const [year, month] = value.split("-").map(Number)
  if (!year || !month) return value
  return new Intl.DateTimeFormat(REPORTS_LOCALE, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

export const formatSnapshotTimestamp = (value: string) => {
  const parsed = sqliteUtcToDate(value)
  if (!parsed) return "Unavailable"

  return new Intl.DateTimeFormat(REPORTS_LOCALE, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed)
}

export const groupSnapshotsByMonth = (snapshots: ReportSnapshot[]): ReportHistoryGroup[] => {
  const groups = new Map<string, ReportSnapshot[]>()

  snapshots.forEach((snapshot) => {
    const bucket = groups.get(snapshot.reportMonth) ?? []
    bucket.push(snapshot)
    groups.set(snapshot.reportMonth, bucket)
  })

  return Array.from(groups.entries())
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([reportMonth, items]) => ({
      reportMonth,
      label: formatReportMonth(reportMonth),
      items: items.slice().sort((left, right) => {
        if (left.isLatest !== right.isLatest) return Number(right.isLatest) - Number(left.isLatest)
        if (left.version !== right.version) return right.version - left.version
        return right.generatedAt.localeCompare(left.generatedAt)
      }),
    }))
}

export const selectDefaultSnapshot = (snapshots: ReportSnapshot[]) => {
  return (
    snapshots.slice().sort((left, right) => {
      if (left.reportMonth !== right.reportMonth)
        return right.reportMonth.localeCompare(left.reportMonth)
      if (left.isLatest !== right.isLatest) return Number(right.isLatest) - Number(left.isLatest)
      if (left.version !== right.version) return right.version - left.version
      return right.generatedAt.localeCompare(left.generatedAt)
    })[0] ?? null
  )
}
