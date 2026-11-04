"use client"

import * as React from "react"

import type { EnvelopeOptions, MovementEnvelope } from "@/lib/movement-draft"

/** Shared across the lines of one open composer. Failed requests wait for explicit retry. */
export function useEnvelopeOptions() {
  const [options, setOptions] = React.useState<Record<string, EnvelopeOptions>>({})
  const requests = React.useRef(
    new Map<string, { controller: AbortController; promise: Promise<void> }>(),
  )
  React.useEffect(() => {
    const cache = requests.current
    return () => {
      for (const r of cache.values()) r.controller.abort()
      cache.clear()
    }
  }, [])
  const load = React.useCallback((accountId: string, retry = false) => {
    const cached = requests.current.get(accountId)
    if (cached && !retry) return cached.promise
    cached?.controller.abort()
    const controller = new AbortController()
    setOptions((o) => ({ ...o, [accountId]: { status: "loading", items: [] } }))
    const promise = fetch(
      `/api/reports/envelope-balances?accountId=${encodeURIComponent(accountId)}`,
      { headers: { Accept: "application/json" }, signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw Error()
        const data: unknown = await response.json()
        if (!Array.isArray(data)) throw Error()
        if (
          !data.every(
            (e) =>
              e &&
              Number.isSafeInteger(e.envelopeId) &&
              e.envelopeId > 0 &&
              typeof e.categoryName === "string",
          )
        )
          throw Error()
        const items: MovementEnvelope[] = data
          .filter(
            (e) =>
              e &&
              Number.isSafeInteger(e.envelopeId) &&
              e.envelopeId > 0 &&
              typeof e.categoryName === "string",
          )
          .map((e) => ({ id: e.envelopeId, name: e.categoryName }))
        if (
          requests.current.get(accountId)?.controller === controller &&
          !controller.signal.aborted
        )
          setOptions((o) => ({ ...o, [accountId]: { status: "ready", items } }))
      })
      .catch(() => {
        if (
          requests.current.get(accountId)?.controller === controller &&
          !controller.signal.aborted
        )
          setOptions((o) => ({ ...o, [accountId]: { status: "error", items: [] } }))
      })
    requests.current.set(accountId, { controller, promise })
    return promise
  }, [])
  return { options, load }
}
