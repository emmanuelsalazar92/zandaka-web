import type { AccountUi } from "@/components/accounts/types/accounts.types"
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

type AccountDeactivateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: AccountUi[]
  deactivateId: number | null
  onConfirm: () => void
}

export function AccountDeactivateDialog({
  open,
  onOpenChange,
  accounts,
  deactivateId,
  onConfirm,
}: AccountDeactivateDialogProps) {
  const account = accounts.find((item) => item.id === deactivateId)
  const isActive = account?.active ?? true

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isActive ? "Deactivate" : "Activate"} Account?</AlertDialogTitle>
          <AlertDialogDescription>
            This will {isActive ? "deactivate" : "activate"} the account. You can reverse this
            action at any time.
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
