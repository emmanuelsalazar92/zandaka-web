"use client"

import * as React from "react"

import { fetchDashboardPeriod, type DashboardPeriod } from "@/lib/dashboard-api"

export function useDashboardPeriod(month: string) {
  const [attempt, setAttempt] = React.useState(0)
  const key = `${month}:${attempt}`
  const [result, setResult] = React.useState<{ key: string; data: DashboardPeriod } | null>(null)
  React.useEffect(() => {
    let active = true
    const controller = new AbortController()
    void fetchDashboardPeriod(month, controller.signal)
      .then((data) => {
        if (active) setResult({ key, data })
      })
      .catch(() => {
        if (active) setResult({ key, data: { expenses: null, transactions: null } })
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [month, key])
  return {
    data: result?.key === key ? result.data : null,
    loading: result?.key !== key,
    reload: () => setAttempt((value) => value + 1),
  }
}
