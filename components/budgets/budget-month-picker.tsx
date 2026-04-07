"use client"

import { ChevronDown } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

type BudgetMonthPickerProps = {
  value: string
  onChange: (value: string) => void
  emptyLabel?: string
  allowClear?: boolean
  triggerId?: string
  triggerClassName?: string
}

export function BudgetMonthPicker({
  value,
  onChange,
  emptyLabel = "Select month",
  allowClear = false,
  triggerId,
  triggerClassName,
}: BudgetMonthPickerProps) {
  const currentDate = new Date()
  const currentYear = currentDate.getFullYear()
  const initialParts = value ? value.split("-") : []
  const [year, setYear] = React.useState(initialParts[0] ?? "")
  const [month, setMonth] = React.useState(initialParts[1] ?? "")

  React.useEffect(() => {
    const nextParts = value ? value.split("-") : []
    setYear(nextParts[0] ?? "")
    setMonth(nextParts[1] ?? "")
  }, [value])

  const years = React.useMemo(
    () => Array.from({ length: 11 }, (_, index) => `${currentYear + 5 - index}`),
    [currentYear],
  )

  const label =
    year && month ? `${MONTH_NAMES[Number.parseInt(month, 10) - 1]} ${year}` : emptyLabel

  const applySelection = (nextYear: string, nextMonth: string) => {
    if (nextYear && nextMonth) {
      onChange(`${nextYear}-${nextMonth}`)
      return
    }

    if (allowClear) {
      onChange("")
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={triggerId}
          variant="outline"
          className={triggerClassName ?? "w-full justify-between font-normal"}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3" align="start">
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">Year</p>
            <Select
              value={year || undefined}
              onValueChange={(nextYear) => {
                setYear(nextYear)
                applySelection(nextYear, month)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Month</p>
            <Select
              value={month || undefined}
              onValueChange={(nextMonth) => {
                setMonth(nextMonth)
                applySelection(year, nextMonth)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, index) => {
                  const optionValue = `${index + 1}`.padStart(2, "0")
                  return (
                    <SelectItem key={optionValue} value={optionValue}>
                      {name}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          {allowClear ? (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setYear("")
                setMonth("")
                onChange("")
              }}
            >
              Clear month filter
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
