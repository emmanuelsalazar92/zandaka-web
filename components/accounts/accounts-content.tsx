"use client"

import { Plus, RefreshCw } from "lucide-react"
import Link from "next/link"
import * as React from "react"

import styles from "@/components/accounts/account-context.module.css"
import { AccountDeactivateDialog } from "@/components/accounts/components/account-deactivate-dialog"
import { AccountFormDialog } from "@/components/accounts/components/account-form-dialog"
import { AccountsTable } from "@/components/accounts/components/accounts-table"
import { ContextControls } from "@/components/accounts/components/context-controls"
import { useAccounts } from "@/components/accounts/hooks/use-accounts"
import { PageHeader } from "@/components/page-header"
import { AccessibleField } from "@/components/ui/accessible-field"
import { Button } from "@/components/ui/button"
import { EmptyState, Feedback } from "@/components/ui/feedback"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Skeleton } from "@/components/ui/skeleton"
import { contextActivityLink, contextTotals, selectContextRows } from "@/lib/account-context"
import { formatCurrency } from "@/lib/currency-formatter"
import { institutionManagement } from "@/lib/navigation"
import { catalogLink } from "@/lib/settings-catalog"
import { cn } from "@/lib/utils"

export function AccountsContent() {
  const state = useAccounts()
  const origin = React.useRef<HTMLElement | null>(null)
  const returnFocus = () => {
    const target = origin.current?.isConnected
      ? origin.current
      : document.getElementById("main-content")
    target?.focus()
  }
  const [query, setQuery] = React.useState("")
  const [order, setOrder] = React.useState("name")
  const [density, setDensity] = React.useState<"comfortable" | "compact">("comfortable")
  const [currency, setCurrency] = React.useState("ALL")
  const [heroCurrency, setHeroCurrency] = React.useState("CRC")
  const totals = contextTotals(state.accounts)
  const total = totals.find((row) => row.currency === heroCurrency) ?? totals[0]
  const visible = selectContextRows(
    state.accounts.filter((row) => currency === "ALL" || row.currency === currency),
    query,
    order,
  )
  const negative = state.accounts.filter((row) => row.balance !== null && row.balance < 0)
  const unconfirmed = state.accounts.filter((row) => row.balance === null).length
  return (
    <div
      className={cn(
        "marea-surface min-w-0 space-y-6 rounded-2xl bg-background p-3 sm:p-5",
        styles.page,
      )}
      data-density={density}
    >
      <PageHeader
        title="Cuentas"
        description="Dónde está tu dinero, con su banco y su moneda."
        related={[
          { ...institutionManagement, href: catalogLink(institutionManagement.href, "/accounts") },
        ]}
        actionsLabel="Acciones de cuentas"
      >
        <Button variant="outline" onClick={state.reloadAccounts} disabled={state.loading}>
          <RefreshCw aria-hidden="true" className="size-4" />
          Actualizar cuentas
        </Button>
        <AccountFormDialog
          open={state.isCreateOpen}
          onOpenChange={state.setIsCreateOpen}
          title="Crear cuenta"
          description="Añade una cuenta para organizar tu dinero. Puedes crear su institución sin salir de aquí."
          submitLabel="Crear cuenta"
          submitDisabled={
            !state.formData.name.trim() || !state.formData.institutionId || state.uncertain
          }
          onSubmit={() => void state.handleCreate()}
          formData={state.formData}
          onFormDataChange={state.setFormData}
          institutions={state.institutions}
          institutionsLoading={state.institutionsLoading}
          institutionsError={state.institutionsError}
          onInstitutionsReload={state.reloadInstitutions}
          onInstitutionCreated={state.onInstitutionCreated}
          loading={state.busy}
          error={state.formError}
          mode="create"
          idPrefix="create-account"
          trigger={
            <Button data-testid="add-account">
              <Plus aria-hidden="true" className="size-4" />
              Añadir cuenta
            </Button>
          }
        />
      </PageHeader>
      {state.notice && <Feedback role="status" title={state.notice} />}
      <section
        aria-label="Saldos de cuentas por moneda"
        className={styles.hero}
        aria-busy={state.loading}
      >
        <div className={styles.heroTop}>
          <div>
            <p className={styles.heroCaption}>Tu dinero, por moneda · Cuentas activas</p>
            {state.loading ? (
              <Skeleton className="my-4 h-14 w-64 max-w-full bg-white/20" />
            ) : (
              <p className={styles.heroAmount}>
                {state.error
                  ? "Por confirmar"
                  : total
                    ? total.total === null
                      ? "Por confirmar"
                      : formatCurrency(total.total, total.currency)
                    : "Tu primera cuenta"}
              </p>
            )}
            <p className={styles.heroCaption}>
              {total
                ? `${total.count} ${total.count === 1 ? "cuenta en" : "cuentas en"} ${total.currency}. `
                : ""}
              Saldos registrados; no representan una conciliación bancaria. Las monedas no se suman
              entre sí.
            </p>
            <div
              className={styles.heroChoices}
              role="group"
              aria-label="Moneda del saldo protagonista"
            >
              {totals.map((row) => (
                <button
                  key={row.currency}
                  type="button"
                  aria-pressed={row.currency === total?.currency}
                  onClick={() => setHeroCurrency(row.currency)}
                >
                  {row.currency}
                </button>
              ))}
            </div>
          </div>
          <dl className="space-y-4">
            {totals.map((row) => (
              <div key={row.currency}>
                <dt className={styles.heroCaption}>Saldo original · {row.currency}</dt>
                <dd className="text-xl font-semibold tabular-nums">
                  {state.loading || row.total === null
                    ? "Por confirmar"
                    : formatCurrency(row.total, row.currency)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      {state.error ? (
        <Feedback tone="error" title="No pudimos cargar las cuentas">
          <p>{state.error}</p>
          <Button className="mt-3" variant="outline" onClick={state.reloadAccounts}>
            Volver a consultar cuentas
          </Button>
        </Feedback>
      ) : !state.loading && state.accounts.length === 0 ? (
        <EmptyState
          title="Todavía no hay cuentas"
          action={
            <Button onClick={() => state.setIsCreateOpen(true)}>Añadir mi primera cuenta</Button>
          }
        >
          Añade una cuenta y su institución. Después podrás organizar el dinero en sobres.
        </EmptyState>
      ) : (
        <>
          <ContextControls
            prefix="accounts"
            query={query}
            setQuery={setQuery}
            order={order}
            setOrder={setOrder}
            density={density}
            setDensity={setDensity}
          >
            <AccessibleField className="space-y-1">
              <Label htmlFor="accounts-currency">Filtrar cuentas por moneda</Label>
              <SearchableSelect
                id="accounts-currency"
                value={currency}
                onValueChange={setCurrency}
                options={[
                  { value: "ALL", label: "Todas las monedas" },
                  ...totals.map((row) => ({ value: row.currency, label: row.currency })),
                ]}
              />
            </AccessibleField>
          </ContextControls>
          <div className={styles.body}>
            <div className="min-w-0 space-y-4">
              <p role="status" className={styles.caption}>
                {state.loading
                  ? "Consultando cuentas…"
                  : `${visible.length} de ${state.accounts.length} cuentas activas. Los importes conservan su moneda.`}
              </p>
              {!state.loading && visible.length === 0 ? (
                <EmptyState
                  title="No hay cuentas con estos filtros"
                  action={
                    <Button
                      variant="outline"
                      onClick={() => {
                        setQuery("")
                        setCurrency("ALL")
                      }}
                    >
                      Quitar filtros
                    </Button>
                  }
                >
                  Prueba otro nombre o moneda; tus cuentas no se han modificado.
                </EmptyState>
              ) : (
                <AccountsTable
                  accounts={visible}
                  loading={state.loading}
                  error={null}
                  onEdit={(account) => {
                    origin.current =
                      document.activeElement instanceof HTMLElement ? document.activeElement : null
                    state.openEdit(account)
                  }}
                  onDeactivate={(id) => {
                    origin.current =
                      document.activeElement instanceof HTMLElement ? document.activeElement : null
                    state.openDeactivate(id)
                  }}
                />
              )}
            </div>
            <aside className={styles.context} aria-label="Contexto de las cuentas">
              <h2 className={styles.title}>De la cuenta al propósito.</h2>
              <p className={styles.caption}>
                Entra a sus sobres para ver la distribución. Movimientos conserva el historial
                completo de esa cuenta.
              </p>
              <h3 className="mt-5 text-sm font-semibold">Negativos conocidos</h3>
              {negative.length ? (
                <ul className={cn(styles.list, styles.contextList)}>
                  {negative.map((row) => (
                    <li key={row.id}>
                      <Link href={contextActivityLink(row.id)}>
                        {row.name} · {formatCurrency(row.balance!, row.currency)}
                        <span className={styles.caption}>Revisar movimientos de la cuenta</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.caption}>
                  {state.loading ? "Por confirmar" : "Sin saldos negativos conocidos."}
                </p>
              )}
              {unconfirmed > 0 && (
                <p className="mt-4 text-sm">
                  {unconfirmed} {unconfirmed === 1 ? "cuenta tiene" : "cuentas tienen"} saldo por
                  confirmar. No equivale a cero.
                </p>
              )}
              <p className="mt-5 text-sm">
                La desactivación conserva la historia. Una cuenta con sobres activos debe revisarlos
                antes.
              </p>
            </aside>
          </div>
        </>
      )}
      <AccountFormDialog
        open={state.isEditOpen}
        onOpenChange={(open) => {
          if (!open) state.closeEdit()
        }}
        title="Editar cuenta"
        description="Actualiza su nombre. Institución y moneda se conservan."
        submitLabel="Guardar cambios"
        submitDisabled={!state.formData.name.trim() || state.uncertain}
        onSubmit={() => void state.handleEdit()}
        formData={state.formData}
        onFormDataChange={state.setFormData}
        loading={state.busy}
        error={state.formError}
        mode="edit"
        idPrefix="edit-account"
        returnFocus={returnFocus}
      />
      <AccountDeactivateDialog
        open={state.deactivateId !== null}
        onOpenChange={(open) => {
          if (!open) state.closeDeactivate()
        }}
        accounts={state.accounts}
        deactivateId={state.deactivateId}
        loading={state.busy}
        uncertain={state.uncertain}
        error={state.deactivateError}
        onConfirm={() => void state.handleDeactivate()}
        returnFocus={returnFocus}
      />
    </div>
  )
}
