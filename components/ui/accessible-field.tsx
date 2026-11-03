"use client"

import * as React from "react"

type FieldContextValue = {
  id: string
  errors: string[]
  registerError: (id: string, present: boolean) => void
}
const FieldContext = React.createContext<FieldContextValue | null>(null)

/** One visible label and one control; IDs remain stable across SSR, dialogs and repeated rows. */
export function AccessibleField({ children, ...props }: React.ComponentProps<"div">) {
  const id = React.useId()
  const [errors, setErrors] = React.useState<string[]>([])
  const registerError = React.useCallback((errorId: string, present: boolean) => {
    setErrors((current) => {
      if (current.includes(errorId) === present) return current
      return present ? [...current, errorId] : current.filter((item) => item !== errorId)
    })
  }, [])
  const value = React.useMemo(() => ({ id, errors, registerError }), [id, errors, registerError])
  return (
    <FieldContext.Provider value={value}>
      <div {...props}>{children}</div>
    </FieldContext.Provider>
  )
}

export function useFieldLabel() {
  return React.useContext(FieldContext)?.id
}

export function useFieldControl(props: React.AriaAttributes & { id?: string }) {
  const field = React.useContext(FieldContext)
  const descriptions = [
    ...new Set([...(props["aria-describedby"]?.split(/\s+/) ?? []), ...(field?.errors ?? [])]),
  ]
    .filter(Boolean)
    .join(" ")
  return {
    id: props.id ?? field?.id,
    "aria-invalid": props["aria-invalid"] ?? (field?.errors.length ? true : undefined),
    "aria-describedby": descriptions || undefined,
  }
}

export function AccessibleFieldError({
  children,
  id: explicitId,
  ...props
}: React.ComponentProps<"p">) {
  const generatedId = React.useId()
  const id = explicitId ?? generatedId
  const registerError = React.useContext(FieldContext)?.registerError
  const present =
    children !== null && children !== undefined && children !== false && children !== ""
  React.useEffect(() => {
    registerError?.(id, present)
    return () => registerError?.(id, false)
  }, [id, present, registerError])
  return present ? (
    <p {...props} id={id} role="alert">
      {children}
    </p>
  ) : null
}
