"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { z } from "zod"

import type { BudgetPlanDocument } from "@/lib/budget-plan"
import {
  fundPlan,
  getPlan,
  PlanApiError,
  planDocumentSchema,
  planRequest,
  savePlan,
  transitionPlan,
  type PlanOptions,
  type SavedBudgetPlan,
} from "@/lib/budget-plan-api"
import { getAccountingDate } from "@/lib/date-only"
import { secureUuid } from "@/lib/uuid"

type Intent = {
  kind: "save" | "finalize" | "reopen" | "fund"
  revision: number
  document: BudgetPlanDocument
  requestId: string
  date: string
}
type Cache = {
  id: string
  baseRevision: number
  document: BudgetPlanDocument
  pending: Intent | null
}
const intentSchema = z.object({
  kind: z.enum(["save", "finalize", "reopen", "fund"]),
  revision: z.number().int().min(0),
  document: planDocumentSchema,
  requestId: z.string().uuid(),
  date: z.string().regex(/^20\d{2}-\d{2}-\d{2}$/),
})
const cacheSchema = z.object({
  id: z.string().uuid(),
  baseRevision: z.number().int().min(0),
  document: planDocumentSchema,
  pending: intentSchema.nullable(),
})
const emptyOptions: PlanOptions = { accounts: [], envelopes: [] }
export function newPlanDocument(): BudgetPlanDocument {
  return {
    version: 1,
    month: getAccountingDate().slice(0, 7),
    incomeMonth: "",
    incomeMode: "net",
    income: { net: "", gross: "", ccss: "", tax: "", q1: "", q2: "" },
    exchange: { source: "", date: getAccountingDate(), buy: "", sell: "", margin: "2" },
    incomeAccountId: null,
    retainedAccountId: null,
    sources: [],
    lines: [],
  }
}
const equivalent = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function useBudgetPlan(planId: string) {
  const router = useRouter(),
    key = `zandaka.budget-plan.v1.1.${planId}`
  const [id, setId] = React.useState(""),
    [document, setDocument] = React.useState<BudgetPlanDocument | null>(null),
    [saved, setSaved] = React.useState<SavedBudgetPlan | null>(null),
    [options, setOptions] = React.useState(emptyOptions),
    [loading, setLoading] = React.useState(true),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState<string | null>(null),
    [pending, setPending] = React.useState<Intent | null>(null),
    [recovery, setRecovery] = React.useState<BudgetPlanDocument | null>(null),
    [storageError, setStorageError] = React.useState(false)
  const mounted = React.useRef(false)
  const cache = React.useCallback(
    (value: Cache) => {
      try {
        sessionStorage.setItem(key, JSON.stringify(value))
        setStorageError(false)
        return true
      } catch {
        setStorageError(true)
        return false
      }
    },
    [key],
  )
  const dirty =
    !!document &&
    (saved
      ? !equivalent(document, saved.document)
      : document.lines.length > 0 ||
        !!document.incomeMonth ||
        Object.values(document.income).some(Boolean) ||
        !!document.exchange.source ||
        !!document.exchange.buy ||
        !!document.exchange.sell)
  const accept = React.useCallback((result: SavedBudgetPlan) => {
    if (!mounted.current) return
    setSaved(result)
    setDocument(result.document)
    setId(result.id)
    setPending(null)
    setRecovery(null)
    setError(null)
  }, [])
  const load = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      setError(null)
      let cached: Cache | null = null
      try {
        const raw = sessionStorage.getItem(key)
        if (raw) {
          const parsed = cacheSchema.safeParse(JSON.parse(raw))
          if (parsed.success) cached = parsed.data as Cache
        }
      } catch {
        setStorageError(true)
      }
      try {
        const selectedId = planId === "new" ? (cached?.id ?? secureUuid()) : planId
        if (cached && cached.id !== selectedId) cached = null
        if (!z.string().uuid().safeParse(selectedId).success)
          throw new Error("No encontramos este presupuesto.")
        let result: SavedBudgetPlan | null = null
        if (planId !== "new" || cached?.pending || (cached?.baseRevision ?? 0) > 0) {
          try {
            result = await getPlan(selectedId, signal)
          } catch (cause) {
            if (!(planId === "new" && cause instanceof PlanApiError && cause.status === 404))
              throw cause
          }
        }
        if (signal?.aborted || !mounted.current) return
        setId(selectedId)
        setSaved(result)
        const operation = cached?.pending ?? null
        const confirmed =
          result &&
          operation &&
          ((operation.kind === "save" &&
            result.revision > operation.revision &&
            equivalent(result.document, operation.document)) ||
            (operation.kind === "fund" &&
              result.receipt?.requestId === operation.requestId &&
              result.receipt.revision === operation.revision &&
              result.receipt.date === operation.date) ||
            (operation.kind === "finalize" &&
              result.status === "finalized" &&
              result.revision === operation.revision + 1) ||
            (operation.kind === "reopen" &&
              result.status === "draft" &&
              result.revision === operation.revision + 1))
        if (confirmed && result) {
          accept(result)
        } else if (operation) {
          setPending(operation)
          setDocument(operation.document)
          setError(
            "Hay un intento pendiente de confirmar. Consulta su resultado o reintenta el mismo intento.",
          )
        } else if (
          cached &&
          cached.baseRevision === (result?.revision ?? 0) &&
          (!result || result.status === "draft")
        ) {
          setDocument(cached.document)
          setPending(null)
        } else {
          setDocument(result?.document ?? newPlanDocument())
          setPending(null)
          if (cached && !equivalent(cached.document, result?.document)) setRecovery(cached.document)
        }
        const loaded = await planRequest<PlanOptions>("/options", "GET", undefined, signal)
        if (!Array.isArray(loaded.accounts) || !Array.isArray(loaded.envelopes))
          throw new Error("No pudimos consultar las cuentas y sobres.")
        if (!signal?.aborted && mounted.current) setOptions(loaded)
      } catch (cause) {
        if (!signal?.aborted && mounted.current)
          setError(cause instanceof Error ? cause.message : "No pudimos consultar el presupuesto.")
      } finally {
        if (!signal?.aborted && mounted.current) setLoading(false)
      }
    },
    [accept, key, planId],
  )
  React.useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    void load(controller.signal)
    return () => {
      mounted.current = false
      controller.abort()
    }
  }, [load])
  React.useEffect(() => {
    if (!document || !id || loading || recovery) return
    if (planId === "new" && saved && !pending) return
    cache({ id, baseRevision: saved?.revision ?? 0, document, pending })
  }, [cache, document, id, loading, pending, recovery, saved, planId])
  React.useEffect(() => {
    if (!dirty && !pending) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty, pending])
  const perform = async (intent: Intent) => {
    if (busy || !id) return
    if (!cache({ id, baseRevision: intent.revision, document: intent.document, pending: intent })) {
      setError(
        "No pudimos conservar el intento en esta pestaña. Habilita el almacenamiento del navegador antes de guardar o aplicar.",
      )
      return
    }
    setBusy(true)
    setPending(intent)
    setError(null)
    try {
      const result =
        intent.kind === "save"
          ? await savePlan(id, intent.revision, intent.document)
          : intent.kind === "fund"
            ? await fundPlan(id, intent.revision, intent.requestId, intent.date)
            : await transitionPlan(id, intent.revision, intent.kind)
      cache({ id, baseRevision: result.revision, document: result.document, pending: null })
      accept(result)
      if (planId === "new" && mounted.current) {
        sessionStorage.removeItem(key)
        router.replace(`/budgets/plans/${id}`)
      }
    } catch (cause) {
      const uncertain = !(cause instanceof PlanApiError) || cause.uncertain
      if (mounted.current) {
        setError(cause instanceof Error ? cause.message : "No pudimos confirmar la operación.")
        if (!uncertain) setPending(null)
      }
      if (!uncertain)
        cache({ id, baseRevision: intent.revision, document: intent.document, pending: null })
    } finally {
      if (mounted.current) setBusy(false)
    }
  }
  const act = (kind: Intent["kind"], date = getAccountingDate()) => {
    if (!document || busy || pending) return
    const clean = {
      ...document,
      exchange: { ...document.exchange, source: document.exchange.source.trim() },
      lines: document.lines.map((l) => ({ ...l, name: l.name.trim() })),
    }
    void perform({
      kind,
      document: clean,
      revision: saved?.revision ?? 0,
      requestId: secureUuid(),
      date,
    })
  }
  return {
    id,
    document,
    setDocument,
    saved,
    options,
    loading,
    busy,
    error,
    setError,
    pending,
    recovery,
    storageError,
    dirty,
    locked:
      busy ||
      !!pending ||
      !!recovery ||
      saved?.status === "finalized" ||
      saved?.status === "funded",
    act,
    retry: () => {
      if (pending) void perform(pending)
    },
    reload: () => {
      void load()
    },
    recover: () => {
      if (recovery && saved?.status === "draft") {
        setDocument(recovery)
        setRecovery(null)
      }
    },
    discardRecovery: () => setRecovery(null),
  }
}
