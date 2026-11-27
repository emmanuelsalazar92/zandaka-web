"use client"

import { RefreshCw } from "lucide-react"
import * as React from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { EmptyState, Feedback, LoadingState } from "@/components/ui/feedback"
import { formatAccountingTimestamp, formatIsoDateOnly } from "@/lib/date-only"
import { decimal } from "@/lib/money"
import {
  getProjectAnalysis,
  ProjectRequestError,
  type Project,
  type ProjectAnalysis,
  type ProjectBreakdownFilter,
  type ProjectCurrencyAnalysis,
} from "@/lib/project-api"
import { formatProjectAmount } from "@/lib/project-money"
import { useProjectRead } from "@/lib/use-project-read"

const curve = { value: { label: "Costo acumulado", color: "var(--primary)" } }
const compact = new Intl.NumberFormat("es-CR", { notation: "compact", maximumFractionDigits: 1 })
const amountCell = "px-2 py-2 text-right tabular-nums [overflow-wrap:anywhere]"

function CurrencyCurve({ data }: { data: ProjectCurrencyAnalysis }) {
  const { currency, series } = data
  const points = series.map(({ date, net }) => ({ date, exact: net, value: Number(net) }))
  return (
    <section aria-label={`Evolución en ${currency}`} className="min-w-0 space-y-3">
      <h3 className="font-semibold">Evolución del costo</h3>
      <ChartContainer
        config={curve}
        className="focus-within:ring-ring h-52 w-full min-w-0 rounded-lg focus-within:ring-2"
      >
        <LineChart
          data={points}
          title={`Costo acumulado en ${currency}`}
          margin={{ left: 4, right: 14, top: 8 }}
        >
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tickFormatter={(date: string) => formatIsoDateOnly(date).slice(0, 5)}
            minTickGap={24}
          />
          <YAxis width={46} tickFormatter={(value: number) => compact.format(value)} />
          <ChartTooltip
            isAnimationActive={false}
            content={
              <ChartTooltipContent
                labelFormatter={(label) => formatIsoDateOnly(String(label))}
                formatter={(_value, _name, item) => (
                  <span className="font-medium tabular-nums">
                    {formatProjectAmount(String(item.payload.exact), currency)}
                  </span>
                )}
              />
            }
          />
          <Line
            dataKey="value"
            name="Costo acumulado"
            stroke="var(--color-value)"
            type="stepAfter"
            strokeWidth={3}
            isAnimationActive={false}
            dot={points.length === 1 ? { r: 4 } : false}
          />
        </LineChart>
      </ChartContainer>
      <details className="rounded-lg border px-3">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">
          Ver tabla de evolución
        </summary>
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">Costo acumulado por día en {currency}</caption>
          <thead>
            <tr>
              <th scope="col" className="py-2 text-left">
                Fecha
              </th>
              <th scope="col" className={amountCell}>
                Costo acumulado
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {series.map(({ date, net }) => (
              <tr key={date}>
                <th scope="row" className="py-2 text-left font-normal">
                  {formatIsoDateOnly(date)}
                </th>
                <td className={amountCell}>{formatProjectAmount(net, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}

function CategoryBreakdown({
  data,
  filter,
  onSelect,
  movementHeadingId,
}: {
  data: ProjectCurrencyAnalysis
  filter?: ProjectBreakdownFilter
  onSelect: (filter?: ProjectBreakdownFilter) => void
  movementHeadingId: string
}) {
  const { currency, categories } = data
  const max = decimal(categories[0]?.expenses ?? "0")
  return (
    <section className="min-w-0 space-y-2" aria-label={`Categorías en ${currency}`}>
      <h3 className="font-semibold">Gasto por categoría</h3>
      <p className="text-sm text-muted-foreground">
        Abre una categoría para ver los movimientos que la componen.
      </p>
      <div
        className="overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Desglose por categoría"
      >
        <table className="w-full text-sm">
          <caption className="sr-only">
            Gastos, reembolsos y costo neto por categoría en {currency}
          </caption>
          <thead className="text-muted-foreground">
            <tr>
              <th scope="col" className="py-2 text-left">
                Categoría
              </th>
              <th scope="col" className={amountCell}>
                Gastos
              </th>
              <th scope="col" className={amountCell}>
                Reembolsos
              </th>
              <th scope="col" className={amountCell}>
                Neto
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y border-t">
            {categories.map(({ categoryId, categoryName, expenses, refunds, net }) => {
              const label = categoryName ?? "Sin categoría"
              const selected = filter?.currency === currency && filter.categoryId === categoryId
              const percent = max.isZero() ? 0 : decimal(expenses).div(max).mul(100).toNumber()
              return (
                <tr key={categoryId ?? "none"}>
                  <th scope="row" className="min-w-24 py-1 pr-2 text-left sm:w-2/5">
                    <button
                      type="button"
                      aria-controls={movementHeadingId}
                      aria-pressed={selected}
                      className="hover:bg-muted aria-pressed:bg-accent focus-visible:ring-ring flex min-h-11 w-full flex-col justify-center gap-1 rounded-md px-2 py-1 text-left focus-visible:ring-2 focus-visible:outline-none"
                      onClick={() =>
                        onSelect(selected ? undefined : { categoryId, currency, label })
                      }
                    >
                      <span className="wrap-anywhere">{label}</span>
                      <span
                        aria-hidden="true"
                        className="block h-1.5 w-full overflow-hidden rounded-full bg-muted"
                      >
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${percent}%` }}
                        />
                      </span>
                    </button>
                  </th>
                  <td className={amountCell}>{formatProjectAmount(expenses, currency)}</td>
                  <td className={amountCell}>{formatProjectAmount(refunds, currency)}</td>
                  <td className={amountCell}>{formatProjectAmount(net, currency)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function totalsKey(data: ProjectAnalysis) {
  return JSON.stringify(
    data.currencies.map(({ currency, expenses, refunds }) => [currency, expenses, refunds]),
  )
}

export function ProjectAnalysisPanel({
  project,
  filter,
  onSelect,
  movementHeadingId,
}: {
  project: Project
  filter?: ProjectBreakdownFilter
  onSelect: (filter?: ProjectBreakdownFilter) => void
  movementHeadingId: string
}) {
  const [currency, setCurrency] = React.useState<string>()
  const [previous, setPrevious] = React.useState<{ revision: number; totals: string }>()
  const headingId = React.useId()
  const load = React.useCallback(
    (signal: AbortSignal) => getProjectAnalysis(project.id, signal),
    [project.id],
  )
  const { result, retry } = useProjectRead(load, project.revision)
  const data = result?.data
  const active = data?.currencies.find((item) => item.currency === currency) ?? data?.currencies[0]
  const totalsChanged =
    data && previous?.revision === data.project.revision && previous.totals !== totalsKey(data)
  const revisedAfterClose =
    data?.project.finalizedAt &&
    data.latestLedgerUpdateAt &&
    Date.parse(data.latestLedgerUpdateAt) > Date.parse(data.project.finalizedAt)
  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="text-lg font-semibold">
          Costo del proyecto
        </h2>
        {data && (
          <Button
            variant="ghost"
            onClick={() => {
              setPrevious({ revision: data.project.revision, totals: totalsKey(data) })
              retry()
            }}
          >
            <RefreshCw aria-hidden="true" />
            Actualizar costo
          </Button>
        )}
      </div>
      {!result && <LoadingState>Calculando costo…</LoadingState>}
      {result &&
        "error" in result &&
        (result.error instanceof ProjectRequestError &&
        result.error.code === "FEATURE_NOT_READY" ? (
          <Feedback title="Costo aún no disponible">
            Este entorno necesita preparar los vínculos de Proyectos.
          </Feedback>
        ) : (
          <Feedback
            tone="error"
            title="No pudimos calcular el costo"
            action={
              <Button variant="outline" onClick={retry}>
                Reintentar cálculo
              </Button>
            }
          >
            Intenta consultar el libro de nuevo.
          </Feedback>
        ))}
      {data && (
        <>
          <p className="text-sm text-muted-foreground">
            Calculado el {formatAccountingTimestamp(data.calculatedAt)} con los importes vigentes
            del libro.
          </p>
          {totalsChanged && <Feedback title="Las cifras cambiaron desde la consulta anterior" />}
          {revisedAfterClose && (
            <Feedback title="Hay movimientos actualizados después del cierre">
              El costo refleja los importes actuales del libro.
            </Feedback>
          )}
          {data.excludedLineCount > 0 && (
            <Feedback title="Hay líneas que ya no computan en el costo">
              Revísalas en Movimientos vinculados.
            </Feedback>
          )}
          {(!active || data.currencies.length > 1) && (
            <table className="w-full text-sm">
              <caption className="sr-only">Costo por moneda</caption>
              <thead className={active ? "text-muted-foreground" : "sr-only"}>
                <tr>
                  <th scope="col" className="py-2 text-left">
                    Moneda
                  </th>
                  <th scope="col" className={amountCell}>
                    Gastos
                  </th>
                  <th scope="col" className={amountCell}>
                    Reembolsos
                  </th>
                  <th scope="col" className={amountCell}>
                    Neto
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {data.currencies.map((item) => (
                  <tr key={item.currency}>
                    <th scope="row" className="py-2 text-left">
                      {item.currency}
                    </th>
                    <td className={amountCell}>
                      {formatProjectAmount(item.expenses, item.currency)}
                    </td>
                    <td className={amountCell}>
                      {formatProjectAmount(item.refunds, item.currency)}
                    </td>
                    <td className={amountCell}>{formatProjectAmount(item.net, item.currency)}</td>
                  </tr>
                ))}
                {!active && (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState title="Sin movimientos que computen">
                        Los gastos y reembolsos vinculados aparecerán aquí.
                      </EmptyState>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          {active && (
            <>
              {data.currencies.length > 1 && (
                <div
                  role="group"
                  aria-label="Moneda para los gráficos"
                  className="flex flex-wrap gap-2"
                >
                  {data.currencies.map((item) => (
                    <Button
                      key={item.currency}
                      aria-pressed={item.currency === active.currency}
                      variant={item.currency === active.currency ? "default" : "outline"}
                      onClick={() => {
                        setCurrency(item.currency)
                        if (filter && filter.currency !== item.currency) onSelect()
                      }}
                    >
                      {item.currency}
                    </Button>
                  ))}
                </div>
              )}
              <div className="atlantic-hero rounded-2xl p-5 sm:p-7">
                <p className="hero-caption text-sm">Costo neto · {active.currency}</p>
                <p className="hero-amount wrap-anywhere mt-1 text-3xl font-semibold tabular-nums sm:text-4xl">
                  {formatProjectAmount(active.net, active.currency)}
                </p>
                <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
                  <div>
                    <dt className="hero-caption text-sm">Gastos</dt>
                    <dd className="tabular-nums">
                      {formatProjectAmount(active.expenses, active.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="hero-caption text-sm">Reembolsos</dt>
                    <dd className="tabular-nums">
                      {formatProjectAmount(active.refunds, active.currency)}
                    </dd>
                  </div>
                </dl>
              </div>
              <CurrencyCurve data={active} />
              <CategoryBreakdown
                data={active}
                filter={filter}
                onSelect={onSelect}
                movementHeadingId={movementHeadingId}
              />
            </>
          )}
        </>
      )}
    </section>
  )
}
