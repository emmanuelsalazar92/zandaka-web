import * as React from "react"

import type {
  InstitutionFormData,
  InstitutionType,
} from "@/components/institutions/types/institutions.types"
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

type InstitutionFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  submitLabel: string
  submitDisabled?: boolean
  onSubmit: () => void
  formData: InstitutionFormData
  onFormDataChange: (data: InstitutionFormData) => void
  trigger?: React.ReactNode
  idPrefix?: string
}

const INSTITUTION_TYPES: InstitutionType[] = ["BANK", "CASH", "VIRTUAL"]

export function InstitutionFormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  submitDisabled,
  onSubmit,
  formData,
  onFormDataChange,
  trigger,
  idPrefix = "institution",
}: InstitutionFormDialogProps) {
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
            <Label htmlFor={`${idPrefix}-name`}>Institution Name</Label>
            <Input
              id={`${idPrefix}-name`}
              placeholder="e.g., Banco Nacional"
              value={formData.name}
              onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-type`}>Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value) =>
                onFormDataChange({ ...formData, type: value as InstitutionType })
              }
            >
              <SelectTrigger id={`${idPrefix}-type`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSTITUTION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type === "BANK" ? "Bank" : type === "CASH" ? "Cash" : "Virtual"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
