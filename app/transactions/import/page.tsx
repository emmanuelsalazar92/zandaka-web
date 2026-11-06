"use client"

import { AlertCircle, Check, FileUp, Trash2, X } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"

import { PageHeader } from "@/components/page-header"
import { AccessibleField } from "@/components/ui/accessible-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import {
  parseGrupoMutual,
  parseBacCredomatic,
  type ParsedTransaction,
  type CurrencyCode,
} from "@/lib/bank-import"
import { formatCurrency } from "@/lib/currency-formatter"
import { formatIsoDateOnly } from "@/lib/date-only"
import { readPublicError } from "@/lib/public-error"
import { fetchAutoAssignmentRules, type AutoAssignmentRule } from "@/lib/settings-api"
import {
  buildTransactionImportPayload,
  getImportRowValidationError,
} from "@/lib/transaction-import-helpers"

type TransactionType = ParsedTransaction["type"]

type BankFormat = "grupo-mutual" | "bac-credomatic"
const API_BASE_URL = "/api"
const CURRENT_USER_ID = 1

function matchesAutoAssignmentRule(description: string, rule: AutoAssignmentRule) {
  const candidate = description.trim().toUpperCase()
  const pattern = rule.pattern.trim().toUpperCase()

  if (!candidate || !pattern) return false

  switch (rule.matchType) {
    case "CONTAINS":
      return candidate.includes(pattern)
    case "STARTS_WITH":
      return candidate.startsWith(pattern)
    case "ENDS_WITH":
      return candidate.endsWith(pattern)
    case "EXACT":
      return candidate === pattern
    case "REGEX":
      try {
        return new RegExp(rule.pattern, "i").test(description)
      } catch {
        return false
      }
    default:
      return false
  }
}

function applyAutoAssignmentRules(transactions: ParsedTransaction[], rules: AutoAssignmentRule[]) {
  const orderedRules = rules
    .filter((rule) => rule.isActive)
    .slice()
    .sort((a, b) => a.priority - b.priority || a.id - b.id)

  return transactions.map((transaction) => {
    const matchedRule = orderedRules.find((rule) =>
      matchesAutoAssignmentRule(transaction.description, rule),
    )

    if (!matchedRule) return transaction

    const matchedAccountId = matchedRule.accountId ?? matchedRule.accountEnvelopeAccountId

    return {
      ...transaction,
      accountId: matchedAccountId ? String(matchedAccountId) : transaction.accountId,
      envelopeId: matchedRule.accountEnvelopeId
        ? String(matchedRule.accountEnvelopeId)
        : transaction.envelopeId,
      appliedRuleName: matchedRule.pattern,
    }
  })
}

function getAccountsForTransaction(
  transaction: ParsedTransaction,
  accounts: { id: number; name: string; currency: string; active: boolean }[],
) {
  return accounts.filter(
    (account) =>
      account.active && account.currency.toUpperCase() === transaction.currency.toUpperCase(),
  )
}

export default function ImportTransactionsPage() {
  const router = useRouter()
  const [bankFormat, setBankFormat] = React.useState<BankFormat>("grupo-mutual")
  const [bacCurrency, setBacCurrency] = React.useState<CurrencyCode>("CRC")
  const [rawData, setRawData] = React.useState("")
  const [transactions, setTransactions] = React.useState<ParsedTransaction[]>([])
  const [isProcessed, setIsProcessed] = React.useState(false)
  const [isImporting, setIsImporting] = React.useState(false)
  const [importError, setImportError] = React.useState<string | null>(null)
  const [autoAssignmentRules, setAutoAssignmentRules] = React.useState<AutoAssignmentRule[]>([])

  // Accounts and envelopes state
  const [accounts, setAccounts] = React.useState<
    { id: number; name: string; currency: string; active: boolean }[]
  >([])
  const [accountsLoading, setAccountsLoading] = React.useState(false)
  const [envelopesByAccount, setEnvelopesByAccount] = React.useState<
    Record<string, { id: number; name: string; categoryId: number }[]>
  >({})
  const [envelopesLoading, setEnvelopesLoading] = React.useState<Record<string, boolean>>({})

  const activeAccounts = React.useMemo(
    () => accounts.filter((account) => account.active),
    [accounts],
  )
  const importCandidates = React.useMemo(
    () => transactions.filter((transaction) => transaction.status !== "error"),
    [transactions],
  )
  const importableTransactions = React.useMemo(
    () =>
      importCandidates.filter(
        (transaction) =>
          !getImportRowValidationError(transaction, activeAccounts, envelopesByAccount),
      ),
    [activeAccounts, envelopesByAccount, importCandidates],
  )

  // Fetch accounts on mount
  React.useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setAccountsLoading(true)
        const res = await fetch(`${API_BASE_URL}/accounts`, {
          headers: { Accept: "application/json" },
        })
        if (!res.ok) throw new Error("No pudimos cargar las cuentas. Vuelve a intentar.")
        const data = (await res.json()) as {
          id: number
          name: string
          currency: string
          is_active: number
        }[]
        setAccounts(
          data.map((account) => ({
            id: account.id,
            name: account.name,
            currency: account.currency,
            active: account.is_active === 1,
          })),
        )
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "No pudimos cargar las cuentas. Vuelve a intentar."
        setImportError(message)
      } finally {
        setAccountsLoading(false)
      }
    }

    fetchAccounts()
  }, [])

  React.useEffect(() => {
    const loadRules = async () => {
      try {
        const rules = await fetchAutoAssignmentRules()
        setAutoAssignmentRules(rules.filter((rule) => rule.isActive))
      } catch {
        // Rules are assistive only; importing should still work if they cannot be loaded.
      }
    }

    void loadRules()
  }, [])

  const fetchEnvelopes = React.useCallback(
    async (accountId: string) => {
      if (!accountId || envelopesByAccount[accountId] || envelopesLoading[accountId]) return

      setEnvelopesLoading((prev) => ({ ...prev, [accountId]: true }))
      try {
        const res = await fetch(
          `${API_BASE_URL}/reports/envelope-balances?accountId=${accountId}`,
          { headers: { Accept: "application/json" } },
        )
        if (!res.ok) throw new Error("No pudimos cargar los sobres. Vuelve a intentar.")
        const data = (await res.json()) as {
          envelopeId: number
          categoryId: number
          categoryName: string
        }[]
        setEnvelopesByAccount((prev) => ({
          ...prev,
          [accountId]: data.map((env) => ({
            id: env.envelopeId,
            categoryId: env.categoryId,
            name: env.categoryName,
          })),
        }))
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "No pudimos cargar los sobres. Vuelve a intentar."
        setImportError(message)
      } finally {
        setEnvelopesLoading((prev) => ({ ...prev, [accountId]: false }))
      }
    },
    [envelopesByAccount, envelopesLoading],
  )

  const syncTransactionStatuses = React.useCallback(
    (rows: ParsedTransaction[]): ParsedTransaction[] =>
      rows.map((row) => {
        if (row.status === "error") return row

        const validationError = getImportRowValidationError(row, activeAccounts, envelopesByAccount)

        return {
          ...row,
          status: validationError ? ("warning" as const) : ("valid" as const),
          statusMessage: validationError ?? undefined,
        }
      }),
    [activeAccounts, envelopesByAccount],
  )

  React.useEffect(() => {
    setTransactions((prev) => syncTransactionStatuses(prev))
  }, [syncTransactionStatuses])

  const handleProcess = () => {
    if (!rawData.trim()) return

    let parsed: ParsedTransaction[] = []
    if (bankFormat === "grupo-mutual") {
      parsed = parseGrupoMutual(rawData)
    } else {
      parsed = parseBacCredomatic(rawData, bacCurrency)
    }

    const withRules = applyAutoAssignmentRules(parsed, autoAssignmentRules)
    const matchedAccountIds = Array.from(
      new Set(withRules.map((transaction) => transaction.accountId).filter(Boolean)),
    )
    matchedAccountIds.forEach((accountId) => {
      void fetchEnvelopes(accountId)
    })

    setTransactions(syncTransactionStatuses(withRules))
    setIsProcessed(true)
    setImportError(null)
  }

  const handleClear = () => {
    setRawData("")
    setTransactions([])
    setIsProcessed(false)
    setImportError(null)
  }

  const updateTransaction = (id: string, field: keyof ParsedTransaction, value: string) => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t

        const updated = { ...t, [field]: value }

        // If account changed, reset envelope and fetch new ones
        if (field === "accountId") {
          updated.envelopeId = ""
          if (value) {
            fetchEnvelopes(value)
          }
        }

        const validationError = getImportRowValidationError(
          updated,
          activeAccounts,
          envelopesByAccount,
        )
        updated.status = validationError ? "warning" : "valid"
        updated.statusMessage = validationError ?? undefined

        return updated
      }),
    )
  }

  const removeTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id))
  }

  // Summary counts
  const totalCount = transactions.length
  const validCount = importableTransactions.length
  const warningCount = transactions.filter((t) => t.status === "warning").length
  const errorCount = transactions.filter((t) => t.status === "error").length
  const importableCount = importableTransactions.length

  const handleImport = async () => {
    if (importableTransactions.length === 0) return

    setIsImporting(true)
    setImportError(null)

    let successCount = 0
    let failedCount = 0

    for (const transaction of importableTransactions) {
      const validationError = getImportRowValidationError(
        transaction,
        activeAccounts,
        envelopesByAccount,
      )
      if (validationError) {
        failedCount += 1
        continue
      }

      try {
        const payload = buildTransactionImportPayload(transaction, CURRENT_USER_ID)
        const res = await fetch(`${API_BASE_URL}/transactions`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          await readPublicError(
            res,
            "No pudimos importar el movimiento. Revisa sus datos y vuelve a intentar.",
          )
          failedCount += 1
          continue
        }

        successCount += 1
      } catch {
        failedCount += 1
      }
    }

    setIsImporting(false)

    if (successCount === 0) {
      const summary = `Se importaron 0 movimientos; ${failedCount} pendientes`
      setImportError(summary)
      toast({
        title: "No se completó la importación",
        description: summary,
        variant: "destructive",
      })
      return
    }

    const description =
      failedCount === 0
        ? `${successCount} movimientos importados correctamente`
        : `Se importaron ${successCount} movimientos; ${failedCount} pendientes`

    toast({
      title: failedCount === 0 ? "Importación completa" : "Importación con pendientes",
      description,
      variant: failedCount === 0 ? "default" : "destructive",
    })
    router.push("/transactions")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={<>Importar movimientos</>}
        description={
          <>Pega los movimientos de tu banco, revísalos y asígnalos a tus cuentas y sobres.</>
        }
        actionsLabel="Acciones de importar movimientos"
      ></PageHeader>

      {/* Import Error */}
      {importError && (
        <Alert className="border-destructive/50 bg-destructive/5">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-sm">{importError}</AlertDescription>
        </Alert>
      )}

      {/* Top Section - Import Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Preparar importación</CardTitle>
          <CardDescription>
            Elige el formato del banco y pega los movimientos copiados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <AccessibleField className="w-64 space-y-2">
              <Label className="text-sm font-medium">Formato del banco</Label>
              <Select value={bankFormat} onValueChange={(v) => setBankFormat(v as BankFormat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grupo-mutual">Grupo Mutual</SelectItem>
                  <SelectItem value="bac-credomatic">BAC Credomatic</SelectItem>
                </SelectContent>
              </Select>
            </AccessibleField>
            {bankFormat === "bac-credomatic" && (
              <AccessibleField className="w-52 space-y-2">
                <Label className="text-sm font-medium">Moneda de BAC</Label>
                <Select
                  value={bacCurrency}
                  onValueChange={(v) => setBacCurrency(v as CurrencyCode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CRC">CRC</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </AccessibleField>
            )}
            <div className="flex gap-2">
              <Button onClick={handleProcess} disabled={!rawData.trim()}>
                <FileUp className="mr-2 h-4 w-4" />
                Procesar movimientos
              </Button>
              <Button variant="outline" onClick={handleClear}>
                Limpiar
              </Button>
            </div>
          </div>

          <AccessibleField className="space-y-2">
            <Label className="text-sm font-medium">Pegar movimientos</Label>
            <Textarea
              placeholder={
                bankFormat === "grupo-mutual"
                  ? "Paste transactions from Grupo Mutual...\n\nExample:\n15/03/2026\n11:22:40 PM\nPAGO INTERESES\n₡7,379.25\n₡25,307,671.77"
                  : "Paste transactions from BAC Credomatic...\nChoose the BAC currency above first.\n\nExample:\n02/03/2026\t30100000\tCOMERCIAL LA GUARIA\t2,300.00\t0.00\t114,501.92"
              }
              value={rawData}
              onChange={(e) => setRawData(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
            />
          </AccessibleField>
        </CardContent>
      </Card>

      {/* Bottom Section - Parsed Transactions */}
      {isProcessed && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Revisión de movimientos</CardTitle>
                <CardDescription>
                  Revisa y edita los movimientos antes de importarlos
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary" className="gap-1">
                  Total: {totalCount}
                </Badge>
                <Badge className="gap-1 bg-success/10 text-success hover:bg-success/20">
                  <Check className="h-3 w-3" />
                  Válidos: {validCount}
                </Badge>
                <Badge className="gap-1 bg-warning/10 text-warning hover:bg-warning/20">
                  <AlertCircle className="h-3 w-3" />
                  Pendientes de completar: {warningCount}
                </Badge>
                <Badge className="gap-1 bg-error/10 text-error hover:bg-error/20">
                  <X className="h-3 w-3" />
                  Errores: {errorCount}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4" />
                <p>No pudimos reconocer movimientos en el texto.</p>
                <p className="text-sm">Revisa el formato y vuelve a intentar.</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Fecha</TableHead>
                      <TableHead className="min-w-[200px]">Descripción</TableHead>
                      <TableHead className="w-[120px] text-right">Importe</TableHead>
                      <TableHead className="w-[160px]">Cuenta</TableHead>
                      <TableHead className="w-[160px]">Sobre</TableHead>
                      <TableHead className="w-[100px]">Tipo</TableHead>
                      <TableHead className="w-[120px]">Estado</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction, index) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-medium">
                          {formatIsoDateOnly(transaction.date)}
                        </TableCell>
                        <TableCell
                          className="max-w-[300px] whitespace-normal break-words"
                          title={transaction.description}
                        >
                          <div className="space-y-1">
                            <div>{transaction.description}</div>
                            {transaction.appliedRuleName && (
                              <div className="text-xs text-muted-foreground">
                                Regla automática: {transaction.appliedRuleName}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono ${
                            transaction.amount < 0 ? "text-error" : "text-success"
                          }`}
                        >
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={transaction.accountId}
                            onValueChange={(v) => updateTransaction(transaction.id, "accountId", v)}
                            disabled={accountsLoading}
                          >
                            <SelectTrigger
                              className="h-8"
                              aria-label={`Cuenta del movimiento ${index + 1}`}
                              aria-describedby={
                                transaction.statusMessage
                                  ? `import-row-${transaction.id}-reason`
                                  : undefined
                              }
                            >
                              <SelectValue placeholder="Elige una opción…" />
                            </SelectTrigger>
                            <SelectContent>
                              {getAccountsForTransaction(transaction, activeAccounts).map(
                                (account) => (
                                  <SelectItem key={account.id} value={account.id.toString()}>
                                    {account.name} ({account.currency})
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={transaction.envelopeId}
                            onValueChange={(v) =>
                              updateTransaction(transaction.id, "envelopeId", v)
                            }
                            disabled={
                              !transaction.accountId || envelopesLoading[transaction.accountId]
                            }
                          >
                            <SelectTrigger
                              className="h-8"
                              aria-label={`Sobre del movimiento ${index + 1}`}
                              aria-describedby={
                                transaction.statusMessage
                                  ? `import-row-${transaction.id}-reason`
                                  : undefined
                              }
                            >
                              <SelectValue placeholder="Elige una opción…" />
                            </SelectTrigger>
                            <SelectContent>
                              {(envelopesByAccount[transaction.accountId] || []).map((envelope) => (
                                <SelectItem key={envelope.id} value={envelope.id.toString()}>
                                  {envelope.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={transaction.type}
                            onValueChange={(v) =>
                              updateTransaction(transaction.id, "type", v as TransactionType)
                            }
                          >
                            <SelectTrigger
                              className="h-8"
                              aria-label={`Tipo del movimiento ${index + 1}`}
                              aria-describedby={
                                transaction.statusMessage
                                  ? `import-row-${transaction.id}-reason`
                                  : undefined
                              }
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EXPENSE">Gasto</SelectItem>
                              <SelectItem value="INCOME">Ingreso</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {transaction.status === "valid" && (
                            <Badge className="bg-success/10 text-success hover:bg-success/20">
                              <Check className="mr-1 h-3 w-3" />
                              Válido
                            </Badge>
                          )}
                          {transaction.status === "warning" && (
                            <Badge className="bg-warning/10 text-warning hover:bg-warning/20">
                              <AlertCircle className="mr-1 h-3 w-3" />
                              Pendiente
                            </Badge>
                          )}
                          {transaction.status === "error" && (
                            <Badge
                              className="bg-error/10 text-error hover:bg-error/20"
                              title={transaction.statusMessage}
                            >
                              <X className="mr-1 h-3 w-3" />
                              Error
                            </Badge>
                          )}
                          {transaction.statusMessage && (
                            <p
                              id={`import-row-${transaction.id}-reason`}
                              className="mt-2 min-w-48 whitespace-normal text-sm leading-relaxed"
                            >
                              {transaction.statusMessage}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => removeTransaction(transaction.id)}
                            aria-label={`Quitar movimiento ${index + 1}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}

            {/* Footer Actions */}
            {transactions.length > 0 && (
              <div className="flex items-center justify-between border-t pt-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  Se importarán los movimientos sin errores que tengan cuenta, sobre, fecha e
                  importe válidos ({importableCount} listos)
                </p>
                <Button onClick={handleImport} disabled={importableCount === 0 || isImporting}>
                  {isImporting ? "Importando…" : `Importar movimientos (${importableCount})`}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
