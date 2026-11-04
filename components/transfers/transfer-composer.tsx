"use client"

import { ArrowDownLeft, ArrowUpRight, ArrowRightLeft } from "lucide-react"
import * as React from "react"

import { AccessibleField, AccessibleFieldError } from "@/components/ui/accessible-field"
import { Button } from "@/components/ui/button"
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Feedback } from "@/components/ui/feedback"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency } from "@/lib/currency-formatter"
import { formatIsoDateOnly, getAccountingDate } from "@/lib/date-only"
import { publicErrorMessage } from "@/lib/public-error"
import {
  clearPendingTransfer,
  isTransferConfirmation,
  readPendingTransfer,
  savePendingTransfer,
  transferRequestId,
  transferState,
  type PendingTransfer,
  type TransferAccount,
  type TransferDraft,
  type TransferEnvelope,
} from "@/lib/transfer"

type LoadOptions = (accountId: string) => Promise<TransferEnvelope[]>
function useEnvelopes(accountId: string, load: LoadOptions, version: number) {
  const [result, setResult] = React.useState<{
    accountId: string
    version: number
    items: TransferEnvelope[]
    loading: boolean
    error: string | null
  }>({ accountId: "", version: -1, items: [], loading: false, error: null })
  React.useEffect(() => {
    if (!accountId) return
    let active = true
    void load(accountId)
      .then((items) => {
        if (active) setResult({ accountId, version, items, loading: false, error: null })
      })
      .catch(() => {
        if (active)
          setResult({
            accountId,
            version,
            items: [],
            loading: false,
            error: "No pudimos cargar los sobres de esta cuenta.",
          })
      })
    return () => {
      active = false
    }
  }, [accountId, load, version])
  return result.accountId === accountId && result.version === version
    ? result
    : { accountId, items: [], loading: Boolean(accountId), error: null }
}

function TransferSummary({ record }: { record: PendingTransfer }) {
  return (
    <section
      aria-label="Resumen de transferencia"
      className="space-y-4 rounded-xl border bg-secondary/40 p-2 sm:p-5 [overflow-wrap:anywhere]"
    >
      <p className="font-semibold">Así se moverá tu dinero</p>
      <dl className="space-y-4 text-sm">
        <div className="space-y-1">
          <dt className="flex items-center gap-2 text-muted-foreground">
            <ArrowUpRight aria-hidden="true" className="size-4" />
            Sale de {record.fromLabel}
          </dt>
          <dd className="flex flex-wrap gap-x-2 text-lg font-semibold tabular-nums sm:text-xl">
            <span>{record.currency}</span>
            <span data-transfer-value>
              −
              {formatCurrency(record.payload.amount, record.currency)
                .replace(record.currency, "")
                .trim()}
            </span>
          </dd>
        </div>
        <div className="space-y-1 border-t pt-4">
          <dt className="flex items-center gap-2 text-muted-foreground">
            <ArrowDownLeft aria-hidden="true" className="size-4" />
            Entra a {record.toLabel}
          </dt>
          <dd className="flex flex-wrap gap-x-2 text-lg font-semibold tabular-nums sm:text-xl">
            <span>{record.currency}</span>
            <span data-transfer-value>
              +
              {formatCurrency(record.payload.amount, record.currency)
                .replace(record.currency, "")
                .trim()}
            </span>
          </dd>
        </div>
      </dl>
      <p className="text-sm text-muted-foreground">
        {record.payload.from.accountId === record.payload.to.accountId
          ? "Es un traslado entre sobres. El saldo total de esta cuenta no cambia."
          : "El total entre ambas cuentas no cambia. Esta operación no convierte monedas."}
      </p>
    </section>
  )
}

export function TransferComposer({
  accounts,
  accountsLoading,
  accountsError,
  initialDate,
  initialDescription,
  userId,
  onTypeChange,
  onClose,
  onConfirmed,
  onPendingChange,
  onRefreshAccounts,
}: {
  accounts: TransferAccount[]
  accountsLoading: boolean
  accountsError: string | null
  initialDate: string
  initialDescription: string
  userId: number
  onTypeChange: (type: "INCOME" | "EXPENSE" | "ADJUSTMENT") => void
  onClose: () => void
  onConfirmed: () => void
  onPendingChange: (pending: boolean) => void
  onRefreshAccounts: () => void
}) {
  const [draft, setDraft] = React.useState<TransferDraft>({
    date: initialDate || getAccountingDate(),
    description: initialDescription,
    fromAccount: "",
    fromEnvelope: "",
    toAccount: "",
    toEnvelope: "",
    amount: "",
  })
  const [pending, setPending] = React.useState<PendingTransfer | null>(null)
  const [recoveryError, setRecoveryError] = React.useState(false)
  const [hydrated, setHydrated] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const busyRef = React.useRef(false)
  const mountedRef = React.useRef(false)
  const titleRef = React.useRef<HTMLHeadingElement>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [version, setVersion] = React.useState(0)
  const options = React.useRef(
    new Map<string, { promise: Promise<TransferEnvelope[]>; controller: AbortController }>(),
  )
  React.useEffect(() => {
    mountedRef.current = true
    try {
      const saved = readPendingTransfer(userId)
      setPending(saved)
      if (saved) requestAnimationFrame(() => titleRef.current?.focus())
      if (saved)
        setDraft({
          date: saved.payload.date,
          description: saved.payload.description,
          fromAccount: String(saved.payload.from.accountId),
          fromEnvelope: String(saved.payload.from.envelopeId),
          toAccount: String(saved.payload.to.accountId),
          toEnvelope: String(saved.payload.to.envelopeId),
          amount: String(saved.payload.amount),
        })
    } catch {
      setRecoveryError(true)
    }
    setHydrated(true)
    const cache = options.current
    return () => {
      mountedRef.current = false
      for (const entry of cache.values()) entry.controller.abort()
      cache.clear()
    }
  }, [userId])
  const load = React.useCallback<LoadOptions>((accountId) => {
    const existing = options.current.get(accountId)
    if (existing) return existing.promise
    const controller = new AbortController()
    const promise = fetch(`/api/reports/envelope-balances?accountId=${accountId}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw Error()
        const rows: unknown = await response.json()
        if (!Array.isArray(rows)) throw Error()
        return rows
          .filter(
            (row) =>
              Number.isSafeInteger(row.envelopeId) &&
              row.envelopeId > 0 &&
              typeof row.categoryName === "string",
          )
          .map((row) => ({ id: row.envelopeId as number, name: row.categoryName as string }))
      })
      .catch((error) => {
        if (options.current.get(accountId)?.controller === controller)
          options.current.delete(accountId)
        throw error
      })
    options.current.set(accountId, { promise, controller })
    return promise
  }, [])
  const from = useEnvelopes(pending ? "" : draft.fromAccount, load, version)
  const to = useEnvelopes(pending ? "" : draft.toAccount, load, version)
  const state = transferState(draft, accounts, from.items, to.items)
  const refresh = () => {
    for (const entry of options.current.values()) entry.controller.abort()
    options.current.clear()
    setVersion((v) => v + 1)
    onRefreshAccounts()
  }
  const record =
    state.ready && !accountsLoading && !from.loading && !to.loading && !from.error && !to.error
      ? {
          payload: {
            userId,
            requestId: "",
            date: draft.date,
            description: draft.description.trim(),
            from: { accountId: state.from!.id, envelopeId: state.source!.id },
            to: { accountId: state.to!.id, envelopeId: state.destination!.id },
            amount: state.amount!,
          },
          currency: state.from!.currency,
          fromLabel: `${state.from!.name} · ${state.source!.name}`,
          toLabel: `${state.to!.name} · ${state.destination!.name}`,
        }
      : null

  const submit = async () => {
    if (busyRef.current || recoveryError || !hydrated || (!pending && !record)) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    let current: PendingTransfer
    try {
      current = pending ?? {
        ...record!,
        payload: { ...record!.payload, requestId: transferRequestId() },
      }
      savePendingTransfer(current)
    } catch {
      setError(
        "No pudimos conservar el intento de transferencia en esta pestaña. La operación no se envió. Revisa el almacenamiento del navegador y vuelve a intentar.",
      )
      busyRef.current = false
      setBusy(false)
      return
    }
    setPending(current)
    onPendingChange(true)
    try {
      const response = await fetch("/api/transfers", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(current.payload),
      }).catch(() => {
        throw Error(
          "La conexión se interrumpió. Reintenta para confirmar el resultado sin duplicar la transferencia.",
        )
      })
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null)
        if (!mountedRef.current) return
        const code = (body as { error?: { code?: string } } | null)?.error?.code
        const message = publicErrorMessage(
          body,
          "No pudimos confirmar la transferencia. Puedes reintentar sin duplicarla.",
        )
        // Only known pre-write rejections release the intent. Proxy timeouts and
        // unknown 4xx/5xx may hide a commit, so retain the immutable request key.
        if (
          (response.status >= 400 &&
            response.status < 500 &&
            ["VALIDATION_ERROR", "FORBIDDEN", "NOT_FOUND", "INACTIVE_RESOURCE"].includes(
              code ?? "",
            )) ||
          (response.status === 503 && code === "FEATURE_NOT_READY")
        ) {
          clearPendingTransfer(userId)
          setPending(null)
          onPendingChange(false)
          refresh()
        }
        throw Error(message)
      }
      const result = await response.json().catch(() => {
        throw Error(
          "No recibimos una confirmación válida. Reintenta para recuperar el resultado sin duplicar la transferencia.",
        )
      })
      if (!mountedRef.current) return
      if (!isTransferConfirmation(current, result))
        throw Error(
          "No recibimos una confirmación válida. Reintenta para recuperar el resultado sin duplicar la transferencia.",
        )
      clearPendingTransfer(userId)
      setPending(null)
      onPendingChange(false)
      onConfirmed()
    } catch (cause) {
      if (!mountedRef.current) return
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "La conexión se interrumpió. Reintenta para confirmar el resultado sin duplicar la transferencia.",
      )
    } finally {
      busyRef.current = false
      if (mountedRef.current) setBusy(false)
    }
  }

  const endpoint = (side: "from" | "to") => {
    const source = side === "from",
      accountKey = source ? "fromAccount" : "toAccount",
      envelopeKey = source ? "fromEnvelope" : "toEnvelope",
      values = source ? from : to
    return (
      <fieldset className="min-w-0 space-y-4 rounded-xl border p-4 sm:p-5">
        <legend className="px-2 text-base font-semibold">{source ? "Desde" : "Hacia"}</legend>
        <AccessibleField className="min-w-0 space-y-2">
          <Label htmlFor={`transfer-${side}-account`}>
            Cuenta de {source ? "origen" : "destino"}
          </Label>
          <SearchableSelect
            id={`transfer-${side}-account`}
            options={accounts.map((a) => ({
              value: String(a.id),
              label: `${a.name} · ${a.currency}`,
            }))}
            value={draft[accountKey]}
            onValueChange={(value) => {
              setError(null)
              setDraft((d) => ({
                ...d,
                [accountKey]: value,
                [envelopeKey]: "",
                ...(source &&
                accounts.find((a) => String(a.id) === d.fromAccount)?.currency !==
                  accounts.find((a) => String(a.id) === value)?.currency
                  ? { amount: "" }
                  : {}),
              }))
            }}
            disabled={accountsLoading || !hydrated}
            placeholder={accountsLoading ? "Cargando cuentas…" : "Elige una cuenta"}
            searchLabel={`Buscar cuenta de ${source ? "origen" : "destino"}`}
          />
          <AccessibleFieldError className="text-sm text-error">
            {!source ? state.currencyError : null}
          </AccessibleFieldError>
        </AccessibleField>
        <AccessibleField className="min-w-0 space-y-2">
          <Label htmlFor={`transfer-${side}-envelope`}>
            Sobre de {source ? "origen" : "destino"}
          </Label>
          <SearchableSelect
            id={`transfer-${side}-envelope`}
            options={values.items.map((e) => ({ value: String(e.id), label: e.name }))}
            value={draft[envelopeKey]}
            onValueChange={(value) => {
              setError(null)
              setDraft((d) => ({ ...d, [envelopeKey]: value }))
            }}
            disabled={!draft[accountKey] || values.loading || !hydrated}
            placeholder={
              values.loading
                ? "Cargando sobres…"
                : draft[accountKey] && !values.error && values.items.length === 0
                  ? "Esta cuenta no tiene sobres"
                  : "Elige un sobre"
            }
            searchLabel={`Buscar sobre de ${source ? "origen" : "destino"}`}
          />
          <AccessibleFieldError className="text-sm text-error">
            {values.error ?? (!source ? state.destinationError : null)}
          </AccessibleFieldError>
        </AccessibleField>
      </fieldset>
    )
  }

  return (
    <>
      <DialogHeader className="min-w-0 pr-0 [overflow-wrap:anywhere]">
        <DialogTitle ref={titleRef} tabIndex={-1} className="pr-8">
          Transferencia
        </DialogTitle>
        <DialogDescription>
          Mueve dinero entre cuentas o sobres de la misma moneda. Indica cuánto quieres trasladar;
          calculamos la salida y la entrada.
        </DialogDescription>
      </DialogHeader>
      <div className="min-w-0 space-y-5 py-2 [overflow-wrap:anywhere]">
        {error && (
          <Feedback tone="error" title="Revisa la transferencia">
            {error}
          </Feedback>
        )}
        {recoveryError ? (
          <Feedback tone="warning" title="Hay una transferencia pendiente de revisar">
            No pudimos recuperar el intento guardado en esta pestaña. Revisa tus movimientos antes
            de iniciar otra transferencia.
          </Feedback>
        ) : pending ? (
          <>
            <Feedback
              tone="warning"
              title={busy ? "Guardando transferencia…" : "Transferencia por confirmar"}
            >
              Conservamos los datos del intento. Al reintentar, recuperaremos el resultado si ya se
              guardó, sin crear otra operación.
            </Feedback>
            <p className="text-sm text-muted-foreground">
              Fecha: {formatIsoDateOnly(pending.payload.date)} · {pending.payload.description}
            </p>
            <TransferSummary record={pending} />
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <AccessibleField className="min-w-0 space-y-2">
                <Label htmlFor="transfer-date">Fecha</Label>
                <Input
                  id="transfer-date"
                  autoFocus
                  type="date"
                  className="min-w-0 px-1"
                  value={draft.date}
                  onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                />
              </AccessibleField>
              <AccessibleField className="min-w-0 space-y-2">
                <Label htmlFor="transfer-type">Tipo</Label>
                <Select
                  value="TRANSFER"
                  onValueChange={(value) =>
                    onTypeChange(value as "INCOME" | "EXPENSE" | "ADJUSTMENT")
                  }
                >
                  <SelectTrigger id="transfer-type" className="w-full min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INCOME">Ingreso</SelectItem>
                    <SelectItem value="EXPENSE">Gasto</SelectItem>
                    <SelectItem value="TRANSFER">Transferencia</SelectItem>
                    <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                  </SelectContent>
                </Select>
              </AccessibleField>
            </div>
            <AccessibleField className="space-y-2">
              <Label htmlFor="transfer-description">Descripción</Label>
              <Input
                id="transfer-description"
                value={draft.description}
                maxLength={1000}
                placeholder="Por ejemplo, ahorro del mes"
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </AccessibleField>
            {accountsError && (
              <Feedback tone="error" title="Cuentas no disponibles">
                {accountsError}
              </Feedback>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {endpoint("from")}
              {endpoint("to")}
            </div>
            {(from.error || to.error || accountsError) && (
              <Button type="button" variant="outline" onClick={refresh}>
                Volver a cargar opciones
              </Button>
            )}
            <AccessibleField className="space-y-2">
              <Label htmlFor="transfer-amount">
                Importe{state.from ? ` en ${state.from.currency}` : " positivo"}
              </Label>
              <Input
                id="transfer-amount"
                type="text"
                inputMode="decimal"
                value={draft.amount}
                disabled={!state.from}
                placeholder="0.00"
                aria-describedby="transfer-amount-help"
                className="text-lg tabular-nums"
                onChange={(e) => {
                  setError(null)
                  setDraft((d) => ({ ...d, amount: e.target.value }))
                }}
              />
              <p id="transfer-amount-help" className="text-sm text-muted-foreground">
                Escribe el importe sin signo ni separadores de miles. Usa punto decimal; por
                ejemplo, 1234.56.
              </p>
              <AccessibleFieldError className="text-sm text-error">
                {state.amountError}
              </AccessibleFieldError>
            </AccessibleField>
            {record ? (
              <TransferSummary record={record} />
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ArrowRightLeft aria-hidden="true" className="size-4 shrink-0" />
                Completa el origen, destino e importe para revisar la transferencia.
              </p>
            )}
          </>
        )}
      </div>
      <DialogFooter className="min-w-0">
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
          {pending ? "Cerrar y revisar después" : "Cancelar"}
        </Button>
        <Button
          type="button"
          loading={busy}
          disabled={!hydrated || recoveryError || (!pending && !record) || busy}
          onClick={() => void submit()}
        >
          {busy
            ? "Guardando transferencia"
            : pending
              ? "Reintentar transferencia"
              : "Guardar transferencia"}
        </Button>
      </DialogFooter>
    </>
  )
}
