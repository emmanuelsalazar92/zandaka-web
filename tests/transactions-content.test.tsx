import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { TransactionsContent } from "@/components/transactions-content"

// Replace only the headless select primitive with an accessible native select.
// The real transaction component, handlers, dialog and payload construction run.
vi.mock("@/components/ui/select", async () => {
  const React = await import("react")
  const Trigger = () => null
  const Content = ({ children }: { children: React.ReactNode }) => <>{children}</>
  return {
    SelectTrigger: Trigger,
    SelectContent: Content,
    SelectValue: () => null,
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
      <option value={value}>{children}</option>
    ),
    Select: ({
      children,
      value,
      onValueChange,
      disabled,
    }: {
      children: React.ReactNode
      value: string
      onValueChange: (value: string) => void
      disabled?: boolean
    }) => {
      const items = React.Children.toArray(children).filter(React.isValidElement)
      const trigger = items.find((child) => child.type === Trigger) as
        | React.ReactElement<{ id?: string; "aria-label"?: string }>
        | undefined
      const content = items.find((child) => child.type === Content) as
        | React.ReactElement<{ children: React.ReactNode }>
        | undefined
      return (
        <select
          id={trigger?.props.id}
          aria-label={trigger?.props["aria-label"]}
          value={value}
          disabled={disabled}
          onChange={(event) => onValueChange(event.target.value)}
        >
          <option value="">Select</option>
          {content?.props.children}
        </select>
      )
    },
  }
})

vi.mock("@/components/transaction-timeline", () => ({
  TransactionTimeline: () => null,
  TransactionTimelineSkeleton: () => null,
}))

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  let data: unknown
  if (init?.method === "POST") {
    const payload = JSON.parse(String(init.body))
    data = {
      transaction: { ...payload, id: 100 },
      lines: payload.lines.map(
        (line: { accountId: number; envelopeId: number; amount: number }) => ({
          account_id: line.accountId,
          envelope_id: line.envelopeId,
          amount: line.amount,
        }),
      ),
    }
  } else if (url === "/api/accounts") {
    data = [{ id: 1, name: "Synthetic CRC", currency: "CRC", is_active: 1 }]
  } else if (url.includes("envelope-balances")) {
    data = [
      { envelopeId: 1, categoryId: 1, categoryName: "Source", balance: 0.02 },
      { envelopeId: 2, categoryId: 2, categoryName: "Destination", balance: 0 },
    ]
  } else {
    data = {
      data: [],
      meta: {
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    }
  }
  return { ok: true, json: async () => data, text: async () => "" } as Response
})

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function posts() {
  return fetchMock.mock.calls.filter((call) => call[1]?.method === "POST")
}

async function open(type = "INCOME") {
  render(<TransactionsContent />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/accounts", expect.anything()))
  fireEvent.click(screen.getByRole("button", { name: "Nuevo movimiento" }))
  const dialog = screen.getByRole("dialog")
  fireEvent.change(within(dialog).getByLabelText("Type"), { target: { value: type } })
  fireEvent.change(within(dialog).getByLabelText("Description"), {
    target: { value: "Synthetic test" },
  })
  await within(dialog).findByRole("option", { name: "Synthetic CRC" })
  fireEvent.change(within(dialog).getByRole("combobox", { name: "Account 1" }), {
    target: { value: "1" },
  })
  await within(dialog).findByRole("option", { name: "Source" })
  fireEvent.change(within(dialog).getByRole("combobox", { name: "Envelope 1" }), {
    target: { value: "1" },
  })
  return dialog
}

describe("transaction form regression", () => {
  it.each(["1000", "10000"])("submits %s unchanged after typing and blur", async (text) => {
    const dialog = await open()
    const input = within(dialog).getByLabelText(/^Importe/)
    let value = ""
    for (const digit of text) {
      value += digit
      fireEvent.change(input, { target: { value } })
      expect(input).toHaveValue(value)
    }
    fireEvent.blur(input)
    expect(input).toHaveValue(text)
    fireEvent.click(within(dialog).getByRole("button", { name: "Create Transaction" }))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(JSON.parse(String(posts()[0][1]?.body)).lines[0].amount).toBe(Number(text))
  })

  it.each(["1e-2", "12abc34", "1,000", "0.001", "0"])(
    "blocks %s and keeps the invalid text visible",
    async (text) => {
      const dialog = await open()
      const input = within(dialog).getByLabelText(/^Importe/)
      fireEvent.change(input, { target: { value: text } })
      fireEvent.blur(input)
      expect(input).toHaveValue(text)
      expect(input).toHaveAttribute("aria-invalid", "true")
      const button = within(dialog).getByRole("button", { name: "Create Transaction" })
      expect(button).toBeDisabled()
      fireEvent.click(button)
      expect(posts()).toHaveLength(0)
    },
  )

  it("submits a single negative-cent adjustment", async () => {
    const dialog = await open("ADJUSTMENT")
    const input = within(dialog).getByLabelText(/^Importe/)
    fireEvent.change(input, { target: { value: "-0.02" } })
    fireEvent.blur(input)
    expect(input).toHaveValue("-0.02")
    fireEvent.click(within(dialog).getByRole("button", { name: "Create Transaction" }))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(JSON.parse(String(posts()[0][1]?.body))).toMatchObject({
      type: "ADJUSTMENT",
      lines: [{ accountId: 1, envelopeId: 1, amount: -0.02 }],
    })
  })

  it("enables a transfer only with complete, valid, exactly opposite amounts", async () => {
    const dialog = await open("TRANSFER")
    fireEvent.change(within(dialog).getByLabelText(/^Importe/), { target: { value: "-0.1" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Line" }))
    fireEvent.change(within(dialog).getByRole("combobox", { name: "Account 2" }), {
      target: { value: "1" },
    })
    fireEvent.change(within(dialog).getByRole("combobox", { name: "Envelope 2" }), {
      target: { value: "2" },
    })
    const second = within(dialog).getAllByLabelText(/^Importe/)[1]
    const button = within(dialog).getByRole("button", { name: "Create Transaction" })
    fireEvent.change(second, { target: { value: "0.09" } })
    expect(button).toBeDisabled()
    fireEvent.change(second, { target: { value: "1e-1" } })
    expect(button).toBeDisabled()
    fireEvent.change(second, { target: { value: "0.1" } })
    expect(button).toBeEnabled()
    fireEvent.blur(second)
    fireEvent.click(button)
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(
      JSON.parse(String(posts()[0][1]?.body)).lines.map((line: { amount: number }) => line.amount),
    ).toEqual([-0.1, 0.1])
  })
})
