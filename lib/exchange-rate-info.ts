import type { DashboardExchangeRate } from "@/lib/dashboard-api"
import { formatIsoDateOnly, getAccountingDate } from "@/lib/date-only"

// Provider used by ExchangeRateService.getByDate; do not attribute it directly to a bank.
export const EXCHANGE_RATE_SOURCE = "tipodecambio.paginasweb.cr"

export function exchangeRateInfo(rate: DashboardExchangeRate | null, today = getAccountingDate()) {
  const raw = typeof rate?.fecha === "string" ? rate.fecha.trim() : ""
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  const local = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw)
  const date = iso ? raw : local ? `${local[3]}-${local[2]}-${local[1]}` : null
  const timestamp = date ? Date.parse(date + "T00:00:00Z") : NaN
  const validDate =
    Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date
  const age = validDate
    ? Math.round((Date.parse(today + "T00:00:00Z") - timestamp) / 86400000)
    : null
  return {
    date: validDate ? formatIsoDateOnly(date!) : "Fecha sin confirmar",
    ageInDays: age,
    ageLabel:
      age === null
        ? "Antigüedad sin confirmar"
        : age < 0
          ? "Fecha posterior a la consulta"
          : age === 0
            ? "Cotización del día"
            : age === 1
              ? "Hace 1 día"
              : `Hace ${age} días`,
    source: EXCHANGE_RATE_SOURCE,
    usable:
      rate !== null &&
      age !== null &&
      age >= 0 &&
      Number.isFinite(rate.compra) &&
      rate.compra > 0 &&
      Number.isFinite(rate.venta) &&
      rate.venta > 0,
  }
}
