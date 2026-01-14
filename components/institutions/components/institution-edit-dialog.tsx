import * as React from "react"

import { InstitutionFormDialog } from "@/components/institutions/components/institution-form-dialog"
import type { InstitutionFormData } from "@/components/institutions/types/institutions.types"

type InstitutionEditDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  formData: InstitutionFormData
  onFormDataChange: (data: InstitutionFormData) => void
  onSubmit: () => void
  submitDisabled: boolean
}

export function InstitutionEditDialog({
  open,
  onOpenChange,
  formData,
  onFormDataChange,
  onSubmit,
  submitDisabled,
}: InstitutionEditDialogProps) {
  return (
    <InstitutionFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Institution"
      description="Update institution details"
      submitLabel="Save Changes"
      submitDisabled={submitDisabled}
      onSubmit={onSubmit}
      formData={formData}
      onFormDataChange={onFormDataChange}
      idPrefix="edit-institution"
    />
  )
}
