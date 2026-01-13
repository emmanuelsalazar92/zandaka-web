import * as React from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type {
  AccountFormData,
  InstitutionUi,
} from "@/components/accounts/types/accounts.types"

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-institution`}>Institution</Label>
            {isCreateMode ? (
              <>
                {loading ? (
                  <div className="py-6 text-center text-muted-foreground">
                    Loading institutions...
                  </div>
                ) : null}
                {error ? <div className="py-6 text-center text-red-500">{error}</div> : null}
                {!loading && !error ? (
                  <Select
                    value={formData.institutionId}
                    onValueChange={(value) => onFormDataChange({ ...formData, institutionId: value })}
                  >
                    <SelectTrigger id={`${idPrefix}-institution`}>
                      <SelectValue placeholder="Select institution" />
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
              <Input id={`${idPrefix}-institution`} value={formData.institutionId} disabled />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-name`}>Account Name</Label>
            <Input
              id={`${idPrefix}-name`}
              placeholder="e.g., Main Checking"
              value={formData.name}
              onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-currency`}>Currency (immutable)</Label>
            {isCreateMode ? (
              <Select
                value={formData.currency}
                onValueChange={(value) => onFormDataChange({ ...formData, currency: value })}
              >
                <SelectTrigger id={`${idPrefix}-currency`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRC">CRC (Costa Rican Colon)</SelectItem>
                  <SelectItem value="USD">USD (US Dollar)</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input id={`${idPrefix}-currency`} value={formData.currency} disabled />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={submitDisabled}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
