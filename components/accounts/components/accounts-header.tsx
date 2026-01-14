import { Plus } from "lucide-react"

import { AccountFormDialog } from "@/components/accounts/components/account-form-dialog"
import type { AccountFormData, InstitutionUi } from "@/components/accounts/types/accounts.types"
import { Button } from "@/components/ui/button"

type AccountsHeaderProps = {
  isCreateOpen: boolean
  onCreateOpenChange: (open: boolean) => void
  formData: AccountFormData
  onFormDataChange: (data: AccountFormData) => void
  onCreate: () => void
  createDisabled: boolean
  institutions: InstitutionUi[]
  loading: boolean
  error: string | null
}

export function AccountsHeader({
  isCreateOpen,
  onCreateOpenChange,
  formData,
  onFormDataChange,
  onCreate,
  createDisabled,
  institutions,
  loading,
  error,
}: AccountsHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Accounts</h2>
        <p className="text-muted-foreground">Manage your accounts across institutions</p>
      </div>
      <AccountFormDialog
        open={isCreateOpen}
        onOpenChange={onCreateOpenChange}
        title="Create Account"
        description="Add a new account to track your finances"
        submitLabel={loading ? "Creating..." : "Create"}
        submitDisabled={createDisabled}
        onSubmit={onCreate}
        formData={formData}
        onFormDataChange={onFormDataChange}
        institutions={institutions}
        loading={loading}
        error={error}
        mode="create"
        idPrefix="create-account"
        trigger={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Button>
        }
      />
    </div>
  )
}
