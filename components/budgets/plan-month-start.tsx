import type { BudgetPlanDocument, PlanCalculation } from "@/lib/budget-plan"
import type { PlanOptions, PlanReceipt } from "@/lib/budget-plan-api"
import { formatPlanMoney as money, planDecimal } from "@/lib/budget-plan-view"
import { formatIsoDateOnly } from "@/lib/date-only"
import { decimal } from "@/lib/money"

import { PlanMonthStartActions, useMonthStart } from "./plan-month-start-actions"

export function PlanMonthStart({
  document,
  calculation,
  options,
  receipt,
  planId,
  revision,
  draftChanged,
}: {
  document: BudgetPlanDocument
  calculation: PlanCalculation
  options: PlanOptions
  receipt: PlanReceipt | null
  planId: string
  revision: number
  draftChanged: boolean
}) {
  const { data, unavailable, refresh, update } = useMonthStart(planId, revision)
  const fx = draftChanged ? null : data?.steps.find((step) => step.kind === "fx")?.evidence
  const executedRate = fx?.current && fx.rate !== null ? fx.rate : null
  const plan = calculation.issues.length === 0 ? calculation : null
  const accountLabel = (id: number | null, currency?: string) => {
    const account = options.accounts.find((item) => item.id === id)
    if (!account || (currency && account.currency !== currency)) return "Por confirmar"
    return `${account.name} · ${account.institutionName}`
  }
  const incomeAccount = accountLabel(document.incomeAccountId, "USD")
  const retainedAccount = accountLabel(document.retainedAccountId, "USD")
  const retainedUsd =
    plan?.net != null && plan.convertUsd != null
      ? planDecimal(plan.net).minus(planDecimal(plan.convertUsd)).toFixed()
      : null
  const calculatedLines = new Map(plan?.lines.map((line) => [line.id, line]))
  const confirmedLines = new Map(
    receipt?.transactions.map((transaction) => [transaction.lineId, transaction]),
  )
  const envelopes = new Map(options.envelopes.map((envelope) => [envelope.id, envelope]))
  const sourceIds = new Map(
    document.sources.map(({ accountId, envelopeId }) => [accountId, envelopeId]),
  )
  const destinationIds = new Set(document.lines.map((line) => line.targetEnvelopeId))
  const steps = document.lines.map((line) => {
    const result = calculatedLines.get(line.id)
    const transaction = confirmedLines.get(line.id)
    const target = envelopes.get(transaction?.targetEnvelopeId ?? line.targetEnvelopeId ?? 0)
    const destination = target?.currency === line.payCurrency ? target : undefined
    const sourceId = transaction?.sourceEnvelopeId ?? sourceIds.get(destination?.accountId ?? 0)
    const source = envelopes.get(sourceId ?? 0)
    const eligibleSource =
      source && source.accountId === destination?.accountId && !destinationIds.has(source.id)
    const account = accountLabel(transaction?.accountId ?? destination?.accountId ?? null)
    return {
      line,
      transaction,
      destination,
      account,
      targetName:
        destination?.categoryName ??
        (transaction ? `Sobre #${transaction.targetEnvelopeId}` : "Por confirmar"),
      sourceName:
        transaction || eligibleSource
          ? (source?.categoryName ?? `Sobre #${sourceId}`)
          : "Por confirmar",
      amount: transaction?.amount ?? result?.payAmount ?? null,
      status: transaction
        ? "Confirmado"
        : result && destination && eligibleSource
          ? "Previsto"
          : "Pendiente",
    }
  })
  const crcSteps = steps.filter((step) => step.line.payCurrency === "CRC")
  const eligibleCrcSteps = crcSteps.filter((step) => step.destination || step.transaction)
  const crcToEnvelopes =
    plan && (crcSteps.length === 0 || eligibleCrcSteps.length > 0)
      ? eligibleCrcSteps
          .reduce((total, step) => total.plus(step.amount ?? "0"), decimal(0))
          .toFixed()
      : null
  const hasConversion = plan?.convertUsd != null && planDecimal(plan.convertUsd).gt(0)

  return (
    <section
      aria-labelledby="plan-month-start-title"
      className="mb-6 min-w-0 space-y-5 rounded-2xl border bg-card p-4 sm:p-5"
    >
      <div>
        <h2 id="plan-month-start-title" className="text-xl font-semibold tracking-tight">
          Inicio de mes
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Revisa cuánto convertir, qué distribuir y cuánto conservar en dólares.
        </p>
      </div>
      <dl className="grid gap-x-6 gap-y-3 @sm:grid-cols-2 @3xl:grid-cols-3">
        {(
          [
            ["USD estimados por convertir", plan?.convertUsd ?? null, "USD"],
            ["CRC estimados por recibir", plan?.conversionCrc ?? null, "CRC"],
            ["USD a conservar", retainedUsd, "USD"],
            ["Compromisos y pagos en CRC", plan?.paymentsCrc ?? null, "CRC"],
            ["CRC a distribuir a sobres con destino", crcToEnvelopes, "CRC"],
            ["Colchón previsto en CRC", plan?.bufferCrc ?? null, "CRC"],
          ] as const
        ).map(([label, amount, currency]) => (
          <div key={label} className="min-w-0">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="font-semibold tabular-nums wrap-anywhere">{money(amount, currency)}</dd>
          </div>
        ))}
      </dl>
      <ol className="list-decimal space-y-4 border-t ps-5 pt-4 wrap-anywhere">
        <li>
          <h3 className="font-semibold">Conversión USD a CRC</h3>
          <p className="text-sm">
            {fx?.current
              ? "Confirmado"
              : fx
                ? "Por revisar"
                : hasConversion && incomeAccount !== "Por confirmar"
                  ? "Por verificar"
                  : plan?.convertUsd === "0"
                    ? "Sin conversión prevista"
                    : "Pendiente"}
          </p>
          <p className="text-sm text-muted-foreground">
            Origen del ingreso · {incomeAccount}. Cuenta de abono en CRC ·{" "}
            {fx?.current && fx.movements[1]
              ? (fx.movements[1].accountName ?? `Cuenta #${fx.movements[1].accountId}`)
              : "Por confirmar"}
            .
          </p>
          {fx?.current && fx.movements[1] && (
            <p className="text-sm">
              Conversión registrada · {money(fx.movements[0].amount, "USD")} →{" "}
              {money(fx.movements[1].amount, "CRC")}.
            </p>
          )}
          <dl className="mt-2 grid gap-2 text-sm @sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Tasa de compra de planificación</dt>
              <dd>
                {money(plan?.buy ?? null, "CRC")}
                {plan?.buy &&
                  ` por USD · ${document.exchange.source} · ${formatIsoDateOnly(document.exchange.date)}`}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tasa ejecutada</dt>
              <dd>
                {executedRate !== null
                  ? `${Number(executedRate).toLocaleString("es-CR", { maximumFractionDigits: 6 })} CRC por USD`
                  : plan?.convertUsd === "0"
                    ? "No aplica"
                    : "Por verificar"}
              </dd>
            </div>
          </dl>
        </li>
        <li>
          <h3 className="font-semibold">Pagos y distribución</h3>
          <p className="text-sm text-muted-foreground">
            Los importes a sobres forman parte de los compromisos. Los pagos externos quedan por
            verificar.
          </p>
          {steps.length > 0 && (
            <ul className="mt-2 divide-y text-sm">
              {steps.map(
                ({ line, transaction, account, targetName, sourceName, amount, status }) => (
                  <li key={line.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
                    <div className="min-w-0">
                      <p className="font-medium">{line.name || "Asignación sin nombre"}</p>
                      <p className="text-muted-foreground">
                        {account} · Origen: {sourceName} · Destino: {targetName}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold tabular-nums">
                        {money(amount, line.payCurrency)}
                      </p>
                      <p className="text-muted-foreground">
                        {status}
                        {transaction && ` · Movimiento ${transaction.transactionId}`}
                      </p>
                    </div>
                  </li>
                ),
              )}
            </ul>
          )}
        </li>
        <li>
          <h3 className="font-semibold">Conservar en USD</h3>
          <p className="text-sm">
            {retainedUsd !== null && retainedAccount !== "Por confirmar" ? "Previsto" : "Pendiente"}
            {" · "}
            {retainedAccount}
          </p>
          <dl className="mt-2 grid gap-2 text-sm @sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Comprometidos en USD</dt>
              <dd>{money(plan?.paymentsUsd ?? null)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Libres del plan</dt>
              <dd>{money(plan?.free ?? null)}</dd>
            </div>
          </dl>
        </li>
      </ol>
      {data && (
        <PlanMonthStartActions
          key={data.revision}
          data={data}
          options={options}
          dirty={draftChanged}
          refresh={refresh}
          update={update}
          expectedCredit={plan?.conversionCrc ?? null}
        />
      )}
      {unavailable && (
        <p className="text-sm text-muted-foreground">
          Los vínculos de inicio de mes no están disponibles.{" "}
          <button type="button" className="text-primary underline" onClick={refresh}>
            Volver a consultar
          </button>
        </p>
      )}
    </section>
  )
}
