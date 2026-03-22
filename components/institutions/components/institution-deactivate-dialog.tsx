import * as React from "react"

import type { InstitutionUi } from "@/components/institutions/types/institutions.types"
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
      <AlertDialogContent data-testid="deactivate-form" aria-label="deactivate-form">
        <AlertDialogHeader>
          <AlertDialogTitle>{isActive ? "Deactivate" : "Activate"} Institution?</AlertDialogTitle>
          <AlertDialogDescription>
            This will {isActive ? "deactivate" : "activate"} the institution. You can reverse this
            action at any time.
          </AlertDialogDescription>
          {isBlocked ? (
            <p className="text-sm text-error">
              Deactivate all active accounts before deactivating this institution.
            </p>
          ) : null}
          {error ? <p className="text-sm text-error">{error}</p> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            data-testid="deactivate-submit"
            aria-label="deactivate-submit"
            type="button"
            onClick={onConfirm}
            disabled={loading || isBlocked}
          >
            {loading ? "Processing..." : "Confirm"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
