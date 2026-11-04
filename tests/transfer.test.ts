import { afterEach, describe, expect, it } from "vitest"

import {
  clearPendingTransfer,
  isTransferConfirmation,
  pendingTransferExists,
  readPendingTransfer,
  savePendingTransfer,
  transferRequestId,
  transferState,
  type PendingTransfer,
  type TransferDraft,
} from "@/lib/transfer"

const accounts = [
  { id: 1, name: "Source", currency: "CRC" },
  { id: 2, name: "Destination", currency: "CRC" },
  { id: 3, name: "USD", currency: "USD" },
]
const envelopes = [
  { id: 1, name: "Daily" },
  { id: 2, name: "Savings" },
]
const draft: TransferDraft = {
  date: "2026-11-03",
  description: "Savings",
  fromAccount: "1",
  fromEnvelope: "1",
  toAccount: "1",
  toEnvelope: "2",
  amount: "0.02",
}
const record = (): PendingTransfer => ({
  payload: {
    userId: 1,
    requestId: transferRequestId(),
    date: draft.date,
    description: draft.description,
    from: { accountId: 1, envelopeId: 1 },
    to: { accountId: 1, envelopeId: 2 },
    amount: 0.02,
  },
  fromLabel: "Source · Daily",
  toLabel: "Source · Savings",
  currency: "CRC",
})
afterEach(() => window.sessionStorage.clear())

describe("guided transfer intent", () => {
  it.each(["-0.02", "+0.02", "0", "0.001", "1e-2", "1,000", "12abc34", "99999999999999999999999"])(
    "keeps invalid positive input %s out of a valid intent",
    (amount) => {
      const result = transferState({ ...draft, amount }, accounts, envelopes, envelopes)
      expect(result.ready).toBe(false)
      expect(result.amountError).toBeTruthy()
    },
  )
  it("accepts exact cents between different envelopes or same-currency accounts", () => {
    expect(transferState(draft, accounts, envelopes, envelopes)).toMatchObject({
      ready: true,
      amount: 0.02,
    })
    expect(transferState({ ...draft, toAccount: "2" }, accounts, envelopes, envelopes).ready).toBe(
      true,
    )
  })
  it("blocks identical endpoints, absent envelopes, mixed currencies and invalid accounting dates", () => {
    expect(
      transferState({ ...draft, toEnvelope: "1" }, accounts, envelopes, envelopes).destinationError,
    ).toBeTruthy()
    expect(transferState(draft, accounts, envelopes, []).ready).toBe(false)
    expect(
      transferState({ ...draft, toAccount: "3" }, accounts, envelopes, envelopes).currencyError,
    ).toContain("no convierten")
    expect(
      transferState({ ...draft, date: "2026-02-30" }, accounts, envelopes, envelopes).ready,
    ).toBe(false)
  })
  it("generates a secure v4 request key without relying on secure-context randomUUID", () => {
    const ids = Array.from({ length: 20 }, transferRequestId)
    expect(new Set(ids).size).toBe(20)
    expect(
      ids.every((id) =>
        /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id),
      ),
    ).toBe(true)
  })
  it("retains one immutable attempt in tab-scoped storage and clears only explicitly", () => {
    const value = record()
    savePendingTransfer(value)
    expect(pendingTransferExists(1)).toBe(true)
    expect(readPendingTransfer(1)).toEqual(value)
    expect(readPendingTransfer(2)).toBeNull()
    expect(window.localStorage.length).toBe(0)
    clearPendingTransfer(1)
    expect(readPendingTransfer(1)).toBeNull()
  })
  it("fails closed on malformed recovery data instead of silently starting a new operation", () => {
    window.sessionStorage.setItem("zandaka.transfer.pending.v1.1", "{broken")
    expect(pendingTransferExists(1)).toBe(true)
    expect(() => readPendingTransfer(1)).toThrow()
  })
  it("accepts only a confirmation with the original user, metadata, endpoints and exact amounts", () => {
    const value = record()
    const response = {
      transaction: {
        id: 7,
        user_id: 1,
        type: "TRANSFER",
        date: draft.date,
        description: draft.description,
      },
      lines: [
        { account_id: 1, envelope_id: 1, amount: -0.02 },
        { account_id: 1, envelope_id: 2, amount: 0.02 },
      ],
    }
    expect(isTransferConfirmation(value, response)).toBe(true)
    expect(
      isTransferConfirmation(value, {
        ...response,
        transaction: { ...response.transaction, user_id: 2 },
      }),
    ).toBe(false)
    expect(
      isTransferConfirmation(value, {
        ...response,
        lines: [...response.lines.slice(0, 1), { account_id: 1, envelope_id: 2, amount: 0.03 }],
      }),
    ).toBe(false)
    expect(isTransferConfirmation(value, null)).toBe(false)
    expect(isTransferConfirmation(value, { ...response, lines: [null, response.lines[1]] })).toBe(
      false,
    )
  })
})
