import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { AppLayout } from "@/components/app-layout"

import type { AnchorHTMLAttributes, ReactNode } from "react"

vi.mock("next/navigation", () => ({ usePathname: () => "/" }))
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "dark", setTheme: vi.fn() }) }))
vi.mock("@/components/ui/use-mobile", () => ({ useIsMobile: () => true }))
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onNavigate,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string
    children: ReactNode
    onNavigate?: () => void
  }) => (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        event.preventDefault()
        onNavigate?.()
      }}
    >
      {children}
    </a>
  ),
}))

afterEach(cleanup)

describe("mobile navigation", () => {
  it("closes after choosing a destination and reports the actual mobile state", async () => {
    render(
      <AppLayout defaultSidebarOpen>
        <p>Contenido</p>
      </AppLayout>,
    )
    const trigger = screen.getByRole("button", { name: "Abrir navegación" })
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    fireEvent.click(trigger)
    const menu = screen.getByRole("dialog", { name: "Navegación" })
    expect(within(menu).queryByRole("link", { name: "Instituciones" })).not.toBeInTheDocument()
    expect(within(menu).queryByRole("link", { name: "Categorías" })).not.toBeInTheDocument()
    expect(within(menu).getByRole("link", { name: "Ajustes" })).toBeInTheDocument()
    fireEvent.click(within(menu).getByRole("link", { name: "Cuentas" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Abrir navegación" })).toHaveAttribute(
      "aria-expanded",
      "false",
    )
  })
})
