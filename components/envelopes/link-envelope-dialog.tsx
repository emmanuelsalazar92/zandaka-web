"use client"

import { Plus } from "lucide-react"
import * as React from "react"

import { useContextRead } from "@/components/accounts/hooks/use-context-read"
import type { AccountUi } from "@/components/accounts/types/accounts.types"
import { CategoryQuickCreate } from "@/components/envelopes/category-quick-create"
import { AccessibleField } from "@/components/ui/accessible-field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Feedback } from "@/components/ui/feedback"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import {
  contextRead,
  contextWrite,
  ContextWriteError,
  parseContextCategories,
  type ContextCategory,
  type ContextEnvelope,
} from "@/lib/account-context"

const loadCategories = async (signal: AbortSignal) =>
  parseContextCategories(await contextRead("/categories?activeOnly=true", signal))
export function LinkEnvelopeDialog({
  account,
  envelopes,
  disabled,
  onLinked,
}: {
  account: AccountUi
  envelopes: ContextEnvelope[]
  disabled: boolean
  onLinked: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const catalog = useContextRead(open ? "categories" : null, loadCategories)
  const [created, setCreated] = React.useState<ContextCategory[]>([])
  const [selected, setSelected] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [quickBusy, setQuickBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [uncertain, setUncertain] = React.useState(false)
  const lock = React.useRef(false)
  const categories = [...(catalog.data ?? []), ...created].filter(
    (row, index, all) => all.findIndex((item) => item.id === row.id) === index,
  )
  const options = categories.filter(
    (row) =>
      row.parentId !== null &&
      !categories.some((child) => child.parentId === row.id) &&
      !envelopes.some((envelope) => envelope.categoryId === row.id),
  )
  const link = async () => {
    if (lock.current || uncertain || !options.some((row) => row.id === Number(selected))) return
    lock.current = true
    setBusy(true)
    setError(null)
    try {
      await contextWrite(`/accounts/${account.id}/envelopes`, "POST", {
        categoryId: Number(selected),
      })
      setOpen(false)
      setSelected("")
      onLinked()
    } catch (error) {
      setError(error instanceof Error ? error.message : "No pudimos vincular el sobre.")
      if (error instanceof ContextWriteError && error.uncertain) setUncertain(true)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy && !quickBusy) {
          setOpen(value)
          setError(null)
          if (!value) setSelected("")
        }
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={disabled}>
          <Plus aria-hidden="true" className="size-4" />
          Vincular categoría
        </Button>
      </DialogTrigger>
      <DialogContent className="marea-surface">
        <DialogHeader>
          <DialogTitle>Vincular categoría a la cuenta</DialogTitle>
          <DialogDescription>
            Crea un sobre en {account.name} · {account.currency}. No se asignan fondos al
            vincularlo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <AccessibleField className="min-w-0 space-y-2">
            <Label htmlFor="link-envelope-category">Categoría del sobre</Label>
            <SearchableSelect
              id="link-envelope-category"
              value={selected}
              onValueChange={setSelected}
              options={options.map((row) => ({
                value: String(row.id),
                label: `${row.name} · ${categories.find((parent) => parent.id === row.parentId)?.name ?? "Grupo"}`,
              }))}
              disabled={busy || quickBusy || catalog.loading}
              loading={catalog.loading}
              searchLabel="Buscar categoría del sobre"
              placeholder="Elige una categoría"
            />
          </AccessibleField>
          {catalog.error && (
            <Feedback tone="error" title="Categorías por confirmar">
              <p>{catalog.error}</p>
              <Button variant="outline" onClick={catalog.reload}>
                Consultar categorías
              </Button>
            </Feedback>
          )}
          {!catalog.loading && !catalog.error && options.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay categorías disponibles sin vincular. Crea una aquí o revisa las existentes.
            </p>
          )}
          <CategoryQuickCreate
            categories={categories}
            onBusy={setQuickBusy}
            onCreated={(category) => {
              setCreated((rows) => [...rows, category])
              if (category.parentId !== null) setSelected(String(category.id))
            }}
          />
          {error && (
            <Feedback tone="error" title="Vinculación por revisar">
              {error}
            </Feedback>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy || quickBusy} onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            loading={busy}
            disabled={busy || quickBusy || uncertain || !selected || disabled}
            onClick={() => void link()}
          >
            Vincular categoría
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
