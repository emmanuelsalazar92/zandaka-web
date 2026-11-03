const ISO_DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** Accounting dates follow the application's business timezone, not the browser's UTC day. */
export const ACCOUNTING_TIME_ZONE = "America/Costa_Rica"

export function getAccountingDate(now = new Date(), timeZone = ACCOUNTING_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)?.value ?? ""
  return `${part("year")}-${part("month")}-${part("day")}`
}

export function formatIsoDateOnly(date: string) {
  const match = ISO_DATE_ONLY_PATTERN.exec(date)
  if (!match) return date

  const [, year, month, day] = match
  return `${day}/${month}/${year}`
}

/** Stored SQLite timestamps are UTC; a calendar date remains a calendar date. */
export function formatAccountingTimestamp(value: string | null | undefined): string {
  if (!value) return "No disponible"
  if (ISO_DATE_ONLY_PATTERN.test(value)) return formatIsoDateOnly(value)
  const normalized = value.replace(" ", "T")
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(normalized) ? normalized : normalized + "Z")
  if (Number.isNaN(date.getTime())) return "Fecha no disponible"
  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: ACCOUNTING_TIME_ZONE,
  }).format(date)
}
