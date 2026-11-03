"use client"

import * as React from "react"

import { useFieldControl } from "@/components/ui/accessible-field"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  const fieldProps = useFieldControl(props)
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-control-border placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-card flex field-sizing-content min-h-16 w-full rounded-md border px-3 py-2 text-base shadow-none transition-[color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
      {...fieldProps}
    />
  )
}

export { Textarea }
