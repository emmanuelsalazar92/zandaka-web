import { describe, expect, it } from "vitest"

import {
  buildTransactionImportPayload,
  getImportRowValidationError,
} from "@/lib/transaction-import-helpers"

describe("transaction import helpers", () => {
  const accounts = [{ id: 10, currency: "CRC" }]
  const envelopesByAccount = {
    "10": [{ id: 20 }],
  }

  it("validates that a row is ready for import", () => {
    expect(
      getImportRowValidationError(
        {
          id: "row-1",
          date: "2026-03-02",
          description: "BAC test",
          amount: -2300,
          currency: "CRC",
          type: "EXPENSE",
          accountId: "10",
          envelopeId: "20",
        },
        accounts,
        envelopesByAccount,
      ),
    ).toBeNull()
  })

  it("rejects rows with missing required fields", () => {
    expect(
      getImportRowValidationError(
        {
          id: "row-2",
          date: "",
          description: "BAC test",
          amount: 0,
          currency: "CRC",
          type: "EXPENSE",
          accountId: "",
          envelopeId: "",
        },
        accounts,
        envelopesByAccount,
      ),
    ).toBe("Account is required")
  })

  it("builds the API payload without converting the date string", () => {
    expect(
      buildTransactionImportPayload(
        {
          id: "row-3",
          date: "2026-03-02",
          description: "BAC test",
          amount: 2300,
          currency: "CRC",
          type: "INCOME",
          accountId: "10",
          envelopeId: "20",
        },
        1,
      ),
    ).toEqual({
      userId: 1,
      date: "2026-03-02",
      type: "INCOME",
      description: "BAC test",
      lines: [
        {
          accountId: 10,
          envelopeId: 20,
          amount: 2300,
        },
      ],
    })
  })

  it("rejects rows when transaction currency does not match the selected account", () => {
    expect(
      getImportRowValidationError(
        {
          id: "row-4",
          date: "2026-03-02",
          description: "USD test",
          amount: 1.25,
          currency: "USD",
          type: "INCOME",
          accountId: "10",
          envelopeId: "20",
        },
        accounts,
        envelopesByAccount,
      ),
    ).toBe("Transaction currency USD does not match account currency CRC")
  })
})
