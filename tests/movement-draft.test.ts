import { describe, expect, it } from "vitest"

import {
  emptyMovementLine,
  isMovementConfirmation,
  movementLineState,
  movementTotals,
  recentMovementDestinations,
  selectMovementAccount,
  validMovementDate,
  type MovementPayload,
} from "@/lib/movement-draft"

const accounts = [
  { id: 1, name: "Diaria", currency: "CRC", institution: "Banco de ejemplo" },
  { id: 2, name: "Viajes", currency: "USD", institution: "Banco de ejemplo" },
]
const options = {
  "1": { status: "ready" as const, items: [{ id: 11, name: "Comida" }] },
  "2": { status: "ready" as const, items: [{ id: 21, name: "Estancia" }] },
}
const line = (amount: string, key = 1) => ({
  ...emptyMovementLine(key),
  accountId: "1",
  envelopeId: "11",
  amount,
})
describe("income and expense drafts", () => {
  it("clears money when a previous account vanished rather than guessing its currency", () => {
    const draft = line("0.02")
    expect(selectMovementAccount(draft, "2", accounts)).toMatchObject({
      amount: "",
      envelopeId: "",
    })
    expect(
      selectMovementAccount(
        draft,
        "2",
        accounts.filter((a) => a.id !== 1),
      ),
    ).toMatchObject({ amount: "", envelopeId: "" })
    expect(
      selectMovementAccount(draft, "3", [...accounts, { ...accounts[0], id: 3 }]),
    ).toMatchObject({ amount: "0.02", envelopeId: "" })
    expect(selectMovementAccount(draft, "1", accounts)).toBe(draft)
  })
  it("retains exact cents and applies existing income/expense normalization", () => {
    expect(movementTotals([line("0.1"), line("0.2", 2)], "INCOME", accounts, options)).toEqual([
      { currency: "CRC", amount: 0.3 },
    ])
    expect(movementTotals([line("0.02")], "EXPENSE", accounts, options)).toEqual([
      { currency: "CRC", amount: -0.02 },
    ])
    expect(movementLineState(line("-0.02"), "INCOME", accounts, options["1"]).amount).toBe(0.02)
  })
  it.each(["1e-2", "12abc34", "1,000", "0.001", "0"])(
    "rejects invalid %s without a total",
    (amount) => {
      expect(movementTotals([line(amount)], "EXPENSE", accounts, options)).toBeNull()
    },
  )
  it("does not sum different currencies or accept envelopes absent from the selected account", () => {
    expect(
      movementTotals(
        [line("0.1"), { ...line("0.2", 2), accountId: "2", envelopeId: "21" }],
        "INCOME",
        accounts,
        options,
      ),
    ).toEqual([
      { currency: "CRC", amount: 0.1 },
      { currency: "USD", amount: 0.2 },
    ])
    expect(
      movementLineState({ ...line("1"), envelopeId: "21" }, "INCOME", accounts, options["1"]).ready,
    ).toBe(false)
    expect(
      movementTotals([line("1")], "INCOME", accounts, { "1": { status: "error", items: [] } }),
    ).toBeNull()
  })
  it("uses real calendar dates", () => {
    expect(validMovementDate("2026-02-30")).toBe(false)
    expect(validMovementDate("2028-02-29")).toBe(true)
  })
  it("proposes unique recent destinations only for the kind and active accounts supplied", () => {
    const l = {
      accountId: 1,
      account: "Diaria",
      accountCurrency: "CRC",
      envelopeId: 11,
      envelope: "Comida",
      amount: -0.02,
    }
    const history = [
      { id: 1, date: "2026-11-01", description: "A", type: "EXPENSE" as const, lines: [l, l] },
      { id: 2, date: "2026-11-02", description: "B", type: "INCOME" as const, lines: [l] },
      {
        id: 3,
        date: "2026-11-03",
        description: "C",
        type: "EXPENSE" as const,
        lines: [{ ...l, accountId: 3 }],
      },
    ]
    expect(recentMovementDestinations(history, "EXPENSE", accounts)).toEqual([
      { accountId: 1, envelopeId: 11, label: "Diaria · Banco de ejemplo · CRC → Comida" },
    ])
  })
  it("requires a matching confirmation and respects multiplicity of repeated endpoints", () => {
    const payload: MovementPayload = {
      userId: 1,
      date: "2026-11-04",
      description: "Prueba",
      type: "INCOME",
      lines: [
        { accountId: 1, envelopeId: 11, amount: 0.1 },
        { accountId: 1, envelopeId: 11, amount: 0.2 },
      ],
    }
    const transaction = {
      id: 1,
      user_id: 1,
      date: payload.date,
      description: payload.description,
      type: payload.type,
    }
    expect(
      isMovementConfirmation(payload, { transaction, lines: [...payload.lines].reverse() }),
    ).toBe(true)
    expect(
      isMovementConfirmation(payload, { transaction, lines: [payload.lines[0], payload.lines[0]] }),
    ).toBe(false)
    expect(isMovementConfirmation(payload, { transaction, lines: [null, payload.lines[1]] })).toBe(
      false,
    )
    expect(
      isMovementConfirmation(payload, {
        transaction: { ...transaction, user_id: 2 },
        lines: payload.lines,
      }),
    ).toBe(false)
  })
})
