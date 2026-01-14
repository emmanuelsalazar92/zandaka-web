"use client"

import { AccountDeactivateDialog } from "@/components/accounts/components/account-deactivate-dialog"
import { AccountFormDialog } from "@/components/accounts/components/account-form-dialog"
import { AccountsEmptyState } from "@/components/accounts/components/accounts-empty-state"
import { AccountsHeader } from "@/components/accounts/components/accounts-header"
import { AccountsTable } from "@/components/accounts/components/accounts-table"
import { useAccounts } from "@/components/accounts/hooks/use-accounts"

export function AccountsContent() {
  const {
    accounts,
    institutions,
    loading,
    error,
    isCreateOpen,
    isEditOpen,
    deactivateId,
    formData,
    setIsCreateOpen,
    setDeactivateId,
    setFormData,
    handleCreate,
    handleEdit,
    handleDeactivate,
    openEdit,
    closeEdit,
  } = useAccounts()

  return (
    <div className="space-y-6">
      <AccountsHeader
        isCreateOpen={isCreateOpen}
        onCreateOpenChange={setIsCreateOpen}
        formData={formData}
        onFormDataChange={setFormData}
        onCreate={handleCreate}
        createDisabled={!formData.name || !formData.institutionId || loading}
        institutions={institutions}
        loading={loading}
        error={error}
      />

      {accounts.length === 0 ? (
        <AccountsEmptyState onCreateClick={() => setIsCreateOpen(true)} />
      ) : (
        <AccountsTable
          accounts={accounts}
          loading={loading}
          error={error}
          onEdit={openEdit}
          onDeactivate={setDeactivateId}
        />
      )}

      <AccountFormDialog
        open={isEditOpen}
        onOpenChange={(open) => (!open ? closeEdit() : null)}
        title="Edit Account"
        description="Update account details"
        submitLabel="Save Changes"
        submitDisabled={!formData.name || loading}
        onSubmit={handleEdit}
        formData={formData}
        onFormDataChange={setFormData}
        mode="edit"
        idPrefix="edit-account"
      />

      <AccountDeactivateDialog
        open={deactivateId !== null}
        onOpenChange={(open) => (!open ? setDeactivateId(null) : null)}
        accounts={accounts}
        deactivateId={deactivateId}
        onConfirm={handleDeactivate}
      />
    </div>
  )
}
