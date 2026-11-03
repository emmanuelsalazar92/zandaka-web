import type { AccountUi } from "@/components/accounts/types/accounts.types"
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

type AccountDeactivateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: AccountUi[]
  deactivateId: number | null
  loading: boolean
  error: string | null
  onConfirm: () => void
}

export function AccountDeactivateDialog({
  open,
  onOpenChange,
  accounts,
  deactivateId,
  loading,
  error,
  onConfirm,
}: AccountDeactivateDialogProps) {
  const account = accounts.find((item) => item.id === deactivateId)
  const isActive = account?.active ?? true
  const isBlocked = isActive && (account?.activeEnvelopesCount || 0) > 0

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="deactivate-form">
        <AlertDialogHeader>
          <AlertDialogTitle>{isActive ? "Desactivar" : "Activar"} cuenta</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción permitirá {isActive ? "deactivate" : "activate"} la cuenta. Puedes revertir
            este cambio cuando lo necesites.
          </AlertDialogDescription>
          {isBlocked ? (
            <AccessibleFieldError className="text-sm text-error">
              Desactiva los sobres activos antes de desactivar esta cuenta.
            </AccessibleFieldError>
          ) : null}
          {error ? (
            <AccessibleFieldError className="text-sm text-error">{error}</AccessibleFieldError>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button
            type="button"
            data-testid="deactivate-submit"
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
