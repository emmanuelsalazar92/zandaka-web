"use client"

import { Check, ChevronsUpDown } from "lucide-react"
import * as React from "react"

import { useFieldControl } from "@/components/ui/accessible-field"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type SearchableOption = { value: string; label: string; disabled?: boolean }

/** Controlled single selection. Values must be unique; labels can repeat. */
export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Selecciona una opción",
  searchLabel = "Buscar opciones",
  emptyMessage = "No encontramos coincidencias.",
  disabled,
  loading,
  name,
  className,
  ...props
}: React.AriaAttributes & {
  id?: string
  options: readonly SearchableOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchLabel?: string
  emptyMessage?: string
  disabled?: boolean
  loading?: boolean
  name?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const field = useFieldControl(props)
  const selected = options.find((option) => option.value === value)
  return (
    <>
      {name && <input type="hidden" name={name} value={value} disabled={disabled} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full min-w-0 justify-between border-control-border bg-card text-left font-normal",
              className,
            )}
            {...props}
            {...field}
            aria-busy={loading || undefined}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault()
                setOpen(true)
              }
            }}
          >
            <span className={cn("min-w-0 break-words", !selected && "text-muted-foreground")}>
              {selected?.label ?? placeholder}
            </span>
            <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          aria-label={searchLabel}
          className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0"
        >
          <Command>
            <CommandInput aria-label={searchLabel} placeholder={searchLabel} />
            <CommandList>
              {loading ? (
                <p role="status" className="p-4 text-sm text-muted-foreground">
                  Cargando opciones…
                </p>
              ) : (
                <>
                  <CommandEmpty>{emptyMessage}</CommandEmpty>
                  <CommandGroup>
                    {options.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        keywords={[option.label]}
                        disabled={option.disabled}
                        className="min-h-control whitespace-normal"
                        onSelect={() => {
                          onValueChange(option.value)
                          setOpen(false)
                        }}
                      >
                        <Check
                          aria-hidden="true"
                          className={cn("size-4", value !== option.value && "invisible")}
                        />
                        <span className="min-w-0 break-words">{option.label}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  )
}
