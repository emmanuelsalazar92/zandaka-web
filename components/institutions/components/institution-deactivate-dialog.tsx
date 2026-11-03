import * as React from "react"

import type { InstitutionUi } from "@/components/institutions/types/institutions.types"
import { AccessibleFieldError } from "@/components/ui/accessible-field"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

type InstitutionDeactivateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  institutions: InstitutionUi[]
  deactivateId: number | null
  loading: boolean
  error: string | null
  onConfirm: () => void
}

export function InstitutionDeactivateDialog({
  open,
  onOpenChange,
  institutions,
  deactivateId,
  loading,
  error,
  onConfirm,
}: InstitutionDeactivateDialogProps) {
  const current = institutions.find((institution) => institution.id === deactivateId) ?? null
  const isActive = current?.status === "Active"
  const isBlocked = isActive && (current?.activeAccountsCount || 0) > 0

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="deactivate-form">
        <AlertDialogHeader>
          <AlertDialogTitle>{isActive ? "Desactivar" : "Activar"} institución</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción permitirá {isActive ? "deactivate" : "activate"} la institución. Puedes
            revertir este cambio cuando lo necesites.
          </AlertDialogDescription>
          {isBlocked ? (
            <AccessibleFieldError className="text-sm text-error">
              Desactiva las cuentas activas antes de desactivar esta institución.
            </AccessibleFieldError>
          ) : null}
          {error ? (
            <AccessibleFieldError className="text-sm text-error">{error}</AccessibleFieldError>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button
            data-testid="deactivate-submit"
            type="button"
            onClick={onConfirm}
            disabled={loading || isBlocked}
          >
            {loading ? "Procesando…" : "Confirmar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
