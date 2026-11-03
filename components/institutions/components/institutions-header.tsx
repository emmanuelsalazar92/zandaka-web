import { Plus } from "lucide-react"
import * as React from "react"

import { InstitutionFormDialog } from "@/components/institutions/components/institution-form-dialog"
import type { InstitutionFormData } from "@/components/institutions/types/institutions.types"
import { Button } from "@/components/ui/button"

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
        <h2 className="text-2xl font-bold tracking-tight">Instituciones</h2>
        <p className="text-muted-foreground">Administra tus instituciones financieras</p>
      </div>
      <InstitutionFormDialog
        open={isCreateOpen}
        onOpenChange={onCreateOpenChange}
        title="Crear institución"
        description="Añade una institución financiera para organizar tus cuentas"
        submitLabel="Crear"
        submitDisabled={createDisabled}
        onSubmit={onCreate}
        formData={formData}
        onFormDataChange={onFormDataChange}
        idPrefix="create-institution"
        trigger={
          <Button data-testid="add-institution">
            <Plus className="mr-2 h-4 w-4" />
            Añadir institución
          </Button>
        }
      />
    </div>
  )
}
