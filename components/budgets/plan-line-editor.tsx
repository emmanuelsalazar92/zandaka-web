"use client"

import { Trash2 } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { calculateBudgetPlan, type BudgetPlanDocument, type PlanLine } from "@/lib/budget-plan"
import type { PlanOptions } from "@/lib/budget-plan-api"
import { formatPlanMoney as formatCurrency } from "@/lib/budget-plan-view"

import { AmountField, PlanField } from "./plan-fields"
import styles from "./plan.module.css"

export function PlanLineEditor({
  line,
  document,
  options,
  onClose,
  onSave,
  onRemove,
}: {
  line: PlanLine
  document: BudgetPlanDocument
  options: PlanOptions
  onClose: () => void
  onSave: (line: PlanLine) => void
  onRemove: (id: string) => void
}) {
  const [draft, setDraft] = React.useState(line),
    [error, setError] = React.useState("")
  const patch = (value: Partial<PlanLine>) => {
    setDraft((current) => ({ ...current, ...value }))
    setError("")
  }
  const preview = calculateBudgetPlan({ ...document, lines: [draft] })
  const result = preview.lines[0]
  const validate = () => {
    if (!draft.name.trim()) {
      setError("Indica el nombre de la asignación.")
      return
    }
    if (!result) {
      setError(
        preview.issues.find((i) => i.field.startsWith("lines"))?.detail ??
          "Completa el ingreso, las tasas y el importe para revisar esta asignación.",
      )
      return
    }
    onSave({ ...draft, name: draft.name.trim() })
  }
  const isExisting = document.lines.some((l) => l.id === line.id)
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="marea-surface max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isExisting ? "Editar asignación" : "Nueva asignación"}</DialogTitle>
          <DialogDescription>
            Conserva el importe original y elige cómo llegará al sobre.
          </DialogDescription>
        </DialogHeader>
        <div className={styles.dialogBody}>
          <PlanField label="Nombre de la asignación">
            <Input
              maxLength={80}
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </PlanField>
          <div className={`${styles.fields} ${styles.two}`}>
            <PlanField label="Grupo">
              <select
                className={styles.select}
                value={draft.group}
                onChange={(e) => patch({ group: Number(e.target.value) as PlanLine["group"] })}
              >
                <option value="50">Grupo 50</option>
                <option value="30">Grupo 30</option>
                <option value="20">Grupo 20</option>
              </select>
            </PlanField>
            <PlanField label="Asignación definida por">
              <select
                className={styles.select}
                value={draft.kind}
                onChange={(e) => {
                  const kind = e.target.value as PlanLine["kind"]
                  patch({
                    kind,
                    ...(kind === "percent" ? { currency: "USD", roundUsd: "none" } : {}),
                  })
                }}
              >
                <option value="fixed">Monto fijo</option>
                <option value="percent">Porcentaje del neto</option>
                <option value="subscription">Suscripción con impuesto</option>
              </select>
            </PlanField>
          </div>
          <div className={`${styles.fields} ${styles.two}`}>
            <AmountField
              label={
                draft.kind === "percent"
                  ? "Porcentaje del neto · %"
                  : draft.kind === "subscription"
                    ? "Precio antes de impuesto"
                    : "Importe original"
              }
              value={draft.amount}
              onChange={(amount) => patch({ amount })}
            />
            <PlanField label="Moneda de origen">
              <select
                className={styles.select}
                value={draft.currency}
                disabled={draft.kind === "percent"}
                onChange={(e) => {
                  const currency = e.target.value as PlanLine["currency"]
                  patch({
                    currency,
                    targetEnvelopeId: null,
                    ...(currency === "CRC"
                      ? { payCurrency: "CRC", roundUsd: "up" }
                      : { roundUsd: "none" }),
                  })
                }}
              >
                <option value="USD">USD · Dólares</option>
                <option value="CRC">CRC · Colones</option>
              </select>
            </PlanField>
          </div>
          {draft.kind === "subscription" && (
            <AmountField
              label="Impuesto · %"
              value={draft.iva}
              onChange={(iva) => patch({ iva })}
              help="Usa el porcentaje que corresponda al servicio. El precio de origen debe excluir este impuesto."
            />
          )}
          <div className={`${styles.fields} ${styles.two}`}>
            <PlanField label="Moneda del sobre">
              <select
                className={styles.select}
                value={draft.payCurrency}
                onChange={(e) =>
                  patch({
                    payCurrency: e.target.value as PlanLine["payCurrency"],
                    targetEnvelopeId: null,
                  })
                }
              >
                <option value="CRC">CRC · Colones</option>
                {draft.currency === "USD" && <option value="USD">USD · Dólares</option>}
              </select>
            </PlanField>
            {(draft.kind !== "percent" &&
              draft.payCurrency === "CRC" &&
              draft.currency === "CRC") ||
            (draft.kind === "subscription" && draft.payCurrency === "CRC") ? (
              <PlanField label="Reserva en USD">
                <select
                  className={styles.select}
                  value={draft.roundUsd}
                  onChange={(e) => patch({ roundUsd: e.target.value as PlanLine["roundUsd"] })}
                >
                  <option value="up">Al dólar superior</option>
                  <option value="none">Sin redondeo adicional</option>
                </select>
              </PlanField>
            ) : (
              <p className={styles.note}>
                La asignación nace en USD. Su conversión conserva la precisión del cálculo.
              </p>
            )}
          </div>
          <PlanField
            label="Sobre de destino"
            help="Puedes asignarlo después, antes de preparar el presupuesto."
          >
            <select
              className={styles.select}
              value={draft.targetEnvelopeId ?? ""}
              onChange={(e) =>
                patch({ targetEnvelopeId: e.target.value ? Number(e.target.value) : null })
              }
            >
              <option value="">Por elegir</option>
              {options.envelopes
                .filter((e) => e.currency === draft.payCurrency)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.categoryName} · {e.accountName} · {e.institutionName} · {e.currency}
                  </option>
                ))}
            </select>
          </PlanField>
          <div className={styles.dialogAmounts}>
            <div>
              <span>Asignación para el sobre</span>
              <strong>
                {result ? formatCurrency(result.payAmount, result.payCurrency) : "Por confirmar"}
              </strong>
            </div>
            <div>
              <span>Reserva del ingreso</span>
              <strong>{result ? formatCurrency(result.reserveUsd, "USD") : "Por confirmar"}</strong>
            </div>
          </div>
          {result && (
            <details className={styles.calculation}>
              <summary>Ver cálculo y redondeo</summary>
              <ul>
                {result.explanation.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
              <p>
                Las asignaciones a sobres se registran a centavos, redondeando al más cercano. La
                reserva presupuestaria conserva precisión intermedia.
              </p>
            </details>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="flex-wrap gap-2">
          {isExisting && (
            <Button
              variant="ghost"
              className="mr-auto text-destructive"
              onClick={() => onRemove(line.id)}
            >
              <Trash2 aria-hidden="true" className="mr-2 size-4" />
              Quitar del plan
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={validate}>Actualizar plan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
