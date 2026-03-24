import type { AccountUi } from "@/components/accounts/types/accounts.types"
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
      <AlertDialogContent data-testid="deactivate-form" aria-label="deactivate-form">
        <AlertDialogHeader>
          <AlertDialogTitle>{isActive ? "Deactivate" : "Activate"} Account?</AlertDialogTitle>
          <AlertDialogDescription>
            This will {isActive ? "deactivate" : "activate"} the account. You can reverse this
            action at any time.
          </AlertDialogDescription>
          {isBlocked ? (
            <p className="text-sm text-error">
              Deactivate all active envelopes before deactivating this account.
            </p>
          ) : null}
          {error ? <p className="text-sm text-error">{error}</p> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            type="button"
            data-testid="deactivate-submit"
            aria-label="deactivate-submit"
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
