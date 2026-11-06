import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { LoadingSkeleton } from "@/components/loading-skeleton"
import { Button } from "@/components/ui/button"
import { Feedback, LoadingState } from "@/components/ui/feedback"
describe("shared operation feedback", () => {
  it("announces one loading message while hiding decorative placeholders", () => {
    render(<LoadingSkeleton rows={3} columns={4} label="Consultando tus cuentas" />)
    expect(screen.getByRole("status")).toHaveTextContent("Consultando tus cuentas")
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true")
    expect(document.querySelectorAll('[data-slot="skeleton"][aria-hidden="true"]')).toHaveLength(12)
  })
  it("keeps the recovery action operable alongside an atomic error announcement", () => {
    const retry = vi.fn()
    render(
      <Feedback
        tone="error"
        title="Consulta pendiente"
        action={<Button onClick={retry}>Consultar de nuevo</Button>}
      >
        El formulario conserva sus datos.
      </Feedback>,
    )
    expect(screen.getByRole("alert")).toHaveAttribute("aria-atomic", "true")
    fireEvent.click(screen.getByRole("button", { name: "Consultar de nuevo" }))
    expect(retry).toHaveBeenCalledOnce()
  })
  it("retains a visible loading explanation when decorative motion is absent", () => {
    render(<LoadingState>Guardando tu selección…</LoadingState>)
    expect(screen.getByRole("status")).toHaveTextContent("Guardando tu selección…")
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite")
  })
})
