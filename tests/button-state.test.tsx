import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { Button } from "@/components/ui/button"

describe("busy action contract", () => {
  it("preserves the accessible action name and blocks repeated activation until completion", () => {
    const submit = vi.fn()
    const { rerender } = render(
      <Button loading onClick={submit}>
        Guardar movimiento
      </Button>,
    )
    const button = screen.getByRole("button", { name: "Guardar movimiento" })
    expect(button).toHaveAttribute("aria-busy", "true")
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(submit).not.toHaveBeenCalled()
    rerender(<Button onClick={submit}>Guardar movimiento</Button>)
    expect(button).not.toHaveAttribute("aria-busy")
    expect(button).not.toBeDisabled()
    fireEvent.click(button)
    expect(submit).toHaveBeenCalledOnce()
  })
  it("keeps link semantics when composed through Slot", () => {
    render(
      <Button asChild>
        <a href="/accounts">Ver cuentas</a>
      </Button>,
    )
    expect(screen.getByRole("link", { name: "Ver cuentas" })).toHaveAttribute("href", "/accounts")
  })
})
