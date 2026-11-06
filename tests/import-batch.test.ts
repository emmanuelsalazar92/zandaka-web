import { afterEach, describe, expect, it } from "vitest"

import {
  IMPORT_JOURNAL,
  importFingerprint,
  readImportJournal,
  writeImportReceipt,
} from "@/lib/import-batch"
const row = {
  id: "1",
  date: "2026-11-01",
  description: "Compra",
  amount: -10,
  currency: "CRC",
  type: "EXPENSE" as const,
  accountId: "1",
  envelopeId: "2",
}
afterEach(() => sessionStorage.clear())
describe("batch review journal", () => {
  it("keeps the same operation identifiable after reparsing without depending on random row IDs", () => {
    expect(importFingerprint(row)).toBe(importFingerprint({ ...row, id: "another" }))
    expect(importFingerprint(row)).not.toBe(importFingerprint({ ...row, currency: "USD" }))
    expect(importFingerprint(row)).not.toBe(importFingerprint({ ...row, envelopeId: "3" }))
  })
  it("persists an uncertain attempt before confirmation and allows recording its actual outcome", () => {
    const key = importFingerprint(row)
    writeImportReceipt(key, "pending")
    expect(readImportJournal()[key]).toBe("pending")
    writeImportReceipt(key, "confirmed")
    expect(readImportJournal()[key]).toBe("confirmed")
    expect(sessionStorage.getItem(IMPORT_JOURNAL)).not.toContain("Compra")
  })
  it("fails closed on an unreadable journal instead of treating it as no previous attempts", () => {
    sessionStorage.setItem(IMPORT_JOURNAL, "broken")
    expect(readImportJournal).toThrow()
    expect(() => writeImportReceipt(importFingerprint(row), "pending")).toThrow()
  })
})
