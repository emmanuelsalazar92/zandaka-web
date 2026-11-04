"use client"

import * as React from "react"

import {
  emptyHistoryMeta,
  historyQuery,
  historyResultLabel,
  parseHistory,
  type HistoryFilters,
  type HistoryMeta,
  type HistoryTransaction,
} from "@/lib/transaction-history"

type Result = {
  key: string
  data: HistoryTransaction[]
  meta: HistoryMeta
  loading: boolean
  error: string | null
}

export function useTransactionHistory(
  filters: HistoryFilters,
  page: number,
  pageSize: number,
  userId: number,
  reload: number,
) {
  const query = historyQuery(filters, page, pageSize, userId)
  const key = `${query}:${reload}`
  const [result, setResult] = React.useState<Result>({
    key: "",
    data: [],
    meta: emptyHistoryMeta,
    loading: true,
    error: null,
  })
  React.useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeout = setTimeout(() => controller.abort(), 15_000)
    async function load() {
      try {
        const response = await fetch(`/api/transactions?${query}`, {
          signal: controller.signal,
          cache: "no-store",
          headers: { Accept: "application/json" },
        })
        if (!response.ok) throw new Error("History unavailable")
        const parsed = parseHistory(await response.json(), page, pageSize, userId)
        if (active) setResult({ key, ...parsed, loading: false, error: null })
      } catch {
        if (active)
          setResult({
            key,
            data: [],
            meta: emptyHistoryMeta,
            loading: false,
            error:
              "No pudimos cargar los movimientos. Tus filtros se conservan; vuelve a intentar.",
          })
      } finally {
        clearTimeout(timeout)
      }
    }
    void load()
    return () => {
      active = false
      controller.abort()
      clearTimeout(timeout)
    }
  }, [query, key, page, pageSize, userId])
  const current =
    result.key === key
      ? result
      : { key, data: [], meta: emptyHistoryMeta, loading: true, error: null }
  const announcement = current.loading
    ? `Cargando página ${page}, hasta ${pageSize} movimientos por página.`
    : current.error
      ? current.error
      : historyResultLabel(current.meta, current.data.length)
  return { ...current, announcement, previousMeta: result.meta, previousCount: result.data.length }
}
