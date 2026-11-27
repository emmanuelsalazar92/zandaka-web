import * as React from "react"

type ReadResult<T> = { data: T; error?: never } | { data?: never; error: unknown }

export function useProjectRead<T>(load: (signal: AbortSignal) => Promise<T>, revision?: number) {
  const [attempt, retry] = React.useReducer((value: number) => value + 1, 0)
  const [response, setResponse] = React.useState<{
    load: typeof load
    attempt: number
    revision?: number
    result: ReadResult<T>
  }>()

  React.useEffect(() => {
    const controller = new AbortController()
    const settle = (result: ReadResult<T>) => {
      if (!controller.signal.aborted) setResponse({ load, attempt, revision, result })
    }
    void load(controller.signal).then(
      (data) => settle({ data }),
      (error: unknown) => settle({ error }),
    )
    return () => controller.abort()
  }, [load, attempt, revision])

  const result =
    response?.load === load && response.attempt === attempt && response.revision === revision
      ? response.result
      : undefined
  const replace = (data: T) => setResponse({ load, attempt, revision, result: { data } })
  return { result, retry, replace }
}
