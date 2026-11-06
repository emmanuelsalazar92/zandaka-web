"use client"

import * as React from "react"

import styles from "@/components/accounts/account-context.module.css"
import { AccessibleField } from "@/components/ui/accessible-field"
import { Button } from "@/components/ui/button"
import { Feedback } from "@/components/ui/feedback"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import {
  contextWrite,
  ContextWriteError,
  parseContextCategories,
  type ContextCategory,
} from "@/lib/account-context"

export function CategoryQuickCreate({
  categories,
  onCreated,
  onBusy,
}: {
  categories: ContextCategory[]
  onCreated: (category: ContextCategory) => void
  onBusy: (value: boolean) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [group, setGroup] = React.useState("")
  const [groupName, setGroupName] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [uncertain, setUncertain] = React.useState(false)
  const lock = React.useRef(false)
  const trigger = React.useRef<HTMLButtonElement>(null)
  const parents = categories.filter((row) => row.parentId === null)
  async function create(isGroup: boolean) {
    if (lock.current || uncertain || !(isGroup ? groupName.trim() : name.trim() && group)) return
    lock.current = true
    setBusy(true)
    onBusy(true)
    setError(null)
    try {
      const parentId = isGroup ? null : Number(group)
      const raw = await contextWrite("/categories", "POST", {
        userId: 1,
        name: (isGroup ? groupName : name).trim(),
        parentId,
      })
      const created = parseContextCategories([raw])[0]
      if (!created || created.parentId !== parentId)
        throw new ContextWriteError(
          "La confirmación no pudo verificarse. Consulta las categorías antes de repetir.",
          true,
        )
      onCreated(created)
      if (isGroup) {
        setGroup(String(created.id))
        requestAnimationFrame(() => document.getElementById("quick-category-name")?.focus())
        setGroupName("")
      } else {
        setName("")
        setOpen(false)
        requestAnimationFrame(() => trigger.current?.focus())
      }
    } catch (error) {
      setError(
        error instanceof ContextWriteError
          ? error.message
          : "No pudimos verificar la categoría creada. Consulta el listado antes de repetir.",
      )
      if (!(error instanceof ContextWriteError) || error.uncertain) setUncertain(true)
    } finally {
      lock.current = false
      setBusy(false)
      onBusy(false)
    }
  }
  return (
    <div className="space-y-3">
      <Button
        ref={trigger}
        type="button"
        variant="link"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
      >
        Crear categoría aquí
      </Button>
      {open && (
        <fieldset className={styles.inlineForm}>
          <legend className="text-sm font-semibold">Nueva categoría</legend>
          <AccessibleField className="space-y-1">
            <Label htmlFor="quick-category-name">Nombre de la nueva categoría</Label>
            <Input
              id="quick-category-name"
              value={name}
              maxLength={255}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
            />
          </AccessibleField>
          <AccessibleField className="space-y-1">
            <Label htmlFor="quick-category-parent">Grupo de la categoría</Label>
            <SearchableSelect
              id="quick-category-parent"
              value={group}
              onValueChange={setGroup}
              disabled={busy}
              searchLabel="Buscar grupo"
              options={parents.map((row) => ({ value: String(row.id), label: row.name }))}
              placeholder="Elige un grupo"
            />
          </AccessibleField>
          <details>
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">
              Crear un grupo si no existe
            </summary>
            <div className="space-y-3 pt-2">
              <AccessibleField className="space-y-1">
                <Label htmlFor="quick-category-group">Nombre del nuevo grupo</Label>
                <Input
                  id="quick-category-group"
                  value={groupName}
                  maxLength={255}
                  disabled={busy}
                  onChange={(event) => setGroupName(event.target.value)}
                />
              </AccessibleField>
              <Button
                type="button"
                variant="outline"
                disabled={busy || uncertain || !groupName.trim()}
                onClick={() => void create(true)}
              >
                Crear grupo
              </Button>
            </div>
          </details>
          <p className={styles.caption}>
            Crear el grupo o la categoría no crea movimientos. Después confirma su vinculación a
            esta cuenta.
          </p>
          {error && (
            <Feedback tone="error" title="Categoría por revisar">
              {error}
            </Feedback>
          )}
          <div className={styles.actions}>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setOpen(false)
                requestAnimationFrame(() => trigger.current?.focus())
              }}
            >
              Volver a los sobres
            </Button>
            <Button
              type="button"
              loading={busy}
              disabled={busy || uncertain || !name.trim() || !group}
              onClick={() => void create(false)}
            >
              Crear categoría
            </Button>
          </div>
        </fieldset>
      )}
    </div>
  )
}
