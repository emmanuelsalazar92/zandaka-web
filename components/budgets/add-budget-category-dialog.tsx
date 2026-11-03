"use client"

import * as React from "react"

import type { BudgetCategoryOption } from "@/components/budgets/types"
import { AccessibleField, AccessibleFieldError } from "@/components/ui/accessible-field"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  currencyStep,
  amountFromPercentage,
  percentageFromAmount,
  tryDecimalInput,
  assertMoney,
} from "@/lib/money"

type AddBudgetCategoryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: BudgetCategoryOption[]
  currency: string
  totalIncome: number
  existingCategoryIds: number[]
  onConfirm: (payload: {
    categoryId: number
    amount: number
    percentage: number
    notes: string
  }) => void
}

export function AddBudgetCategoryDialog({
  open,
  onOpenChange,
  categories,
  totalIncome,
  currency,
  existingCategoryIds,
  onConfirm,
}: AddBudgetCategoryDialogProps) {
  const [parentCategoryId, setParentCategoryId] = React.useState("")
  const [childCategoryId, setChildCategoryId] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [percentage, setPercentage] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [isAmountInputMode, setIsAmountInputMode] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const parentCategories = categories.filter((category) => category.parentId === null)
  const childCategories = categories.filter(
    (category) => category.parentId !== null && category.parentId.toString() === parentCategoryId,
  )
  const parsedAmount = tryDecimalInput(amount || "0")
  const canSubmit =
    parentCategoryId !== "" &&
    childCategoryId !== "" &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0

  const resetState = () => {
    setParentCategoryId("")
    setChildCategoryId("")
    setAmount("")
    setPercentage("")
    setNotes("")
    setIsAmountInputMode(true)
    setError(null)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      resetState()
    }
  }

  const handleParentChange = (value: string) => {
    setParentCategoryId(value)
    setChildCategoryId("")
  }

  const handleAmountChange = (value: string) => {
    setAmount(value)

    if (!isAmountInputMode) return

    const parsedAmount = tryDecimalInput(value || "0")
    const nextAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0
    const nextPercentage = totalIncome > 0 ? percentageFromAmount(nextAmount, totalIncome) : 0
    setPercentage(value === "" ? "" : String(nextPercentage))
  }

  const handlePercentageChange = (value: string) => {
    setPercentage(value)

    if (isAmountInputMode) return

    const parsedPercentage = tryDecimalInput(value || "0")
    const nextPercentage = Number.isFinite(parsedPercentage) ? parsedPercentage : 0
    const nextAmount =
      totalIncome > 0 ? amountFromPercentage(totalIncome, nextPercentage, currency) : 0
    setAmount(value === "" ? "" : String(nextAmount))
  }

  const handleInputModeChange = (checked: boolean) => {
    setIsAmountInputMode(checked)

    if (checked) {
      const currentAmount = amount
      setAmount(currentAmount)
      if (currentAmount !== "") {
        const parsedAmount = tryDecimalInput(currentAmount || "0")
        const nextAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0
        const nextPercentage = totalIncome > 0 ? percentageFromAmount(nextAmount, totalIncome) : 0
        setPercentage(String(nextPercentage))
      }
      return
    }

    const currentPercentage = percentage
    setPercentage(currentPercentage)
    if (currentPercentage !== "") {
      const parsedPercentage = tryDecimalInput(currentPercentage || "0")
      const nextPercentage = Number.isFinite(parsedPercentage) ? parsedPercentage : 0
      const nextAmount =
        totalIncome > 0 ? amountFromPercentage(totalIncome, nextPercentage, currency) : 0
      setAmount(String(nextAmount))
    }
  }

  const handleConfirm = () => {
    const parsedCategoryId = Number.parseInt(childCategoryId, 10)
    const parsedAmount = tryDecimalInput(amount || "0")
    const parsedPercentage = tryDecimalInput(percentage || "0")

    if (!parentCategoryId || !childCategoryId || Number.isNaN(parsedCategoryId)) {
      setError("Elige una categoría principal y una subcategoría.")
      return
    }

    if (existingCategoryIds.includes(parsedCategoryId)) {
      setError("Esa categoría ya forma parte del presupuesto.")
      return
    }

    try {
      assertMoney(parsedAmount, currency)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Revisa el importe")
      return
    }
    onConfirm({
      categoryId: parsedCategoryId,
      amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
      percentage: Number.isFinite(parsedPercentage) ? parsedPercentage : 0,
      notes,
    })
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Añadir categoría</DialogTitle>
          <DialogDescription>
            Añade una subcategoría al presupuesto con su importe, porcentaje y notas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <AccessibleField className="space-y-2">
            <Label htmlFor="budget-parent-category">Categoría principal</Label>
            <Select value={parentCategoryId} onValueChange={handleParentChange}>
              <SelectTrigger id="budget-parent-category">
                <SelectValue placeholder="Elige una categoría principal" />
              </SelectTrigger>
              <SelectContent>
                {parentCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </AccessibleField>
          <AccessibleField className="space-y-2">
            <Label htmlFor="budget-child-category">Subcategoría</Label>
            <Select
              value={childCategoryId}
              onValueChange={setChildCategoryId}
              disabled={!parentCategoryId}
            >
              <SelectTrigger id="budget-child-category">
                <SelectValue placeholder="Elige una subcategoría" />
              </SelectTrigger>
              <SelectContent>
                {childCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </AccessibleField>
          <div className="grid gap-4 sm:grid-cols-2">
            <AccessibleField className="space-y-2">
              <Label htmlFor="budget-category-amount">Importe</Label>
              <Input
                id="budget-category-amount"
                type="number"
                min="0"
                step={currencyStep(currency)}
                value={amount}
                onChange={(event) => handleAmountChange(event.target.value)}
                disabled={!isAmountInputMode}
              />
            </AccessibleField>
            <AccessibleField className="space-y-2">
              <Label htmlFor="budget-category-percentage">Porcentaje</Label>
              <Input
                id="budget-category-percentage"
                type="number"
                min="0"
                step="0.01"
                value={percentage}
                onChange={(event) => handlePercentageChange(event.target.value)}
                disabled={isAmountInputMode}
              />
            </AccessibleField>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              id="budget-category-input-mode"
              checked={isAmountInputMode}
              onCheckedChange={(checked) => handleInputModeChange(Boolean(checked))}
            />
            <div className="space-y-1">
              <Label htmlFor="budget-category-input-mode">Editar el importe directamente</Label>
              <p className="text-sm text-muted-foreground">
                El importe se puede editar y el porcentaje se calcula automáticamente. Desactiva
                esta opción para editar el porcentaje.
              </p>
            </div>
          </div>
          <AccessibleField className="space-y-2">
            <Label htmlFor="budget-category-notes">Notas</Label>
            <Input
              id="budget-category-notes"
              placeholder="Notas opcionales"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </AccessibleField>
          {error && (
            <AccessibleFieldError className="text-sm text-destructive">
              {error}
            </AccessibleFieldError>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit}>
            Añadir categoría
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
