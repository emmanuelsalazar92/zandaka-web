"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"

import styles from "./plan.module.css"

export function PlanField({
  label,
  children,
  help,
}: {
  label: string
  children: React.ReactElement<{ id?: string; "aria-describedby"?: string }>
  help?: string
}) {
  const id = React.useId()
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {React.cloneElement(children, { id, "aria-describedby": help ? `${id}-help` : undefined })}
      {help && (
        <p id={`${id}-help`} className={styles.fieldHelp}>
          {help}
        </p>
      )}
    </div>
  )
}
export function AmountField({
  label,
  value,
  onChange,
  help,
  disabled = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  help?: string
  disabled?: boolean
}) {
  return (
    <PlanField label={label} help={help}>
      <Input
        inputMode="decimal"
        type="text"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value.replace(",", "."))}
      />
    </PlanField>
  )
}
