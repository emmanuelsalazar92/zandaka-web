"use client"

import { RefreshCw, XCircle } from "lucide-react"
import Link from "next/link"
import * as React from "react"

import styles from "@/components/accounts/account-context.module.css"
import { ContextControls } from "@/components/accounts/components/context-controls"
import { useContextRead } from "@/components/accounts/hooks/use-context-read"
import { LinkEnvelopeDialog } from "@/components/envelopes/link-envelope-dialog"
import { PageHeader } from "@/components/page-header"
import { AccessibleField } from "@/components/ui/accessible-field"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { EmptyState, Feedback, LoadingState } from "@/components/ui/feedback"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  contextActivityLink,
  contextDistribution,
  contextRead,
  contextWrite,
  ContextWriteError,
  parseContextAccounts,
  parseContextEnvelopes,
  selectContextRows,
  type ContextEnvelope,
} from "@/lib/account-context"
import { formatCurrency } from "@/lib/currency-formatter"
import { dashboardAccountId } from "@/lib/dashboard-period"
import { categoryManagement } from "@/lib/navigation"
import { cn } from "@/lib/utils"

const loadAccounts = async (signal: AbortSignal) =>
  parseContextAccounts(await contextRead("/reports/account-balances?isActive=true", signal))
export function EnvelopesContent() {
  const accounts = useContextRead("accounts", loadAccounts)
  const [accountId, setAccountId] = React.useState("")
  const [query, setQuery] = React.useState("")
  const [order, setOrder] = React.useState("desc")
  const [filter, setFilter] = React.useState("ALL")
  const [density, setDensity] = React.useState<"comfortable" | "compact">("comfortable")
  const [notice, setNotice] = React.useState<string | null>(null)
  const [candidate, setCandidate] = React.useState<ContextEnvelope | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [uncertain, setUncertain] = React.useState(false)
  const [writeError, setWriteError] = React.useState<string | null>(null)
  const lock = React.useRef(false)
  const confirmed = React.useRef(false)
  const trigger = React.useRef<HTMLButtonElement | null>(null)
  const heading = React.useRef<HTMLHeadingElement>(null)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has("accountId"))
      setAccountId(dashboardAccountId(params.get("accountId")) ?? "invalid")
  }, [])
  const selected = accountId
    ? (accounts.data?.find((row) => String(row.id) === accountId) ?? null)
    : (accounts.data?.[0] ?? null)
  const selectedId = selected?.id ?? null
  const currency = selected?.currency ?? ""
  const loadEnvelopes = React.useCallback(
    async (signal: AbortSignal) => {
      if (selectedId === null) throw new Error("Cuenta no disponible")
      return parseContextEnvelopes(
        await contextRead(`/reports/envelope-balances?accountId=${selectedId}`, signal),
        { id: selectedId, currency },
      )
    },
    [selectedId, currency],
  )
  const envelopes = useContextRead(
    selected ? `envelopes:${selected.id}:${selected.currency}` : null,
    loadEnvelopes,
  )
  const rows = envelopes.data ?? []
  const distribution = contextDistribution(rows)
  const available = envelopes.data !== null
  const visible = selectContextRows(
    rows.filter(
      (row) =>
        filter === "ALL" ||
        (filter === "negative" && row.balance !== null && row.balance < 0) ||
        (filter === "zero" && row.balance === 0) ||
        (filter === "positive" && row.balance !== null && row.balance > 0) ||
        (filter === "pending" && row.balance === null),
    ),
    query,
    order,
  )
  async function deactivate() {
    if (lock.current || !candidate || candidate.balance !== 0 || uncertain) return
    lock.current = true
    setBusy(true)
    setWriteError(null)
    try {
      await contextWrite(`/envelopes/${candidate.id}/deactivate`, "POST")
      confirmed.current = true
      setCandidate(null)
      envelopes.reload()
      accounts.reload()
      setNotice("Sobre desactivado. Sus movimientos históricos se conservan.")
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : "No pudimos desactivar el sobre.")
      if (error instanceof ContextWriteError && error.uncertain) setUncertain(true)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const top =
    distribution.positive !== null
      ? rows
          .filter((row) => row.balance !== null && row.balance > 0)
          .sort((a, b) => b.balance! - a.balance!)
          .slice(0, 3)
      : []
  return (
    <div
      className={cn(
        "marea-surface min-w-0 space-y-6 rounded-2xl bg-background p-3 sm:p-5",
        styles.page,
      )}
      data-density={density}
    >
      <PageHeader
        title="Sobres"
        description="Tu dinero tiene un lugar y un propósito."
        related={[categoryManagement]}
        actionsLabel="Acciones de sobres"
      >
        <Button
          variant="outline"
          disabled={accounts.loading || envelopes.loading || busy}
          onClick={() => {
            accounts.reload()
            envelopes.reload()
          }}
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          Actualizar sobres
        </Button>
        {selected && (
          <LinkEnvelopeDialog
            key={selected.id}
            account={selected}
            envelopes={rows}
            disabled={!available || envelopes.loading || busy}
            onLinked={() => {
              envelopes.reload()
              accounts.reload()
              setNotice("Categoría vinculada. El sobre está listo; no se han asignado fondos.")
            }}
          />
        )}
      </PageHeader>
      {notice && <Feedback title={notice} />}
      {accounts.loading ? (
        <LoadingState>Cargando cuentas…</LoadingState>
      ) : accounts.error ? (
        <Feedback tone="error" title="Cuentas por confirmar">
          <p>{accounts.error}</p>
          <Button className="mt-3" variant="outline" onClick={accounts.reload}>
            Consultar cuentas
          </Button>
        </Feedback>
      ) : (
        <>
          {accounts.data?.length ? (
            <AccessibleField className="min-w-0 space-y-2">
              <Label htmlFor="envelopes-account">Cuenta de los sobres</Label>
              <SearchableSelect
                id="envelopes-account"
                value={selected ? String(selected.id) : ""}
                onValueChange={(value) => {
                  setAccountId(value)
                  setQuery("")
                  setFilter("ALL")
                  setNotice(null)
                }}
                options={accounts.data.map((row) => ({
                  value: String(row.id),
                  label: `${row.name} · ${row.institution} · ${row.currency}`,
                }))}
                disabled={busy}
                searchLabel="Buscar cuenta de sobres"
                placeholder="Elige una cuenta"
              />
            </AccessibleField>
          ) : null}
          {!selected ? (
            <EmptyState
              title={accountId ? "La cuenta del enlace no está disponible" : "Primero, una cuenta"}
              action={
                <Button asChild variant="outline">
                  <Link href="/accounts">Ir a Cuentas</Link>
                </Button>
              }
            >
              {accountId
                ? "Elige otra cuenta explícitamente. No mostramos saldos de una cuenta diferente."
                : "Añade una cuenta para empezar a organizar el dinero en sobres."}
            </EmptyState>
          ) : (
            <>
              <section
                className={styles.hero}
                aria-label="Saldo y distribución de sobres"
                aria-busy={envelopes.loading}
              >
                <div className={styles.heroTop}>
                  <div>
                    <p className={styles.heroCaption}>
                      {selected.institution} · {selected.currency}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold">{selected.name}</h2>
                    <p className={styles.heroCaption}>Saldo de los sobres activos</p>
                    {envelopes.loading ? (
                      <Skeleton className="my-4 h-14 w-64 max-w-full bg-white/20" />
                    ) : (
                      <p className={styles.heroAmount}>
                        {!available || distribution.total === null
                          ? "Por confirmar"
                          : formatCurrency(distribution.total, selected.currency)}
                      </p>
                    )}
                    <p className={styles.heroCaption}>
                      {available ? `${rows.length} sobres activos. ` : ""}La distribución describe
                      saldos, no metas ni suficiencia de fondos.
                    </p>
                    {available && distribution.negative.length > 0 && (
                      <a
                        className={styles.heroLink}
                        href="#envelope-list-title"
                        onClick={() => {
                          setFilter("negative")
                          setQuery("")
                        }}
                      >
                        {distribution.negative.length}{" "}
                        {distribution.negative.length === 1
                          ? "sobre con saldo negativo"
                          : "sobres con saldo negativo"}{" "}
                        · Revisar
                      </a>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Reparto de saldos positivos</h3>
                    <p className={styles.heroCaption}>
                      Base{" "}
                      {available && distribution.positive !== null
                        ? formatCurrency(distribution.positive, selected.currency)
                        : "por confirmar"}
                      . Negativos y ceros no forman parte del reparto.
                    </p>
                    {top.map((row) => (
                      <div key={row.id} className="mt-4">
                        <div className="flex flex-wrap justify-between gap-2 text-sm">
                          <span>{row.name}</span>
                          <strong>{distribution.share(row)?.toLocaleString("es-CR")}%</strong>
                        </div>
                        <div className={styles.bar} aria-hidden="true">
                          <span
                            style={{
                              width: `${distribution.share(row)}%`,
                              background: "var(--hero-foreground)",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    {available && distribution.positive === 0 && (
                      <p className={styles.heroCaption}>
                        Aún no hay saldos positivos para representar.
                      </p>
                    )}
                    {available && distribution.total === null && (
                      <p className={styles.heroCaption}>
                        Faltan saldos por confirmar. Los negativos conocidos siguen disponibles para
                        revisión.
                      </p>
                    )}
                  </div>
                </div>
              </section>
              <ContextControls
                prefix="envelopes"
                query={query}
                setQuery={setQuery}
                order={order}
                setOrder={setOrder}
                density={density}
                setDensity={setDensity}
              >
                <AccessibleField className="space-y-1">
                  <Label htmlFor="envelopes-filter">Estado del saldo</Label>
                  <SearchableSelect
                    id="envelopes-filter"
                    value={filter}
                    onValueChange={setFilter}
                    options={[
                      { value: "ALL", label: "Todos los sobres" },
                      { value: "negative", label: "Saldo negativo" },
                      { value: "zero", label: "Sin saldo" },
                      { value: "positive", label: "Saldo positivo" },
                      { value: "pending", label: "Por confirmar" },
                    ]}
                  />
                </AccessibleField>
              </ContextControls>
              <div className={styles.body}>
                <section aria-labelledby="envelope-list-title" className="min-w-0 space-y-3">
                  <div className={styles.heading}>
                    <h2
                      id="envelope-list-title"
                      ref={heading}
                      tabIndex={-1}
                      className={styles.title}
                    >
                      Tus sobres
                    </h2>
                    <Button asChild variant="outline">
                      <Link href={contextActivityLink(selected.id)}>Movimientos de la cuenta</Link>
                    </Button>
                  </div>
                  <p role="status" className={styles.caption}>
                    {envelopes.loading
                      ? "Consultando distribución…"
                      : !available
                        ? "Distribución por confirmar."
                        : `${visible.length} de ${rows.length} sobres. Saldo y porcentajes incluyen todos los sobres activos, aunque haya filtros.`}
                  </p>
                  {envelopes.loading ? (
                    <LoadingState>Cargando sobres…</LoadingState>
                  ) : envelopes.error ? (
                    <Feedback tone="error" title="Saldos de sobres por confirmar">
                      <p>{envelopes.error}</p>
                      <Button className="mt-3" variant="outline" onClick={envelopes.reload}>
                        Consultar sobres
                      </Button>
                    </Feedback>
                  ) : visible.length === 0 ? (
                    <EmptyState
                      title={
                        rows.length ? "Ningún sobre coincide" : "El primer propósito empieza aquí"
                      }
                      action={
                        rows.length ? (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setQuery("")
                              setFilter("ALL")
                            }}
                          >
                            Quitar filtros
                          </Button>
                        ) : undefined
                      }
                    >
                      {rows.length
                        ? "Busca otro nombre o estado. No se ha cambiado la distribución."
                        : "Vincula una categoría con el botón superior para crear un sobre. También puedes crear una categoría nueva dentro del flujo."}
                    </EmptyState>
                  ) : (
                    <ul className={styles.list}>
                      {visible.map((row) => {
                        const share = distribution.share(row)
                        return (
                          <li key={row.id} className={styles.row} data-testid="envelope-row">
                            <div>
                              <h3 className={styles.rowName}>{row.name}</h3>
                              <p
                                className={cn(
                                  styles.status,
                                  row.balance !== null && row.balance < 0
                                    ? "text-error"
                                    : "text-muted-foreground",
                                )}
                              >
                                {row.balance === null
                                  ? "Saldo por confirmar"
                                  : row.balance < 0
                                    ? "Saldo negativo"
                                    : row.balance === 0
                                      ? "Sin saldo"
                                      : "Saldo positivo"}
                              </p>
                              <p className={styles.caption}>
                                {share === null
                                  ? row.balance !== null && row.balance <= 0
                                    ? "Fuera del reparto de saldos positivos"
                                    : "Participación por confirmar"
                                  : `${share.toLocaleString("es-CR")}% de los saldos positivos en ${row.currency}`}
                              </p>
                              {share !== null && (
                                <div className={styles.bar} aria-hidden="true">
                                  <span style={{ width: `${share}%` }} />
                                </div>
                              )}
                            </div>
                            <p
                              className={cn(
                                styles.rowAmount,
                                row.balance !== null && row.balance < 0 && "text-error",
                              )}
                            >
                              {row.balance === null
                                ? "Por confirmar"
                                : formatCurrency(row.balance, row.currency)}
                            </p>
                            <div>
                              <div className={styles.actions}>
                                <Button asChild variant="outline">
                                  <Link
                                    href={contextActivityLink(selected.id, row.categoryId)}
                                    aria-label={`Movimientos del sobre ${row.name}`}
                                  >
                                    Ver movimientos
                                  </Link>
                                </Button>
                                <Button
                                  variant="ghost"
                                  aria-label={`Desactivar sobre ${row.name}`}
                                  disabled={row.balance !== 0 || busy}
                                  onClick={(event) => {
                                    trigger.current = event.currentTarget
                                    confirmed.current = false
                                    setCandidate(row)
                                    setWriteError(null)
                                    setUncertain(false)
                                  }}
                                >
                                  <XCircle aria-hidden="true" className="size-4" />
                                </Button>
                              </div>
                              {row.balance !== 0 && (
                                <p className={styles.caption}>
                                  {row.balance === null
                                    ? "Confirma el saldo antes de desactivar."
                                    : "El saldo debe ser cero para desactivar."}
                                </p>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
                <aside className={styles.context} aria-label="Contexto de la distribución">
                  <h2 className={styles.title}>Una cuenta, una moneda.</h2>
                  <p className={styles.caption}>
                    {selected.name} · {selected.institution} · {selected.currency}
                  </p>
                  <dl className="mt-5 space-y-4">
                    <div>
                      <dt className="text-sm">Saldo registrado de la cuenta</dt>
                      <dd className="mt-1 text-lg font-semibold tabular-nums">
                        {selected.balance === null
                          ? "Por confirmar"
                          : formatCurrency(selected.balance, selected.currency)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm">Alcance de esta vista</dt>
                      <dd className={styles.caption}>
                        Solo sobres activos. El saldo de la cuenta puede incluir movimientos de
                        sobres inactivos; por eso ambos alcances pueden diferir.
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-5 text-sm">
                    Un porcentaje mayor no significa una mejor situación financiera. Revisa
                    compromisos y movimientos para decidir.
                  </p>
                  <p className="mt-4 text-sm">
                    Vincular una categoría crea o reactiva su sobre. No mueve dinero; las
                    transferencias y asignaciones se registran por separado.
                  </p>
                  <Button asChild variant="outline" className="mt-5">
                    <Link href={`/reconciliation?source=account-context&accountId=${selected.id}`}>
                      Revisar conciliación de la cuenta
                    </Link>
                  </Button>
                </aside>
              </div>
            </>
          )}
        </>
      )}
      <AlertDialog
        open={candidate !== null}
        onOpenChange={(open) => {
          if (!open && !lock.current) setCandidate(null)
        }}
      >
        <AlertDialogContent
          className="marea-surface"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (confirmed.current || !trigger.current?.isConnected) heading.current?.focus()
            else trigger.current.focus()
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar el sobre?</AlertDialogTitle>
            <AlertDialogDescription>
              {candidate?.name} · {selected?.name}. El saldo debe ser cero; sus movimientos
              históricos se conservarán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {writeError && (
            <Feedback tone="error" title="Desactivación por revisar">
              {writeError}
            </Feedback>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <Button
              disabled={busy || uncertain || candidate?.balance !== 0}
              loading={busy}
              onClick={() => void deactivate()}
            >
              Confirmar desactivación
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
