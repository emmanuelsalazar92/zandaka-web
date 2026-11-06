"use client"

import { ArrowLeft, ArrowRight, CalendarDays, Check, Copy, Mail, Plus, Save } from "lucide-react"
import Link from "next/link"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Feedback, LoadingState } from "@/components/ui/feedback"
import { Input } from "@/components/ui/input"
import { calculateBudgetPlan, type BudgetPlanDocument, type PlanLine } from "@/lib/budget-plan"
import { planDocumentSchema, planRequest, type FundingPreview } from "@/lib/budget-plan-api"
import { formatPlanMoney as money } from "@/lib/budget-plan-view"
import { formatIsoDateOnly, getAccountingDate } from "@/lib/date-only"
import { decimal } from "@/lib/money"
import { secureUuid } from "@/lib/uuid"

import { AmountField, PlanField } from "./plan-fields"
import { PlanLineEditor } from "./plan-line-editor"
import { planMonth } from "./plan-list"
import styles from "./plan.module.css"
import { useBudgetPlan } from "./use-budget-plan"

type Tab = "plan" | "income" | "exchange" | "apply"
const tabs: Array<[Tab, string]> = [
  ["plan", "Plan del mes"],
  ["income", "Ingreso"],
  ["exchange", "Tipo de cambio"],
  ["apply", "Revisar sobres"],
]
const percent = (value: string | null, net: string | null) => {
  if (value === null || net === null || decimal(net).lte(0)) return "Por confirmar"
  return `${decimal(value).div(net).mul(100).toFixed(2)} %`
}
const progress = (used: string | null, cap: string | null) => {
  if (used === null || cap === null || decimal(cap).lte(0)) return 0
  return Math.max(0, Math.min(100, decimal(used).div(cap).mul(100).toNumber()))
}

export function BudgetPlanWorkspace({ planId }: { planId: string }) {
  const plan = useBudgetPlan(planId)
  const [tab, setTab] = React.useState<Tab>(planId === "new" ? "income" : "plan"),
    [editing, setEditing] = React.useState<PlanLine | null>(null),
    [preview, setPreview] = React.useState<FundingPreview | null>(null),
    [checking, setChecking] = React.useState(false),
    [confirm, setConfirm] = React.useState(false),
    [copying, setCopying] = React.useState(false),
    [copyConfirm, setCopyConfirm] = React.useState(false),
    [postDate, setPostDate] = React.useState(getAccountingDate())
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const doc = plan.document,
    calculation = React.useMemo(() => (doc ? calculateBudgetPlan(doc) : null), [doc])
  const locked = plan.locked || checking || copying
  const patch = (value: Partial<BudgetPlanDocument>) => {
    if (!doc || locked) return
    setPreview(null)
    plan.setDocument({ ...doc, ...value })
    plan.setError(null)
  }
  const changeIncome = (field: keyof BudgetPlanDocument["income"], value: string) => {
    if (doc) patch({ income: { ...doc.income, [field]: value } })
  }
  const changeExchange = (field: keyof BudgetPlanDocument["exchange"], value: string) => {
    if (doc) patch({ exchange: { ...doc.exchange, [field]: value } })
  }
  const showTab = (next: Tab) => setTab(next)
  const add = () => {
    if (locked) return
    setEditing({
      id: secureUuid(),
      name: "",
      group: 30,
      kind: "fixed",
      currency: "CRC",
      payCurrency: "CRC",
      amount: "",
      iva: "13",
      roundUsd: "up",
      targetEnvelopeId: null,
    })
  }
  const checkFunds = async () => {
    if (!plan.saved || plan.dirty || plan.busy) return
    setChecking(true)
    plan.setError(null)
    try {
      const result = await planRequest<FundingPreview>(`/${plan.id}/funding-preview`)
      if (!Array.isArray(result.transfers) || !Array.isArray(result.sources))
        throw new Error("No pudimos verificar los fondos.")
      setPreview(result)
    } catch (cause) {
      setPreview(null)
      plan.setError(cause instanceof Error ? cause.message : "No pudimos verificar los fondos.")
    } finally {
      setChecking(false)
    }
  }
  const copyPrevious = async () => {
    if (!plan.saved || plan.dirty || locked) return
    setCopying(true)
    plan.setError(null)
    try {
      const result = await planRequest<{ document: BudgetPlanDocument }>(
        `/${plan.id}/previous-assignments`,
      )
      const copied = planDocumentSchema.parse(result.document)
      patch({ lines: copied.lines, sources: copied.sources })
      setCopyConfirm(false)
    } catch (cause) {
      plan.setError(
        cause instanceof Error ? cause.message : "No encontramos asignaciones anteriores.",
      )
    } finally {
      setCopying(false)
    }
  }
  if (plan.loading) return <LoadingState>Preparando tu presupuesto…</LoadingState>
  if (!doc || !calculation)
    return (
      <Feedback tone="error" title="Presupuesto no disponible">
        <p>{plan.error ?? "No encontramos este plan."}</p>
        <div className={styles.actions}>
          <Button onClick={plan.reload}>Volver a intentar</Button>
          <Button asChild variant="outline">
            <Link href="/budgets">Volver a presupuestos</Link>
          </Button>
        </div>
      </Feedback>
    )
  const c = calculation,
    saved = plan.saved,
    status = saved?.status ?? "draft"
  const destinationAccounts = [
    ...new Set(
      doc.lines
        .map((l) => plan.options.envelopes.find((e) => e.id === l.targetEnvelopeId)?.accountId)
        .filter((id): id is number => id !== undefined),
    ),
  ]
  const retained = plan.options.accounts.find((a) => a.id === doc.retainedAccountId)
  const savedLabel =
    status === "funded"
      ? "Asignado a sobres"
      : status === "finalized"
        ? "Preparado"
        : plan.dirty
          ? "Cambios sin guardar"
          : "Borrador guardado"
  const recoveryControls = plan.pending ? (
    <div className={styles.actions}>
      <Button disabled={plan.busy} variant="outline" onClick={plan.reload}>
        Consultar resultado
      </Button>
      <Button disabled={plan.busy} onClick={plan.retry}>
        Reintentar el mismo intento
      </Button>
    </div>
  ) : null
  const errors =
    plan.error && !confirm ? (
      <Feedback
        tone="error"
        title={plan.pending ? "Resultado por confirmar" : "No se completó la operación"}
      >
        <p>{plan.error}</p>
        {recoveryControls}
        {!plan.pending && (
          <Button variant="outline" onClick={plan.reload}>
            Actualizar y revisar
          </Button>
        )}
      </Feedback>
    ) : null
  return (
    <div className={`marea-surface ${styles.page}`}>
      <div className={styles.heading}>
        <div>
          <Link
            href="/budgets"
            className="inline-flex min-h-11 items-center gap-2 text-sm text-primary"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Presupuestos
          </Link>
          <h1>Presupuesto de {planMonth(doc.month)}</h1>
          <p>
            {doc.incomeMonth
              ? `Ingreso de ${planMonth(doc.incomeMonth)}`
              : "Elige el mes del ingreso"}{" "}
            · Aplicación desde {formatIsoDateOnly(`${doc.month}-01`)}
          </p>
        </div>
        <div className={styles.headingActions}>
          <span className={styles.status}>{savedLabel}</span>
          {status === "draft" && (
            <Button onClick={() => plan.act("save")} disabled={locked || !plan.dirty}>
              <Save aria-hidden="true" className="mr-2 size-4" />
              {plan.busy ? "Guardando…" : "Guardar borrador"}
            </Button>
          )}
          {status === "finalized" && (
            <Button
              variant="outline"
              disabled={plan.busy || !!plan.pending}
              onClick={() => plan.act("reopen")}
            >
              Volver a borrador
            </Button>
          )}
        </div>
      </div>
      {errors}
      {plan.storageError && (
        <Feedback tone="warning" title="Recuperación de pestaña no disponible">
          Habilita el almacenamiento del navegador para conservar tus cambios y los intentos antes
          de enviarlos.
        </Feedback>
      )}
      {plan.recovery && (
        <Feedback tone="warning" title="El presupuesto cambió en otra sesión">
          <p>
            Conservamos tus cambios locales, pero no reemplazamos la versión guardada. Revisa la
            versión actual antes de recuperarlos.
          </p>
          <div className={styles.actions}>
            {status === "draft" && (
              <Button onClick={plan.recover}>Recuperar mis cambios como borrador</Button>
            )}
            <Button variant="outline" onClick={plan.discardRecovery}>
              Usar la versión guardada
            </Button>
          </div>
        </Feedback>
      )}
      <section className={styles.hero} aria-label="Resumen del presupuesto">
        <div className={styles.heroTop}>
          <div>
            <span className={styles.heroLabel}>Disponible para {planMonth(doc.month)}</span>
            <div className={styles.heroAmount}>{money(c.net)}</div>
            <div className={styles.heroStatus}>
              <Check aria-hidden="true" className="size-4" />
              <span>
                {doc.incomeMode === "net"
                  ? "Ingreso neto declarado"
                  : c.incomeDifference !== null && decimal(c.incomeDifference).isZero()
                    ? "Ingreso conciliado"
                    : "Ingreso por conciliar"}
              </span>
            </div>
          </div>
          <div className={styles.heroSplit}>
            <div>
              <span>Asignarás a tus sobres</span>
              <strong>{money(c.assigned)}</strong>
            </div>
            <div>
              <span>Conservarás en USD</span>
              <strong>{money(c.free)}</strong>
            </div>
          </div>
        </div>
        <div className={styles.heroTrack} aria-hidden="true">
          <div style={{ width: `${progress(c.assigned, c.net)}%` }} />
        </div>
        <div className={styles.heroCaption}>
          <span>{percent(c.assigned, c.net)} asignado</span>
          <span>{percent(c.free, c.net)} libre en USD</span>
        </div>
      </section>
      <div className={styles.tabs} role="tablist" aria-label="Preparación del presupuesto">
        {tabs.map(([value, label], index) => (
          <button
            key={value}
            ref={(element) => {
              tabRefs.current[index] = element
            }}
            type="button"
            id={`plan-tab-${value}`}
            role="tab"
            aria-selected={tab === value}
            aria-controls={`plan-panel-${value}`}
            tabIndex={tab === value ? 0 : -1}
            onClick={() => showTab(value)}
            onKeyDown={(event) => {
              if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
                event.preventDefault()
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? tabs.length - 1
                      : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length
                setTab(tabs[next][0])
                tabRefs.current[next]?.focus()
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={styles.content}>
        <div className={styles.workspace}>
          <section
            role="tabpanel"
            id="plan-panel-plan"
            aria-labelledby="plan-tab-plan"
            hidden={tab !== "plan"}
          >
            <div className={styles.sectionTitle}>
              <h2>Tu distribución</h2>
              <span>Referencia 50 / 30 / 20</span>
            </div>
            {doc.lines.length === 0 ? (
              <div className={styles.empty}>
                <Mail aria-hidden="true" />
                <h2>Da un destino a tu dinero</h2>
                <p>
                  Cada asignación puede nacer en USD o CRC, ser un importe fijo, un porcentaje del
                  neto o una suscripción.
                </p>
                <div className={styles.actions}>
                  <Button onClick={add} disabled={locked}>
                    Añadir asignación
                  </Button>
                  <Button variant="outline" onClick={() => setTab("income")}>
                    Revisar ingreso
                  </Button>
                </div>
              </div>
            ) : (
              ([50, 30, 20] as const).map((group) => {
                const summary = c.groups.find((g) => g.group === group)
                return (
                  <section key={group} className={styles.group} aria-label={`Grupo ${group}`}>
                    <div className={styles.groupHeader}>
                      <h3>Grupo {group}</h3>
                      <span>
                        {group} % ·{" "}
                        {money(
                          summary?.cap ??
                            (c.net === null ? null : decimal(c.net).mul(group).div(100).toFixed()),
                        )}
                      </span>
                    </div>
                    <div className={styles.groupTrack} aria-hidden="true">
                      <div
                        style={{
                          width: `${progress(summary?.assigned ?? null, summary?.cap ?? null)}%`,
                        }}
                      />
                    </div>
                    {doc.lines
                      .filter((line) => line.group === group)
                      .map((line) => {
                        const result = c.lines.find((r) => r.id === line.id),
                          target = plan.options.envelopes.find(
                            (e) => e.id === line.targetEnvelopeId,
                          )
                        return (
                          <button
                            type="button"
                            className={styles.row}
                            key={line.id}
                            onClick={() => setEditing(line)}
                            disabled={locked}
                            aria-label={`Editar ${line.name}`}
                          >
                            <span className={styles.rowIcon}>
                              <Mail aria-hidden="true" className="size-4" />
                            </span>
                            <span className={styles.rowName}>
                              <strong>{line.name}</strong>
                              <small>
                                {line.kind === "percent"
                                  ? `${line.amount} % del neto USD`
                                  : line.kind === "subscription"
                                    ? `${money(line.amount, line.currency)} + impuesto`
                                    : money(line.amount || null, line.currency)}{" "}
                                ·{" "}
                                {target
                                  ? `${target.accountName} · ${target.currency}`
                                  : "Destino por elegir"}
                              </small>
                            </span>
                            <span className={styles.rowAmount}>
                              <strong>{money(result?.payAmount ?? null, line.payCurrency)}</strong>
                              <small>Reserva {money(result?.reserveUsd ?? null)}</small>
                            </span>
                            <ArrowRight aria-hidden="true" className="size-3 shrink-0" />
                          </button>
                        )
                      })}
                    <div className={styles.groupFooter}>
                      <span>Asignado {money(summary?.assigned ?? null)}</span>
                      <strong
                        className={summary && decimal(summary.free).lt(0) ? styles.over : undefined}
                      >
                        {summary && decimal(summary.free).lt(0) ? "Sobre referencia" : "Libre"}{" "}
                        {money(summary?.free ?? null)}
                      </strong>
                    </div>
                  </section>
                )
              })
            )}
            {doc.lines.length > 0 && (
              <Button variant="ghost" onClick={add} disabled={locked || doc.lines.length >= 200}>
                <Plus aria-hidden="true" className="mr-2 size-4" />
                Añadir asignación
              </Button>
            )}
            <div className={styles.actions}>
              <Button
                variant="outline"
                disabled={locked || !saved || plan.dirty}
                onClick={() => setCopyConfirm(true)}
              >
                <Copy aria-hidden="true" className="mr-2 size-4" />
                Copiar asignaciones anteriores
              </Button>
            </div>
            <p className={styles.note}>
              El 50/30/20 es una referencia. Los libres permanecen separados de los importes que se
              asignarán. Guarda el borrador antes de copiar asignaciones.
            </p>
          </section>
          <section
            role="tabpanel"
            id="plan-panel-income"
            aria-labelledby="plan-tab-income"
            hidden={tab !== "income"}
          >
            <div className={styles.sectionTitle}>
              <h2>El ingreso que financiará el mes</h2>
            </div>
            <p className={styles.panelLead}>
              Puedes presupuestar un ingreso neto ya recibido o conciliar los importes de tus
              comprobantes.
            </p>
            <fieldset disabled={locked}>
              <div className={`${styles.fields} ${styles.two}`}>
                <PlanField label="Mes del presupuesto">
                  <Input
                    type="month"
                    value={doc.month}
                    min="2000-01"
                    max="2099-12"
                    onChange={(e) => {
                      if (e.target.value) patch({ month: e.target.value })
                    }}
                  />
                </PlanField>
                <PlanField label="Mes en que recibiste el ingreso">
                  <Input
                    type="month"
                    value={doc.incomeMonth}
                    min="2000-01"
                    max={doc.month}
                    onChange={(e) => patch({ incomeMonth: e.target.value })}
                  />
                </PlanField>
              </div>
              <PlanField label="Forma de registrar el ingreso">
                <select
                  className={styles.select}
                  value={doc.incomeMode}
                  onChange={(e) =>
                    patch({ incomeMode: e.target.value as BudgetPlanDocument["incomeMode"] })
                  }
                >
                  <option value="net">Ingreso neto disponible</option>
                  <option value="receipts">Salario y comprobantes de pago</option>
                </select>
              </PlanField>
              {doc.incomeMode === "net" ? (
                <div className={styles.fields}>
                  <AmountField
                    label="Ingreso neto disponible · USD"
                    value={doc.income.net}
                    onChange={(value) => changeIncome("net", value)}
                    help="El dinero ya recibido. No se aplican deducciones nuevamente."
                  />
                </div>
              ) : (
                <>
                  <div className={styles.fields}>
                    <AmountField
                      label="Salario contractual · USD"
                      value={doc.income.gross}
                      onChange={(value) => changeIncome("gross", value)}
                    />
                    <AmountField
                      label="CCSS del comprobante · USD"
                      value={doc.income.ccss}
                      onChange={(value) => changeIncome("ccss", value)}
                    />
                    <AmountField
                      label="Renta retenida del mes · USD"
                      value={doc.income.tax}
                      onChange={(value) => changeIncome("tax", value)}
                      help="Suma las retenciones de tus comprobantes. No se estima la renta con la cotización del presupuesto."
                    />
                  </div>
                  <div className={styles.totalLine}>
                    <span>Neto disponible</span>
                    <strong>{money(c.net)}</strong>
                  </div>
                  <div className={`${styles.fields} ${styles.two}`}>
                    <AmountField
                      label="Primera quincena · USD"
                      value={doc.income.q1}
                      onChange={(value) => changeIncome("q1", value)}
                    />
                    <AmountField
                      label="Segunda quincena · USD"
                      value={doc.income.q2}
                      onChange={(value) => changeIncome("q2", value)}
                    />
                  </div>
                  <Feedback
                    tone={
                      c.incomeDifference !== null && decimal(c.incomeDifference).isZero()
                        ? "success"
                        : "warning"
                    }
                    title={
                      c.incomeDifference !== null && decimal(c.incomeDifference).isZero()
                        ? "El ingreso cuadra"
                        : "Ingreso por conciliar"
                    }
                  >
                    Diferencia {money(c.incomeDifference)}
                  </Feedback>
                </>
              )}
              <div className={styles.fields}>
                <PlanField label="Cuenta donde recibiste el ingreso">
                  <select
                    className={styles.select}
                    value={doc.incomeAccountId ?? ""}
                    onChange={(e) =>
                      patch({ incomeAccountId: e.target.value ? Number(e.target.value) : null })
                    }
                  >
                    <option value="">Por elegir</option>
                    {plan.options.accounts
                      .filter((a) => a.currency === "USD")
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} · {a.institutionName} · USD
                        </option>
                      ))}
                  </select>
                </PlanField>
                <PlanField label="Cuenta USD donde conservarás el libre">
                  <select
                    className={styles.select}
                    value={doc.retainedAccountId ?? ""}
                    onChange={(e) =>
                      patch({ retainedAccountId: e.target.value ? Number(e.target.value) : null })
                    }
                  >
                    <option value="">Por elegir</option>
                    {plan.options.accounts
                      .filter((a) => a.currency === "USD")
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} · {a.institutionName} · USD
                        </option>
                      ))}
                  </select>
                </PlanField>
              </div>
            </fieldset>
          </section>
          <section
            role="tabpanel"
            id="plan-panel-exchange"
            aria-labelledby="plan-tab-exchange"
            hidden={tab !== "exchange"}
          >
            <div className={styles.sectionTitle}>
              <h2>Un margen para planificar</h2>
            </div>
            <p className={styles.panelLead}>
              Usa las cotizaciones de tu banco. La fuente, fecha y margen quedan guardados con este
              presupuesto.
            </p>
            <fieldset disabled={locked}>
              <div className={`${styles.fields} ${styles.two}`}>
                <PlanField label="Fuente bancaria">
                  <Input
                    value={doc.exchange.source}
                    maxLength={100}
                    onChange={(e) => changeExchange("source", e.target.value)}
                  />
                </PlanField>
                <PlanField label="Fecha de referencia">
                  <Input
                    type="date"
                    value={doc.exchange.date}
                    onChange={(e) => changeExchange("date", e.target.value)}
                  />
                </PlanField>
                <AmountField
                  label="Compra · CRC por USD"
                  value={doc.exchange.buy}
                  onChange={(value) => changeExchange("buy", value)}
                  help="El banco compra tus dólares; recibes colones."
                />
                <AmountField
                  label="Venta · CRC por USD"
                  value={doc.exchange.sell}
                  onChange={(value) => changeExchange("sell", value)}
                  help="El banco vende dólares; entregas colones."
                />
                <AmountField
                  label="Margen de planificación · %"
                  value={doc.exchange.margin}
                  onChange={(value) => changeExchange("margin", value)}
                />
              </div>
            </fieldset>
            <div className={styles.rateResults}>
              <div>
                <span>USD → CRC</span>
                <strong>{money(c.buy, "CRC")}</strong>
                <small>Compra − margen · redondeo inferior</small>
              </div>
              <div>
                <span>CRC → USD</span>
                <strong>{money(c.sell, "CRC")}</strong>
                <small>Venta + margen · redondeo superior</small>
              </div>
            </div>
            <p className={styles.note}>
              Son tasas presupuestarias. Las conversiones bancarias efectivas se registran por
              separado con su tasa real. La cotización de la API no reemplaza estos valores.
            </p>
          </section>
          <section
            role="tabpanel"
            id="plan-panel-apply"
            aria-labelledby="plan-tab-apply"
            hidden={tab !== "apply"}
          >
            <div className={styles.sectionTitle}>
              <h2>
                {status === "funded" ? "Asignaciones confirmadas" : "Así se repartirá el mes"}
              </h2>
            </div>
            {saved?.receipt ? (
              <Feedback tone="success" title="Presupuesto asignado">
                <p>
                  Fecha contable: {formatIsoDateOnly(saved.receipt.date)}. Las transferencias se
                  confirmaron juntas.
                </p>
                <ul className={styles.reviewResult}>
                  {saved.receipt.transactions.map((t) => (
                    <li key={t.transactionId}>
                      <Link href={`/transactions?accountId=${t.accountId}`}>
                        Movimiento {t.transactionId}
                      </Link>{" "}
                      · {money(t.amount, t.currency)}
                    </li>
                  ))}
                </ul>
              </Feedback>
            ) : (
              <>
                <p className={styles.panelLead}>
                  Antes de asignar, registra las conversiones y traslados que hayas realizado. Aquí
                  distribuirás fondos existentes entre sobres de la misma cuenta y moneda.
                </p>
                <fieldset disabled={locked}>
                  {destinationAccounts.map((accountId) => {
                    const account = plan.options.accounts.find((a) => a.id === accountId),
                      assignments = doc.lines.filter(
                        (l) =>
                          plan.options.envelopes.find((e) => e.id === l.targetEnvelopeId)
                            ?.accountId === accountId,
                      ),
                      destinations = new Set(doc.lines.map((l) => l.targetEnvelopeId))
                    return (
                      <section className={styles.accountBlock} key={accountId}>
                        <h3>
                          {account?.name} · {account?.institutionName} · {account?.currency}
                        </h3>
                        <PlanField
                          label={`Sobre con los fondos disponibles · ${account?.name}`}
                          help="Su saldo se redistribuirá; el total de esta cuenta se conserva."
                        >
                          <select
                            className={styles.select}
                            value={
                              doc.sources.find((s) => s.accountId === accountId)?.envelopeId ?? ""
                            }
                            onChange={(e) =>
                              patch({
                                sources: [
                                  ...doc.sources.filter((s) => s.accountId !== accountId),
                                  ...(e.target.value
                                    ? [{ accountId, envelopeId: Number(e.target.value) }]
                                    : []),
                                ],
                              })
                            }
                          >
                            <option value="">Elige el sobre de origen</option>
                            {plan.options.envelopes
                              .filter((e) => e.accountId === accountId && !destinations.has(e.id))
                              .map((e) => (
                                <option key={e.id} value={e.id}>
                                  {e.categoryName} · Saldo {money(String(e.balance), e.currency)}
                                </option>
                              ))}
                          </select>
                        </PlanField>
                        {assignments.map((line) => {
                          const value = c.lines.find((r) => r.id === line.id)
                          return (
                            <div key={line.id} className={styles.reviewLine}>
                              <span>{line.name}</span>
                              <span>{money(value?.payAmount ?? null, line.payCurrency)}</span>
                            </div>
                          )
                        })}
                      </section>
                    )
                  })}
                </fieldset>
                {doc.lines.some((l) => l.targetEnvelopeId === null) && (
                  <Feedback tone="warning" title="Faltan destinos">
                    Abre cada asignación en Plan del mes y elige su sobre de destino.
                  </Feedback>
                )}
                <div className={styles.keep}>
                  <strong>{money(c.free)}</strong>
                  <span>
                    Libres en{" "}
                    {retained
                      ? `${retained.name} · ${retained.institutionName} · USD`
                      : "una cuenta USD por elegir"}
                    . No se convierten ni se distribuyen automáticamente.
                  </span>
                </div>
                <div className={styles.actions}>
                  <Button
                    variant="outline"
                    disabled={
                      !saved ||
                      plan.dirty ||
                      plan.busy ||
                      !!plan.pending ||
                      !!plan.recovery ||
                      checking ||
                      copying
                    }
                    onClick={checkFunds}
                  >
                    {checking ? "Verificando…" : "Verificar fondos guardados"}
                  </Button>
                  {status === "draft" && (
                    <Button
                      disabled={!saved || plan.dirty || locked || c.issues.length > 0 || !preview}
                      onClick={() => plan.act("finalize")}
                    >
                      Preparar presupuesto
                    </Button>
                  )}
                </div>
                {plan.dirty && (
                  <p className={styles.note}>Guarda los cambios antes de verificar los fondos.</p>
                )}
                {preview && (
                  <Feedback
                    tone={preview.sources.every((s) => s.sufficient) ? "success" : "warning"}
                    title={
                      preview.sources.every((s) => s.sufficient)
                        ? "Fondos disponibles para las asignaciones"
                        : "Faltan fondos en un origen"
                    }
                  >
                    <ul>
                      {preview.sources.map((s) => (
                        <li key={s.id}>
                          {s.accountName} · {s.categoryName}: disponible{" "}
                          {money(String(s.balance), s.currency)}, requerido{" "}
                          {money(s.required, s.currency)}
                        </li>
                      ))}
                    </ul>
                  </Feedback>
                )}
                {status === "finalized" && (
                  <>
                    <div className={styles.fields}>
                      <PlanField label="Fecha contable de la asignación">
                        <Input
                          type="date"
                          min={`${doc.month}-01`}
                          max={getAccountingDate()}
                          value={postDate}
                          disabled={plan.busy || !!plan.pending}
                          onChange={(e) => setPostDate(e.target.value)}
                        />
                      </PlanField>
                    </div>
                    <Button
                      onClick={() => setConfirm(true)}
                      disabled={
                        plan.busy ||
                        !!plan.pending ||
                        !preview?.sources.every((s) => s.sufficient) ||
                        !postDate ||
                        postDate < `${doc.month}-01` ||
                        postDate > getAccountingDate()
                      }
                    >
                      Asignar a sobres
                    </Button>
                    <p className={styles.note}>
                      Disponible desde el primer día del mes presupuestado. Verifica los fondos
                      inmediatamente antes de confirmar.
                    </p>
                  </>
                )}
              </>
            )}
          </section>
        </div>
        <aside className={styles.rail} aria-label="Revisión del mes">
          <h2>
            <CalendarDays aria-hidden="true" className="size-4" />
            Desde {formatIsoDateOnly(`${doc.month}-01`)}
          </h2>
          <div className={styles.route}>
            <span>Origen del ingreso</span>
            <strong>{doc.incomeMonth ? planMonth(doc.incomeMonth) : "Mes por definir"}</strong>
            <small>Ingreso recibido · USD</small>
          </div>
          <div className={styles.route}>
            <span>Reserva para convertir a CRC</span>
            <strong>{money(c.convertUsd)}</strong>
            <small>Equivalente {money(c.conversionCrc, "CRC")} a tu tasa</small>
          </div>
          <div className={styles.route}>
            <span>Conservarás libre</span>
            <strong>{money(c.free)}</strong>
            <small>{retained ? `${retained.name} · USD` : "Cuenta USD por elegir"}</small>
          </div>
          <div className={styles.railNumbers}>
            <div>
              <span>Asignaciones CRC</span>
              <strong>{money(c.paymentsCrc, "CRC")}</strong>
            </div>
            <div>
              <span>Asignaciones USD</span>
              <strong>{money(c.paymentsUsd)}</strong>
            </div>
            <div>
              <span>Diferencia de reserva CRC</span>
              <strong>{money(c.bufferCrc, "CRC")}</strong>
            </div>
          </div>
          <Button onClick={() => setTab("apply")}>
            Revisar sobres
            <ArrowRight aria-hidden="true" className="ml-2 size-4" />
          </Button>
          <Button variant="ghost" onClick={() => setTab("exchange")}>
            Cotización y margen
          </Button>
          <div className={styles.closing}>
            <span>Cierre del presupuesto</span>
            <strong>{money(c.closing)}</strong>
            <small>Neto − asignado − libre</small>
          </div>
        </aside>
      </div>
      {c.issues.length > 0 && (
        <div className="mt-6">
          <Feedback tone="info" title="Por completar antes de preparar">
            <ul className={styles.errorList}>
              {c.issues.map((issue, i) => (
                <li key={`${issue.field}-${i}`}>{issue.detail}</li>
              ))}
            </ul>
          </Feedback>
        </div>
      )}
      <div className={styles.footer}>
        <p>
          Las reservas conservan precisión intermedia. Cada asignación real se redondea a centavos;
          convertir y trasladar fondos entre bancos se registra por separado.
        </p>
        {!plan.pending && (
          <Button variant="ghost" disabled={plan.busy} onClick={plan.reload}>
            Actualizar cuentas y sobres
          </Button>
        )}
      </div>
      {editing && (
        <PlanLineEditor
          key={editing.id}
          line={editing}
          document={doc}
          options={plan.options}
          onClose={() => setEditing(null)}
          onSave={(line) => {
            patch({
              lines: doc.lines.some((l) => l.id === line.id)
                ? doc.lines.map((l) => (l.id === line.id ? line : l))
                : [...doc.lines, line],
            })
            setEditing(null)
          }}
          onRemove={(id) => {
            patch({ lines: doc.lines.filter((l) => l.id !== id) })
            setEditing(null)
          }}
        />
      )}
      <Dialog open={copyConfirm} onOpenChange={setCopyConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Copiar las asignaciones anteriores?</DialogTitle>
            <DialogDescription>
              Reemplazará las partidas de este borrador con las del último plan anterior a{" "}
              {planMonth(doc.month)}. El ingreso y las cotizaciones actuales se conservan. Revisa
              los destinos antes de guardar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={copying} onClick={() => setCopyConfirm(false)}>
              Cancelar
            </Button>
            <Button disabled={copying} onClick={copyPrevious}>
              Copiar asignaciones
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={confirm && status !== "funded"}
        onOpenChange={(open) => {
          if (!plan.busy) setConfirm(open)
        }}
      >
        <DialogContent
          onEscapeKeyDown={(e) => {
            if (plan.busy) e.preventDefault()
          }}
          onInteractOutside={(e) => {
            if (plan.busy) e.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle>Confirmar asignación a sobres</DialogTitle>
            <DialogDescription>
              Se redistribuirán fondos existentes de los sobres de origen hacia los destinos
              revisados. Los totales de las cuentas se conservan.
            </DialogDescription>
          </DialogHeader>
          <div className={styles.dialogAmounts}>
            <div>
              <span>Asignaciones CRC</span>
              <strong>{money(c.paymentsCrc, "CRC")}</strong>
            </div>
            <div>
              <span>Asignaciones USD</span>
              <strong>{money(c.paymentsUsd)}</strong>
            </div>
          </div>
          <p className="text-sm">
            Fecha contable: {formatIsoDateOnly(postDate)}. {doc.lines.length} asignaciones.
          </p>
          {plan.error && (
            <p role="alert" className="text-sm text-destructive">
              {plan.error}
            </p>
          )}
          {recoveryControls}
          <DialogFooter>
            <Button variant="outline" disabled={plan.busy} onClick={() => setConfirm(false)}>
              Volver a revisar
            </Button>
            <Button
              disabled={plan.busy || !!plan.pending}
              onClick={() => plan.act("fund", postDate)}
            >
              {plan.busy ? "Asignando…" : "Confirmar asignación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
