"use client"

import * as React from "react"

/** Independent, keyed read; a previous account never appears under a new heading. */
export function useContextRead<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = React.useState(0)
  const current = key === null ? null : `${key}:${attempt}`
  const [result, setResult] = React.useState<{
    key: string
    data: T | null
    error: string | null
  } | null>(null)
  React.useEffect(() => {
    if (current === null) return
    let active = true
    const controller = new AbortController()
    void load(controller.signal)
      .then((data) => {
        if (active) setResult({ key: current, data, error: null })
      })
      .catch(() => {
        if (active)
          setResult({
            key: current,
            data: null,
            error:
              "No pudimos verificar esta información. Vuelve a consultar sin cambiar tus datos.",
          })
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [current, load])
  const matching = result?.key === current
  return {
    data: matching ? result!.data : null,
    error: matching ? result!.error : null,
    loading: current !== null && !matching,
    reload: () => setAttempt((value) => value + 1),
  }
}
