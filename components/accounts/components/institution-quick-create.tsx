"use client"

import * as React from "react"

import type { InstitutionUi } from "@/components/accounts/types/accounts.types"
import { AccessibleField } from "@/components/ui/accessible-field"
import { Button } from "@/components/ui/button"
import { Feedback } from "@/components/ui/feedback"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { contextWrite, ContextWriteError, parseContextInstitutions } from "@/lib/account-context"

import styles from "../account-context.module.css"

export function InstitutionQuickCreate({
  onCreated,
  onBusy,
  onReload,
}: {
  onCreated: (institution: InstitutionUi) => void
  onBusy: (busy: boolean) => void
  onReload: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [type, setType] = React.useState("BANK")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [uncertain, setUncertain] = React.useState(false)
  const lock = React.useRef(false)
  const trigger = React.useRef<HTMLButtonElement>(null)
  const create = async () => {
    if (lock.current || uncertain || !name.trim()) return
    lock.current = true
    setBusy(true)
    onBusy(true)
    setError(null)
    try {
      const raw = await contextWrite("/institutions", "POST", {
        userId: 1,
        name: name.trim(),
        type,
      })
      const institution = parseContextInstitutions([raw])[0]
      if (!institution || institution.status !== "Active")
        throw new ContextWriteError(
          "La confirmación está por verificar. Revisa las instituciones antes de repetir.",
          true,
        )
      onCreated(institution)
      setOpen(false)
      requestAnimationFrame(() => trigger.current?.focus())
      setName("")
    } catch (error) {
      setError(
        error instanceof ContextWriteError
          ? error.message
          : "No pudimos verificar la institución creada. Consulta el listado antes de repetir.",
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
        disabled={busy}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Crear institución aquí
      </Button>
      {open && (
        <fieldset className={styles.inlineForm}>
          <legend className="text-sm font-semibold">Nueva institución</legend>
          <AccessibleField className="space-y-1">
            <Label htmlFor="quick-institution-name">Nombre de la nueva institución</Label>
            <Input
              id="quick-institution-name"
              value={name}
              maxLength={255}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
            />
          </AccessibleField>
          <AccessibleField className="space-y-1">
            <Label htmlFor="quick-institution-type">Tipo de institución</Label>
            <SearchableSelect
              id="quick-institution-type"
              value={type}
              onValueChange={setType}
              disabled={busy}
              options={[
                { value: "BANK", label: "Banco" },
                { value: "CASH", label: "Efectivo" },
                { value: "VIRTUAL", label: "Virtual" },
              ]}
            />
          </AccessibleField>
          <p className={styles.caption}>
            Al crearla quedará seleccionada. Los datos de tu cuenta se conservan.
          </p>
          {error && (
            <Feedback tone="error" title="Institución por revisar">
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
                if (uncertain) onReload()
              }}
            >
              Volver a la cuenta
            </Button>
            <Button
              type="button"
              disabled={busy || uncertain || !name.trim()}
              loading={busy}
              onClick={() => void create()}
            >
              Crear institución
            </Button>
          </div>
        </fieldset>
      )}
    </div>
  )
}
