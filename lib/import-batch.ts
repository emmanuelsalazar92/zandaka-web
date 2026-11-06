import type { ImportTransactionRow } from "@/lib/transaction-import-helpers"

/** A collision only requests review; never proves duplication or discards a row. */
export function importFingerprint(row: ImportTransactionRow) {
  const text = JSON.stringify([
    row.date,
    row.description.trim(),
    row.amount,
    row.currency,
    row.type,
    row.accountId,
    row.envelopeId,
  ])
  let hash = BigInt("14695981039346656037")
  for (let i = 0; i < text.length; i++)
    hash = BigInt.asUintN(64, (hash ^ BigInt(text.charCodeAt(i))) * BigInt("1099511628211"))
  return hash.toString(16)
}
export type ImportReceipt = "pending" | "confirmed" | "rejected"
export const IMPORT_JOURNAL = "zandaka-import-review-v1"
export function readImportJournal(): Record<string, ImportReceipt> {
  const raw = sessionStorage.getItem(IMPORT_JOURNAL)
  if (!raw) return {}
  const data: unknown = JSON.parse(raw)
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Registro de importación no disponible")
  for (const [key, value] of Object.entries(data))
    if (
      !/^[0-9a-f]{1,16}$/.test(key) ||
      !["pending", "confirmed", "rejected"].includes(String(value))
    )
      throw new Error("Registro de importación no válido")
  return data as Record<string, ImportReceipt>
}
export function writeImportReceipt(key: string, value: ImportReceipt) {
  const journal = readImportJournal()
  sessionStorage.setItem(IMPORT_JOURNAL, JSON.stringify({ ...journal, [key]: value }))
}
