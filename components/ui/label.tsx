"use client"

import * as LabelPrimitive from "@radix-ui/react-label"
import * as React from "react"

import { useFieldLabel } from "@/components/ui/accessible-field"
import { cn } from "@/lib/utils"

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  const fieldId = useFieldLabel()
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
      htmlFor={props.htmlFor ?? fieldId}
    />
  )
}

export { Label }
