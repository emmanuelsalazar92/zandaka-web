const ISO_DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function formatIsoDateOnly(date: string) {
  const match = ISO_DATE_ONLY_PATTERN.exec(date)
  if (!match) return date

  const [, year, month, day] = match
  return `${day}/${month}/${year}`
}
