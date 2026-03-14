"use client"

import { InstitutionDeactivateDialog } from "@/components/institutions/components/institution-deactivate-dialog"
import { InstitutionEditDialog } from "@/components/institutions/components/institution-edit-dialog"
import { InstitutionsEmptyState } from "@/components/institutions/components/institutions-empty-state"
import { InstitutionsHeader } from "@/components/institutions/components/institutions-header"
import { InstitutionsTable } from "@/components/institutions/components/institutions-table"
import { useInstitutions } from "@/components/institutions/hooks/use-institutions"

export function InstitutionsContent() {
  const {
    institutions,
    loading,
    error,
    isCreateOpen,
    isEditOpen,
    deactivateId,
    deactivateError,
    formData,
    setIsCreateOpen,
    setFormData,
    handleCreate,
    handleEdit,
    handleDeactivate,
    openEdit,
    openDeactivate,
    closeEdit,
    closeDeactivate,
  } = useInstitutions()

  return (
    <div className="space-y-6">
      <InstitutionsHeader
        isCreateOpen={isCreateOpen}
        onCreateOpenChange={setIsCreateOpen}
        formData={formData}
        onFormDataChange={setFormData}
        onCreate={handleCreate}
        createDisabled={!formData.name}
      />

      {institutions.length === 0 ? (
        <InstitutionsEmptyState onCreateClick={() => setIsCreateOpen(true)} />
      ) : (
        <InstitutionsTable
          institutions={institutions}
          loading={loading}
          error={error}
          onEdit={openEdit}
          onDeactivate={openDeactivate}
        />
      )}

      <InstitutionEditDialog
        open={isEditOpen}
        onOpenChange={closeEdit}
        formData={formData}
        onFormDataChange={setFormData}
        onSubmit={handleEdit}
        submitDisabled={!formData.name || loading}
      />

      <InstitutionDeactivateDialog
        open={deactivateId !== null}
        onOpenChange={closeDeactivate}
        institutions={institutions}
        deactivateId={deactivateId}
        loading={loading}
        error={deactivateError}
        onConfirm={handleDeactivate}
      />
    </div>
  )
}
