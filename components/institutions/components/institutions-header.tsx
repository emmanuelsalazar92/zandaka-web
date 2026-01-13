import * as React from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import type { InstitutionFormData } from "@/components/institutions/types/institutions.types"
import { InstitutionFormDialog } from "@/components/institutions/components/institution-form-dialog"

type InstitutionsHeaderProps = {
  isCreateOpen: boolean
  onCreateOpenChange: (open: boolean) => void
  formData: InstitutionFormData
  onFormDataChange: (data: InstitutionFormData) => void
  onCreate: () => void
  createDisabled: boolean
}

export function InstitutionsHeader({
  isCreateOpen,
  onCreateOpenChange,
  formData,
  onFormDataChange,
  onCreate,
  createDisabled,
}: InstitutionsHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Institutions</h2>
        <p className="text-muted-foreground">Manage your financial institutions</p>
      </div>
      <InstitutionFormDialog
        open={isCreateOpen}
        onOpenChange={onCreateOpenChange}
        title="Create Institution"
        description="Add a new financial institution to your budget"
        submitLabel="Create"
        submitDisabled={createDisabled}
        onSubmit={onCreate}
        formData={formData}
        onFormDataChange={onFormDataChange}
        idPrefix="create-institution"
        trigger={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Institution
          </Button>
        }
      />
    </div>
  )
}
