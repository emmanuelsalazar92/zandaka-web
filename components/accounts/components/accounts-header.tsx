import { Plus } from "lucide-react"

import { AccountFormDialog } from "@/components/accounts/components/account-form-dialog"
import type { AccountFormData, InstitutionUi } from "@/components/accounts/types/accounts.types"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { institutionManagement } from "@/lib/navigation"

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
    <PageHeader
      title={<>Cuentas</>}
      description={<>Dónde está tu dinero y en qué moneda.</>}
      related={[institutionManagement]}
      actionsLabel="Acciones de cuentas"
    >
      <AccountFormDialog
        open={isCreateOpen}
        onOpenChange={onCreateOpenChange}
        title="Crear cuenta"
        description="Añade una cuenta para organizar tu dinero"
        submitLabel={loading ? "Creando…" : "Crear"}
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
          <Button data-testid="add-account">
            <Plus className="mr-2 h-4 w-4" />
            Añadir cuenta
          </Button>
        }
      />
    </PageHeader>
  )
}
