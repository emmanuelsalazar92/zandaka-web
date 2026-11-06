"use client"

import { Plus, RefreshCw } from "lucide-react"
import * as React from "react"

import { PageHeader } from "@/components/page-header"
import { ReconciliationCreate } from "@/components/reconciliation/reconciliation-create"
import { ReconciliationDetail } from "@/components/reconciliation/reconciliation-detail"
import styles from "@/components/reconciliation/reconciliation.module.css"
import { useReconciliationRead } from "@/components/reconciliation/use-reconciliation-read"
import { AccessibleField } from "@/components/ui/accessible-field"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Feedback, LoadingState } from "@/components/ui/feedback"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { dashboardAccountId } from "@/lib/dashboard-period"
import { formatAccountingTimestamp, formatIsoDateOnly } from "@/lib/date-only"
import {
  fetchActiveReconciliation,
  fetchReconciliationAccounts,
  fetchReconciliations,
  type ReconciliationRecord,
} from "@/lib/reconciliation-api"
import {
  reconciliationAmount,
  reconciliationState,
  supportedReconciliationCurrency,
} from "@/lib/reconciliation-review"
import { cn } from "@/lib/utils"

export function ReconciliationContent() {
  const accounts = useReconciliationRead("accounts", fetchReconciliationAccounts)
  const [accountId, setAccount] = React.useState(""),
    [creating, setCreating] = React.useState(false),
    [detailId, setDetail] = React.useState<number | null>(null)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = dashboardAccountId(params.get("accountId"))
    if (params.get("source") === "dashboard" && id) setAccount(id)
  }, [])
  const [notice, setNotice] = React.useState<{ title: string; description: string } | null>(null)
  const createTrigger = React.useRef<HTMLButtonElement>(null),
    historyHeading = React.useRef<HTMLHeadingElement>(null)
  const selectable = React.useMemo(
    () =>
      [...(accounts.data ?? [])].sort(
        (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name),
      ),
    [accounts.data],
  )
  const selected = accountId
    ? (selectable.find((account) => String(account.id) === accountId) ?? null)
    : (selectable[0] ?? null)
  const selectedId = selected?.id ?? null
  const loadHistory = React.useCallback(
    (signal: AbortSignal) => fetchReconciliations(selectedId!, signal),
    [selectedId],
  )
  const loadActive = React.useCallback(
    (signal: AbortSignal) => fetchActiveReconciliation(selectedId!, signal),
    [selectedId],
  )
  const history = useReconciliationRead(selected ? `history:${selected.id}` : null, loadHistory)
  const active = useReconciliationRead(selected ? `active:${selected.id}` : null, loadActive)
  const reviewing = active.data ?? history.data?.[0] ?? null
  const state = reviewing ? reconciliationState(reviewing) : null
  const unavailable = accounts.loading || history.loading || active.loading
  const refresh = () => {
    history.reload()
    active.reload()
  }
  const openDetail = (id: number) => setDetail(id)
  function onCreated(record: ReconciliationRecord) {
    setCreating(false)
    setNotice({
      title: "Conciliación registrada",
      description: `${reconciliationState(record).label}. El resultado fue confirmado por el servidor; no se crearon movimientos de ajuste.`,
    })
    refresh()
  }
  const returnToHistory = (id?: number) => {
    const trigger = id
      ? document.getElementById(`reconciliation-open-${id}`)
      : createTrigger.current
    if (trigger?.isConnected && !(trigger instanceof HTMLButtonElement && trigger.disabled))
      trigger.focus({ preventScroll: true })
    else historyHeading.current?.focus({ preventScroll: true })
  }
  return (
    <div
      className={cn(
        "marea-surface @container min-w-0 space-y-6 rounded-2xl bg-background p-3 sm:p-5",
        styles.scope,
      )}
    >
      <PageHeader
        title="Conciliación"
        description="Compara lo registrado con tu saldo real y revisa cada diferencia con contexto."
        actionsLabel="Acciones de conciliación"
      >
        <Button
          ref={createTrigger}
          disabled={
            !selected?.active ||
            unavailable ||
            Boolean(active.data) ||
            Boolean(active.error) ||
            !supportedReconciliationCurrency(selected?.currency ?? "")
          }
          onClick={() => setCreating(true)}
        >
          <Plus aria-hidden="true" className="size-4" />
          Nueva conciliación
        </Button>
        <Button
          variant="outline"
          disabled={unavailable}
          onClick={() => {
            accounts.reload()
            refresh()
          }}
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          Actualizar
        </Button>
      </PageHeader>
      {notice && <Feedback title={notice.title}>{notice.description}</Feedback>}
      {accounts.loading ? (
        <LoadingState>Cargando cuentas…</LoadingState>
      ) : accounts.error ? (
        <Feedback tone="error" title="No pudimos cargar las cuentas">
          {accounts.error}
          <Button variant="outline" onClick={accounts.reload}>
            Volver a cargar cuentas
          </Button>
        </Feedback>
      ) : !selected ? (
        <Feedback
          role="note"
          title={
            accountId ? "La cuenta del enlace no está disponible" : "No hay cuentas disponibles"
          }
        >
          {accountId ? (
            <>
              <p>Actualiza la revisión desde Resumen o elige otra cuenta explícitamente.</p>
              <Button className="mt-3" variant="outline" onClick={() => setAccount("")}>
                Elegir otra cuenta
              </Button>
            </>
          ) : (
            "Crea o activa una cuenta para empezar a comparar sus saldos."
          )}
        </Feedback>
      ) : (
        <>
          <AccessibleField className="max-w-2xl space-y-2">
            <Label htmlFor="reconciliation-account">Cuenta a conciliar</Label>
            <SearchableSelect
              id="reconciliation-account"
              searchLabel="Buscar cuenta a conciliar"
              value={String(selected.id)}
              options={selectable.map((account) => ({
                value: String(account.id),
                label: `${account.name} · ${account.institution || "Institución no disponible"} · ${account.currency || "Moneda no disponible"}${account.active ? "" : " · Inactiva"}`,
              }))}
              onValueChange={(value) => {
                setAccount(value)
                setNotice(null)
              }}
            />
          </AccessibleField>
          <section
            aria-label="Resumen de conciliación"
            className="atlantic-hero min-w-0 space-y-3 p-4 sm:p-6"
          >
            <p className="hero-caption text-sm">
              {selected.name} · {selected.currency || "Moneda no disponible"}
            </p>
            <p className="text-2xl font-semibold">
              {unavailable
                ? "Consultando…"
                : active.error || history.error
                  ? "Estado por confirmar"
                  : (state?.label ?? "Empieza una revisión")}
            </p>
            {unavailable ? (
              <p className="hero-caption text-sm">Cargando las revisiones de esta cuenta.</p>
            ) : active.error || history.error ? (
              <p className="hero-caption text-sm">
                No interpretamos un error de consulta como un saldo conciliado.
              </p>
            ) : reviewing ? (
              <>
                <p className="hero-caption text-sm">
                  Corte {formatIsoDateOnly(reviewing.date)} · Diferencia registrada al guardar
                </p>
                <p className="text-2xl font-semibold tabular-nums">
                  {reconciliationAmount(reviewing.difference, reviewing.currency, true)}
                </p>
                <p className="hero-caption max-w-3xl text-sm">{state!.explanation}</p>
              </>
            ) : (
              <p className="hero-caption text-sm">
                Elige una fecha de corte e introduce el saldo del banco o cuenta tus billetes y
                monedas. Registrar una revisión no ajusta saldos.
              </p>
            )}
          </section>
          {active.loading ? null : active.error ? (
            <Feedback tone="error" title="No se pudo verificar la revisión abierta">
              {active.error}
              <Button variant="outline" onClick={active.reload}>
                Volver a verificar estado
              </Button>
            </Feedback>
          ) : active.data ? (
            <Feedback tone="warning" role="note" title="Ya hay una conciliación abierta">
              Revísala antes de registrar otra para esta cuenta.{" "}
              <Button variant="outline" onClick={() => openDetail(active.data!.id)}>
                Revisar conciliación abierta
              </Button>
            </Feedback>
          ) : null}
          {!selected.active && (
            <Feedback role="note" title="Cuenta inactiva">
              Puedes consultar sus revisiones guardadas. Para crear otra, la cuenta debe estar
              activa.
            </Feedback>
          )}
          <section aria-labelledby="reconciliation-history-title" className="min-w-0 space-y-4">
            <div>
              <h2
                id="reconciliation-history-title"
                ref={historyHeading}
                tabIndex={-1}
                className="text-xl font-semibold focus-visible:outline-2 focus-visible:outline-ring"
              >
                Revisiones de saldo
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Hasta 50 revisiones más recientes de esta cuenta. Los importes se conservan al
                registrar.
              </p>
            </div>
            <p
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="text-sm text-muted-foreground"
            >
              {history.loading
                ? "Cargando revisiones…"
                : history.error
                  ? "Historial por confirmar."
                  : `${history.data?.length ?? 0} revisiones cargadas.`}
            </p>
            {history.loading ? (
              <LoadingState>Cargando historial de conciliación…</LoadingState>
            ) : history.error ? (
              <Feedback tone="error" title="No pudimos cargar las revisiones">
                {history.error}
                <Button variant="outline" onClick={history.reload}>
                  Volver a cargar revisiones
                </Button>
              </Feedback>
            ) : !history.data?.length ? (
              <Feedback role="note" title="Todavía no hay conciliaciones">
                Cuando registres la primera, podrás consultar aquí su comparación y resultado.
              </Feedback>
            ) : (
              <ol className={styles.list}>
                {history.data.map((record) => {
                  const itemState = reconciliationState(record)
                  return (
                    <li key={record.id} className={styles.entry} data-testid="reconciliation-row">
                      <div className="min-w-0 space-y-2">
                        <div className={styles.entryHead}>
                          <p className="font-semibold">Corte {formatIsoDateOnly(record.date)}</p>
                          <Badge variant={itemState.tone}>{itemState.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {record.countMethod === "DENOMINATION_COUNT"
                            ? "Billetes y monedas"
                            : "Saldo manual"}
                        </p>
                        {record.closedAt && (
                          <p className="text-xs text-muted-foreground">
                            Cierre: {formatAccountingTimestamp(record.closedAt)}
                          </p>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Diferencia al registrar</p>
                        <p className={cn(styles.amount, itemState.open && "text-warning")}>
                          {reconciliationAmount(record.difference, record.currency, true)}
                        </p>
                        {!itemState.open && record.difference !== 0 && (
                          <p className="text-xs text-muted-foreground">
                            Dato histórico · revisión cerrada
                          </p>
                        )}
                      </div>
                      <Button
                        id={`reconciliation-open-${record.id}`}
                        variant="outline"
                        aria-label={`Ver detalle de conciliación ${record.id}`}
                        onClick={() => openDetail(record.id)}
                      >
                        Ver detalle
                      </Button>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
          {creating && (
            <ReconciliationCreate
              key={selected.id}
              account={selected}
              onClose={() => setCreating(false)}
              onCreated={onCreated}
              onReview={() => {
                setCreating(false)
                setNotice({
                  title: "Resultado por confirmar",
                  description:
                    "Revisa si la conciliación ya se registró antes de intentarlo de nuevo. No hemos confirmado el resultado de la solicitud anterior.",
                })
                refresh()
              }}
              onReturnFocus={() => returnToHistory()}
            />
          )}
          {detailId !== null && (
            <ReconciliationDetail
              key={detailId}
              id={detailId}
              account={selected}
              onClose={() => setDetail(null)}
              onChanged={refresh}
              onReturnFocus={() => returnToHistory(detailId)}
            />
          )}
        </>
      )}
    </div>
  )
}
