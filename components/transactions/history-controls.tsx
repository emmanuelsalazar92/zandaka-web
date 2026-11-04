"use client"

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { historyPageSizes, type HistoryMeta } from "@/lib/transaction-history"

export function AppliedHistoryFilters({
  filters,
  onRemove,
  onClear,
}: {
  filters: Array<{ key: string; label: string }>
  onRemove: (key: string) => void
  onClear: () => void
}) {
  if (!filters.length)
    return <p className="text-sm text-muted-foreground">Sin filtros aplicados.</p>
  return (
    <section aria-label="Filtros aplicados" className="min-w-0 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Filtros aplicados · {filters.length}
      </p>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {filters.map((filter) => (
          <Button
            key={filter.key}
            variant="outline"
            className="h-auto min-h-control min-w-0 max-w-full justify-start text-left text-xs"
            aria-label={`Quitar filtro ${filter.label}`}
            onClick={() => onRemove(filter.key)}
          >
            <span className="min-w-0 [overflow-wrap:anywhere]">{filter.label}</span>
            <X aria-hidden="true" className="size-3 shrink-0" />
          </Button>
        ))}
        <Button variant="ghost" onClick={onClear}>
          Quitar filtros
        </Button>
      </div>
    </section>
  )
}

export function HistoryPagination({
  meta,
  count,
  pageSize,
  busy,
  onPage,
  onPageSize,
}: {
  meta: HistoryMeta
  count: number
  pageSize: number
  busy: boolean
  onPage: (page: number) => void
  onPageSize: (pageSize: number) => void
}) {
  const page = meta.page,
    total = Math.max(meta.totalPages, 1)
  const first = count ? (page - 1) * pageSize + 1 : 0
  const navigation = React.useRef<HTMLElement>(null)
  const focusTarget = React.useRef<HTMLButtonElement | null>(null)
  const focusPending = React.useRef(false)
  React.useEffect(() => {
    if (busy || !focusPending.current) return
    focusPending.current = false
    // Native disabled controls can move focus to body while awaiting a page.
    // Restore only our own action; never steal focus from another task.
    if (document.activeElement !== document.body && document.activeElement !== focusTarget.current)
      return
    const target = focusTarget.current
    const fallback =
      navigation.current?.querySelector<HTMLButtonElement>(
        'button[aria-label="Página siguiente"]:not(:disabled), button[aria-label="Página anterior"]:not(:disabled)',
      ) ?? navigation.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")
    ;(target?.isConnected && !target.disabled ? target : fallback)?.focus({ preventScroll: true })
  }, [busy, page, pageSize])
  const changePage = (value: number) => {
    focusPending.current = true
    onPage(value)
  }
  return (
    <nav
      ref={navigation}
      onFocusCapture={(event) => {
        if (event.target instanceof HTMLButtonElement && navigation.current?.contains(event.target))
          focusTarget.current = event.target
      }}
      aria-label="Paginación de movimientos"
      className="flex min-w-0 flex-wrap items-center justify-between gap-4 border-t pt-4 text-sm"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <label htmlFor="history-page-size" className="text-muted-foreground">
          Movimientos por página
        </label>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => {
            focusTarget.current =
              navigation.current?.querySelector<HTMLButtonElement>("#history-page-size") ?? null
            focusPending.current = true
            onPageSize(Number(value))
          }}
        >
          <SelectTrigger
            id="history-page-size"
            aria-label="Movimientos por página"
            className="min-w-0 w-24 max-w-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {historyPageSizes.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <p className="text-muted-foreground">
          {busy
            ? "Actualizando…"
            : `${first}–${count ? first + count - 1 : 0} de ${meta.totalItems}`}
        </p>
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <Button
            variant="ghost"
            className="size-control p-0"
            aria-label="Primera página"
            disabled={busy || page <= 1}
            onClick={() => changePage(1)}
          >
            <ChevronsLeft aria-hidden="true" className="size-4" />
          </Button>
          <Button
            variant="ghost"
            className="size-control p-0"
            aria-label="Página anterior"
            disabled={busy || page <= 1}
            onClick={() => changePage(page - 1)}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Button>
          <span className="px-1">{busy ? "Actualizando…" : `Página ${page} de ${total}`}</span>
          <Button
            variant="ghost"
            className="size-control p-0"
            aria-label="Página siguiente"
            disabled={busy || page >= total}
            onClick={() => changePage(page + 1)}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
          <Button
            variant="ghost"
            className="size-control p-0"
            aria-label="Última página"
            disabled={busy || page >= total}
            onClick={() => changePage(total)}
          >
            <ChevronsRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>
    </nav>
  )
}
