import { afterEach, describe, expect, it, vi } from "vitest"

import {
  canDeactivateContextAccount,
  contextActivityLink,
  contextDistribution,
  contextTotals,
  contextWrite,
  ContextWriteError,
  parseContextAccounts,
  parseContextCategories,
  parseContextEnvelopes,
  selectContextRows,
} from "@/lib/account-context"
import { accountContextHistoryFilters, historyQuery } from "@/lib/transaction-history"

const raw = {
  id: 1,
  name: "Cuenta",
  currency: "CRC",
  institution_id: 1,
  institution: "Banco",
  is_active: 1,
  allow_overdraft: 1,
  balance: 10,
  has_active_envelopes: true,
  active_envelopes_count: 2,
}
const account = () => parseContextAccounts([raw])[0]
const envelopes = (balances: Array<number | null>) =>
  parseContextEnvelopes(
    balances.map((balance, index) => ({
      envelopeId: 20 + index,
      categoryId: 100 + index,
      categoryName: `Sobre ${index}`,
      currency: "CRC",
      balance,
    })),
    account(),
  )
afterEach(() => vi.unstubAllGlobals())

describe("account and envelope context", () => {
  it("keeps a missing balance unknown and rejects invalid monetary values or duplicate records", () => {
    expect(parseContextAccounts([{ ...raw, balance: null }])[0].balance).toBeNull()
    expect(parseContextAccounts([{ ...raw, balance: undefined }])[0].balance).toBeNull()
    expect(() => parseContextAccounts([{ ...raw, balance: "0" }])).toThrow()
    expect(() => parseContextAccounts([{ ...raw, balance: 0.001 }])).toThrow()
    expect(() => parseContextAccounts([raw, raw])).toThrow()
  })
  it("never combines currencies or labels a partial per-currency amount complete", () => {
    const rows = [account(), { ...account(), id: 2, currency: "USD", balance: 1.5 }]
    expect(contextTotals(rows).map((row) => [row.currency, row.total])).toEqual([
      ["CRC", 10],
      ["USD", 1.5],
    ])
    expect(contextTotals([...rows, { ...account(), id: 3, balance: null }])[0].total).toBeNull()
  })
  it("uses only positive balances as denominator while including negatives in the signed total", () => {
    const rows = envelopes([100, 50, -10, 0])
    const result = contextDistribution(rows)
    expect(result.total).toBe(140)
    expect(result.positive).toBe(150)
    expect(result.share(rows[0])).toBe(66.67)
    expect(result.share(rows[2])).toBeNull()
    expect(result.share(rows[3])).toBeNull()
  })
  it("keeps known negatives visible while unknown data withholds the total and shares", () => {
    const rows = envelopes([null, -10, 50])
    const result = contextDistribution(rows)
    expect(result.total).toBeNull()
    expect(result.positive).toBeNull()
    expect(result.negative[0].balance).toBe(-10)
    expect(result.share(rows[2])).toBeNull()
    expect(() =>
      parseContextEnvelopes(
        [{ envelopeId: 1, categoryId: 1, categoryName: "Otro", balance: 5, currency: "USD" }],
        account(),
      ),
    ).toThrow()
    expect(contextDistribution([rows[2], { ...rows[2], currency: "USD" }]).total).toBeNull()
  })
  it("searches without accent sensitivity, sorts unknown balances last and leaves source data untouched", () => {
    const rows = [
      { name: "Teléfono", balance: 1 },
      { name: "Casa", balance: null },
      { name: "Reserva", balance: -2 },
    ]
    expect(selectContextRows(rows, "telefono", "name")[0].name).toBe("Teléfono")
    expect(selectContextRows(rows, "", "asc").map((row) => row.name)).toEqual([
      "Reserva",
      "Teléfono",
      "Casa",
    ])
    expect(rows[0].name).toBe("Teléfono")
    const mixed = [
      { name: "USD", currency: "USD", balance: 1000 },
      { name: "CRC", currency: "CRC", balance: 1 },
    ]
    expect(selectContextRows(mixed, "", "desc")[0].currency).toBe("CRC")
  })
  it("keeps server deactivation semantics: account with no active envelopes may have a historical balance", () => {
    expect(canDeactivateContextAccount(account())).toBe(false)
    expect(
      canDeactivateContextAccount({
        ...account(),
        hasActiveEnvelopes: false,
        activeEnvelopesCount: 0,
        balance: 50,
      }),
    ).toBe(true)
    expect(
      canDeactivateContextAccount({
        ...account(),
        hasActiveEnvelopes: null,
        activeEnvelopesCount: null,
      }),
    ).toBe(false)
  })
  it("uses category IDs for envelope activity and preserves the full history of an account", () => {
    const link = new URL(contextActivityLink(4, 100), "http://local.test")
    const filters = accountContextHistoryFilters(link.searchParams)!
    expect(historyQuery(filters, 1, 10, 1)).toContain("accountId=4&categoryId=100")
    expect(filters.dateFrom).toBe("")
    const accountFilters = accountContextHistoryFilters(
      new URL(contextActivityLink(4), "http://local.test").searchParams,
    )!
    expect(accountFilters.envelopeId).toBe("ALL")
    for (const query of [
      "source=account-context&accountId=0",
      "source=account-context&accountId=1&accountId=2",
      "source=account-context&accountId=1&categoryId=bad",
    ])
      expect(accountContextHistoryFilters(new URLSearchParams(query))).toBeNull()
  })
  it("reads the existing category contract without admitting inactive or foreign-user options", () => {
    expect(parseContextAccounts([{ ...raw, user_id: 2 }])).toEqual([])
    expect(
      parseContextCategories([
        { id: 1, name: "Grupo", parent_id: null, is_active: 1, user_id: 1 },
        { id: 2, name: "Privado", parent_id: 1, is_active: 1, user_id: 2 },
        { id: 3, name: "Inactivo", parent_id: 1, is_active: 0, user_id: 1 },
      ]),
    ).toEqual([{ id: 1, name: "Grupo", parentId: null }])
  })
  it("never invents a resource ID or retries a lost/malformed write confirmation", async () => {
    const fetch = vi.fn(async () => Response.json({ name: "Unconfirmed" }, { status: 201 }))
    vi.stubGlobal("fetch", fetch)
    await expect(contextWrite("/accounts", "POST", {})).rejects.toMatchObject({ uncertain: true })
    expect(fetch).toHaveBeenCalledTimes(1)
    fetch.mockImplementation(async () => {
      throw new Error("network secret")
    })
    await expect(contextWrite("/accounts", "POST", {})).rejects.toBeInstanceOf(ContextWriteError)
    expect(fetch).toHaveBeenCalledTimes(2)
    fetch.mockImplementation(async () => new Response(null, { status: 204 }))
    await expect(contextWrite("/accounts", "POST", {})).rejects.toMatchObject({ uncertain: true })
    await expect(contextWrite("/accounts/1/deactivate", "POST")).resolves.toBeNull()
  })
})
