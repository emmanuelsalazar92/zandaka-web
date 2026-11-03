import { Plus } from "lucide-react"
import Link from "next/link"

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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Cuentas</h2>
        <p className="mt-1 text-muted-foreground">Dónde está tu dinero y en qué moneda.</p>
        <Link
          href="/institutions"
          className="mt-2 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Gestionar instituciones
        </Link>
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
          <Button data-testid="add-account" aria-label="add-account">
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Button>
        }
      />
    </div>
  )
}
