"use client"

import * as React from "react"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

type ToggleRowProps = {
  id: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  title: string
  description: string
  hint?: React.ReactNode
  amount?: React.ReactNode
  meta?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

export function ToggleRow({
  id,
  checked,
  onCheckedChange,
  disabled = false,
  title,
  description,
  hint,
  amount,
  meta,
  children,
  className,
}: ToggleRowProps) {
  return (
    <div className={cn("rounded-xl border border-border/70 bg-background/40 p-4", className)}>
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor={id} className="text-sm font-medium">
              {title}
            </Label>
            {meta}
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
          {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
        </div>

        <div className="flex items-center gap-3">
          {amount ? <div className="min-w-[120px] text-right">{amount}</div> : null}
          <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
        </div>
      </div>

      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  )
}
