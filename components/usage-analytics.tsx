"use client"

import { inject, track } from "@vercel/analytics"
import { usePathname } from "next/navigation"
import * as React from "react"

import {
  createUsageTask,
  safeUsageEvent,
  usageScreen,
  type UsageSink,
  type UsageTask,
} from "@/lib/usage-events"

export const UsageContext = React.createContext<UsageSink | null>(null)

function privacyDisabled() {
  return Boolean(
    document.referrer ||
    navigator.doNotTrack === "1" ||
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl,
  )
}

/** Drop auto views; custom events use a constant URL, never the current resource path/query. */
export function redactUsageUrl(event: { type: "event" | "pageview"; url: string }) {
  if (event.type !== "event") return null
  try {
    const url = new URL(event.url)
    return { ...event, url: `${url.origin}/usage` }
  } catch {
    return null
  }
}

export function UsageAnalytics({
  enabled,
  children,
}: {
  enabled: boolean
  children: React.ReactNode
}) {
  const [sink, setSink] = React.useState<UsageSink | null>(null)
  const pathname = usePathname()
  const previous = React.useRef<string | null>(null)
  React.useEffect(() => {
    // v1.3.1 does not expose referrer redaction. Exclude referred loads entirely.
    if (!enabled || privacyDisabled()) return
    let live = true
    try {
      inject({
        mode: "production",
        disableAutoTrack: true,
        beforeSend: (event) => (privacyDisabled() ? null : redactUsageUrl(event)),
        debug: false,
      })
    } catch {
      return
    }
    const script = document.querySelector<HTMLScriptElement>(
      'script[src="/_vercel/insights/script.js"]',
    )
    const ready = () => {
      if (!live) return
      setSink(() => (event: unknown) => {
        if (!live || privacyDisabled()) return
        const safe = safeUsageEvent(event)
        if (safe) {
          try {
            track(`za_${safe.name}`, safe.data)
          } catch {
            /* No retry queue. */
          }
        }
      })
    }
    script?.addEventListener("load", ready, { once: true })
    return () => {
      live = false
      script?.removeEventListener("load", ready)
    }
  }, [enabled])
  React.useEffect(() => {
    if (!sink || !pathname || previous.current === pathname) return
    previous.current = pathname
    sink({ name: "screen_view", data: { screen: usageScreen(pathname) } })
  }, [pathname, sink])
  return <UsageContext.Provider value={enabled ? sink : null}>{children}</UsageContext.Provider>
}

export function useUsageTask(task: UsageTask, active = true) {
  const sink = React.useContext(UsageContext)
  const tracker = React.useMemo(() => createUsageTask(task, sink ?? (() => {})), [task, sink])
  const generation = React.useRef(0)
  const previousSink = React.useRef(sink)
  React.useEffect(() => {
    const token = ++generation.current
    const isCurrent = () => generation.current === token
    const sourceChanged = previousSink.current !== sink
    previousSink.current = sink
    // React StrictMode rehearses effects. Only the surviving setup/cleanup emits.
    queueMicrotask(() => {
      if (isCurrent() && active && sink && !sourceChanged) tracker.start()
    })
    const leave = () => tracker.leave()
    if (active && sink) window.addEventListener("pagehide", leave)
    return () => {
      window.removeEventListener("pagehide", leave)
      queueMicrotask(() => {
        if (isCurrent()) tracker.leave()
      })
    }
  }, [active, sink, tracker])
  React.useEffect(() => {
    if (!active) tracker.leave()
  }, [active, tracker])
  return tracker
}
