"use client"

import * as React from "react"

import type { BudgetCategoryOption } from "@/components/budgets/types"
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

type AddBudgetCategoryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: BudgetCategoryOption[]
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
  const parsedAmount = Number.parseFloat(amount || "0")
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

    const parsedAmount = Number.parseFloat(value || "0")
    const nextAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0
    const nextPercentage = totalIncome > 0 ? (nextAmount / totalIncome) * 100 : 0
    setPercentage(value === "" ? "" : nextPercentage.toFixed(2))
  }

  const handlePercentageChange = (value: string) => {
    setPercentage(value)

    if (isAmountInputMode) return

    const parsedPercentage = Number.parseFloat(value || "0")
    const nextPercentage = Number.isFinite(parsedPercentage) ? parsedPercentage : 0
    const nextAmount = totalIncome > 0 ? (nextPercentage / 100) * totalIncome : 0
    setAmount(value === "" ? "" : nextAmount.toFixed(2))
  }

  const handleInputModeChange = (checked: boolean) => {
    setIsAmountInputMode(checked)

    if (checked) {
      const currentAmount = amount
      setAmount(currentAmount)
      if (currentAmount !== "") {
        const parsedAmount = Number.parseFloat(currentAmount || "0")
        const nextAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0
        const nextPercentage = totalIncome > 0 ? (nextAmount / totalIncome) * 100 : 0
        setPercentage(nextPercentage.toFixed(2))
      }
      return
    }

    const currentPercentage = percentage
    setPercentage(currentPercentage)
    if (currentPercentage !== "") {
      const parsedPercentage = Number.parseFloat(currentPercentage || "0")
      const nextPercentage = Number.isFinite(parsedPercentage) ? parsedPercentage : 0
      const nextAmount = totalIncome > 0 ? (nextPercentage / 100) * totalIncome : 0
      setAmount(nextAmount.toFixed(2))
    }
  }

  const handleConfirm = () => {
    const parsedCategoryId = Number.parseInt(childCategoryId, 10)
    const parsedAmount = Number.parseFloat(amount || "0")
    const parsedPercentage = Number.parseFloat(percentage || "0")

    if (!parentCategoryId || !childCategoryId || Number.isNaN(parsedCategoryId)) {
      setError("Choose a parent category and a child category.")
      return
    }

    if (existingCategoryIds.includes(parsedCategoryId)) {
      setError("That category is already part of this budget.")
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
          <DialogTitle>Add Category</DialogTitle>
          <DialogDescription>
            Add a child category to this budget plan. You can set an initial amount, percentage, and
            notes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="budget-parent-category">Parent Category</Label>
            <Select value={parentCategoryId} onValueChange={handleParentChange}>
              <SelectTrigger id="budget-parent-category">
                <SelectValue placeholder="Select parent category" />
              </SelectTrigger>
              <SelectContent>
                {parentCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget-child-category">Child Category</Label>
            <Select
              value={childCategoryId}
              onValueChange={setChildCategoryId}
              disabled={!parentCategoryId}
            >
              <SelectTrigger id="budget-child-category">
                <SelectValue placeholder="Select child category" />
              </SelectTrigger>
              <SelectContent>
                {childCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="budget-category-amount">Amount</Label>
              <Input
                id="budget-category-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => handleAmountChange(event.target.value)}
                disabled={!isAmountInputMode}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget-category-percentage">Percentage</Label>
              <Input
                id="budget-category-percentage"
                type="number"
                min="0"
                step="0.01"
                value={percentage}
                onChange={(event) => handlePercentageChange(event.target.value)}
                disabled={isAmountInputMode}
              />
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              id="budget-category-input-mode"
              checked={isAmountInputMode}
              onCheckedChange={(checked) => handleInputModeChange(Boolean(checked))}
            />
            <div className="space-y-1">
              <Label htmlFor="budget-category-input-mode">Edit amount directly</Label>
              <p className="text-sm text-muted-foreground">
                Enabled by default. Amount stays editable and percentage is auto-calculated. Turn it
                off to edit percentage and auto-calculate amount.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget-category-notes">Notes</Label>
            <Input
              id="budget-category-notes"
              placeholder="Optional notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit}>
            Add Category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
