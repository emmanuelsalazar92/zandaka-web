import * as React from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { InstitutionUi } from "@/components/institutions/types/institutions.types"

type InstitutionDeactivateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  institutions: InstitutionUi[]
  deactivateId: number | null
  onConfirm: () => void
}

export function InstitutionDeactivateDialog({
  open,
  onOpenChange,
  institutions,
  deactivateId,
  onConfirm,
}: InstitutionDeactivateDialogProps) {
  const current = institutions.find((institution) => institution.id === deactivateId) ?? null
  const isActive = current?.status === "Active"

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isActive ? "Deactivate" : "Activate"} Institution?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will {isActive ? "deactivate" : "activate"} the institution. You can reverse this action at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
