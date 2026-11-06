import * as React from "react"

import { InstitutionQuickCreate } from "@/components/accounts/components/institution-quick-create"
import type { AccountFormData, InstitutionUi } from "@/components/accounts/types/accounts.types"
import { AccessibleField } from "@/components/ui/accessible-field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Feedback } from "@/components/ui/feedback"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Switch } from "@/components/ui/switch"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  submitLabel: string
  submitDisabled?: boolean
  onSubmit: () => void
  formData: AccountFormData
  onFormDataChange: (data: AccountFormData) => void
  institutions?: InstitutionUi[]
  loading?: boolean
  error?: string | null
  trigger?: React.ReactNode
  idPrefix?: string
  mode: "create" | "edit"
  institutionsLoading?: boolean
  institutionsError?: string | null
  onInstitutionsReload?: () => void
  onInstitutionCreated?: (institution: InstitutionUi) => void
  returnFocus?: () => void
}
export function AccountFormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  submitDisabled,
  onSubmit,
  formData,
  onFormDataChange,
  institutions = [],
  loading = false,
  error = null,
  trigger,
  idPrefix = "account",
  mode,
  institutionsLoading = false,
  institutionsError = null,
  onInstitutionsReload,
  onInstitutionCreated,
  returnFocus,
}: Props) {
  const [quickBusy, setQuickBusy] = React.useState(false)
  const busy = loading || quickBusy
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value)
      }}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        data-testid="account-form"
        className="marea-surface"
        onCloseAutoFocus={(event) => {
          if (returnFocus) {
            event.preventDefault()
            returnFocus()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <AccessibleField className="min-w-0 space-y-2">
            <Label htmlFor={`${idPrefix}-name`}>Nombre de la cuenta</Label>
            <Input
              id={`${idPrefix}-name`}
              data-testid="account-name"
              value={formData.name}
              disabled={loading}
              maxLength={255}
              onChange={(event) => onFormDataChange({ ...formData, name: event.target.value })}
              placeholder="Por ejemplo, Cuenta principal"
            />
          </AccessibleField>
          <AccessibleField className="min-w-0 space-y-2">
            <Label htmlFor={`${idPrefix}-institution`}>Institución</Label>
            {mode === "create" ? (
              <SearchableSelect
                id={`${idPrefix}-institution`}
                data-testid="select-institution"
                value={formData.institutionId}
                onValueChange={(institutionId) => onFormDataChange({ ...formData, institutionId })}
                options={institutions
                  .filter((row) => row.status === "Active")
                  .map((row) => ({ value: String(row.id), label: row.name }))}
                loading={institutionsLoading}
                disabled={loading || institutionsLoading}
                searchLabel="Buscar institución"
                placeholder="Elige una institución"
              />
            ) : (
              <Input id={`${idPrefix}-institution`} value={formData.institutionId} disabled />
            )}
          </AccessibleField>
          {mode === "create" && (
            <>
              {institutionsError && (
                <Feedback tone="error" title="Instituciones por confirmar">
                  <p>{institutionsError}</p>
                  <Button type="button" variant="outline" onClick={onInstitutionsReload}>
                    Consultar instituciones
                  </Button>
                </Feedback>
              )}
              {onInstitutionCreated && (
                <InstitutionQuickCreate
                  onCreated={onInstitutionCreated}
                  onBusy={setQuickBusy}
                  onReload={onInstitutionsReload ?? (() => {})}
                />
              )}
            </>
          )}
          <AccessibleField className="min-w-0 space-y-2">
            <Label htmlFor={`${idPrefix}-currency`}>Moneda de la cuenta</Label>
            {mode === "create" ? (
              <SearchableSelect
                id={`${idPrefix}-currency`}
                data-testid="select-currency"
                value={formData.currency}
                onValueChange={(currency) => onFormDataChange({ ...formData, currency })}
                disabled={busy}
                options={[
                  { value: "CRC", label: "CRC · Colón costarricense" },
                  { value: "USD", label: "USD · Dólar estadounidense" },
                ]}
              />
            ) : (
              <Input id={`${idPrefix}-currency`} value={formData.currency} disabled />
            )}
          </AccessibleField>
          <p className="text-xs text-muted-foreground">
            La institución y la moneda se conservan después de crear la cuenta. No se agregan fondos
            con este formulario.
          </p>
          {mode === "create" && (
            <AccessibleField className="flex flex-wrap items-center gap-3">
              <Switch
                id={`${idPrefix}-overdraft`}
                checked={formData.allowOverdraft}
                onCheckedChange={(allowOverdraft) =>
                  onFormDataChange({ ...formData, allowOverdraft })
                }
                disabled={busy}
              />
              <Label htmlFor={`${idPrefix}-overdraft`}>Permitir sobregiro</Label>
            </AccessibleField>
          )}
          {error && (
            <Feedback tone="error" title="Cuenta por revisar">
              {error}
            </Feedback>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            data-testid="submit-create-account"
            disabled={submitDisabled || busy || !formData.name.trim()}
            loading={loading}
            onClick={onSubmit}
          >
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
