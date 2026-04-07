"use client"

import { CalendarRange, Wallet } from "lucide-react"

import { BudgetMonthPicker } from "@/components/budgets/budget-month-picker"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type BudgetIncomeFormProps = {
  month: string
  currency: string
  grossSalaryInput: string
  currencies: string[]
  onMonthChange: (value: string) => void
  onCurrencyChange: (value: string) => void
  onGrossSalaryChange: (value: string) => void
}

export function BudgetIncomeForm({
  month,
  currency,
  grossSalaryInput,
  currencies,
  onMonthChange,
  onCurrencyChange,
  onGrossSalaryChange,
}: BudgetIncomeFormProps) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>1. Base Income</CardTitle>
          <CardDescription>
            Choose the budget period and the original income that will feed the simulation.
          </CardDescription>
        </div>
        <CardAction>
          <Badge variant="outline" className="gap-1.5">
            <CalendarRange className="h-3.5 w-3.5" />
            Required
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
          <div className="space-y-2">
            <Label htmlFor="budget-month">Month</Label>
            <BudgetMonthPicker
              triggerId="budget-month"
              value={month}
              onChange={onMonthChange}
              triggerClassName="w-full justify-between font-normal"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget-currency">Currency</Label>
            <Select value={currency} onValueChange={onCurrencyChange}>
              <SelectTrigger id="budget-currency">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget-income">Original Income</Label>
            <Input
              id="budget-income"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={grossSalaryInput}
              onChange={(event) => onGrossSalaryChange(event.target.value)}
            />
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
          <Wallet className="mt-0.5 h-4 w-4 text-cyan-300" />
          <div className="space-y-1 text-sm">
            <p className="font-medium">Used as the payroll simulation base</p>
            <p className="text-muted-foreground">
              The original income also acts as the gross salary input for automatic deductions.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
