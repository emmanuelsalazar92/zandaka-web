"use client"

import * as React from "react"

/** Queries are scoped by account/date/id, cancelled and never silently retried. */
export function useReconciliationRead<T>(
  key: string | null,
  load: (signal: AbortSignal) => Promise<T>,
) {
  const [revision, reload] = React.useReducer((value: number) => value + 1, 0)
  const scoped = `${key}:${revision}`
  const [state, setState] = React.useState<{
    key: string
    data: T | null
    error: string | null
    loading: boolean
  }>({ key: "", data: null, error: null, loading: true })
  React.useEffect(() => {
    if (key === null) return
    const controller = new AbortController()
    let active = true
    void load(controller.signal)
      .then((data) => {
        if (active) setState({ key: scoped, data, error: null, loading: false })
      })
      .catch(() => {
        if (active)
          setState({
            key: scoped,
            data: null,
            error: "No pudimos verificar esta información. Vuelve a intentar.",
            loading: false,
          })
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [key, scoped, load])
  if (key === null) return { data: null, error: null, loading: false, reload }
  return { ...(state.key === scoped ? state : { data: null, error: null, loading: true }), reload }
}
