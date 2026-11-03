import * as React from "react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type AccountFormDialogProps = {
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
}: AccountFormDialogProps) {
  const isCreateMode = mode === "create"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent data-testid="account-form">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-institution`}>Institución</Label>
            {isCreateMode ? (
              <>
                {loading ? (
                  <div className="py-6 text-center text-muted-foreground">
                    Cargando instituciones…
                  </div>
                ) : null}
                {error ? <div className="py-6 text-center text-error">{error}</div> : null}
                {!loading && !error ? (
                  <Select
                    value={formData.institutionId}
                    onValueChange={(value) =>
                      onFormDataChange({ ...formData, institutionId: value })
                    }
                  >
                    <SelectTrigger
                      id={`${idPrefix}-institution`}
                      data-testid="select-institution"
                      aria-label="Institución"
                    >
                      <SelectValue placeholder="Elige una institución" />
                    </SelectTrigger>
                    <SelectContent>
                      {institutions.map((inst) => (
                        <SelectItem key={inst.id} value={String(inst.id)}>
                          {inst.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </>
            ) : (
              <Input
                id={`${idPrefix}-institution`}
                data-testid="select-institution"
                aria-label="Institución"
                value={formData.institutionId}
                disabled
              />
            )}
          </div>

          <AccessibleField className="space-y-2">
            <Label htmlFor={`${idPrefix}-name`}>Nombre de la cuenta</Label>
            <Input
              id={`${idPrefix}-name`}
              placeholder="Por ejemplo, Cuenta principal"
              data-testid="account-name"
              aria-label="Nombre de la cuenta"
              value={formData.name}
              onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
            />
          </AccessibleField>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-currency`}>Moneda (no se puede cambiar)</Label>
            {isCreateMode ? (
              <Select
                value={formData.currency}
                onValueChange={(value) => onFormDataChange({ ...formData, currency: value })}
              >
                <SelectTrigger
                  id={`${idPrefix}-currency`}
                  data-testid="select-currency"
                  aria-label="Moneda"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRC">CRC · Colón costarricense</SelectItem>
                  <SelectItem value="USD">USD · Dólar estadounidense</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={`${idPrefix}-currency`}
                data-testid="select-currency"
                aria-label="Moneda"
                value={formData.currency}
                disabled
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} data-testid="submit-create-account" disabled={submitDisabled}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
