import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it } from "vitest"

import { AccessibleField, AccessibleFieldError } from "@/components/ui/accessible-field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function Example() {
  const [error, setError] = useState(false)
  return (
    <>
      <AccessibleField>
        <Label>Importe</Label>
        <Input aria-describedby="amount-help" />
        <p id="amount-help">Usa punto o coma decimal.</p>
        {error && <AccessibleFieldError>Revisa el importe.</AccessibleFieldError>}
      </AccessibleField>
      <AccessibleField>
        <Label>Otra cuenta</Label>
        <Input />
      </AccessibleField>
      <button onClick={() => setError(!error)}>Cambiar validación</button>
    </>
  )
}

describe("accessible field contract", () => {
  it("associates stable unique names, help and dynamic errors without losing existing descriptions", async () => {
    render(<Example />)
    const input = screen.getByRole("textbox", { name: "Importe" })
    expect(input.id).not.toBe(screen.getByRole("textbox", { name: "Otra cuenta" }).id)
    fireEvent.click(screen.getByRole("button", { name: "Cambiar validación" }))
    await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "true"))
    expect(input).toHaveAccessibleDescription("Usa punto o coma decimal. Revisa el importe.")
    expect(screen.getByRole("alert")).toHaveTextContent("Revisa el importe.")
    fireEvent.click(screen.getByRole("button", { name: "Cambiar validación" }))
    await waitFor(() => expect(input).not.toHaveAttribute("aria-invalid"))
    expect(input).toHaveAccessibleDescription("Usa punto o coma decimal.")
  })
})
