import { Edit2, XCircle } from "lucide-react"
import Link from "next/link"

import styles from "@/components/accounts/account-context.module.css"
import type { AccountUi } from "@/components/accounts/types/accounts.types"
import { Button } from "@/components/ui/button"
import { Feedback, LoadingState } from "@/components/ui/feedback"
import { canDeactivateContextAccount, contextActivityLink } from "@/lib/account-context"
import { formatCurrency } from "@/lib/currency-formatter"

export function AccountsTable({
  accounts,
  loading,
  error,
  onEdit,
  onDeactivate,
}: {
  accounts: AccountUi[]
  loading: boolean
  error: string | null
  onEdit: (account: AccountUi) => void
  onDeactivate: (id: number) => void
}) {
  const groups = new Map<string, { name: string; rows: AccountUi[] }>()
  for (const account of accounts) {
    const key = account.institutionId ? String(account.institutionId) : account.institution
    const group = groups.get(key) ?? { name: account.institution, rows: [] }
    group.rows.push(account)
    groups.set(key, group)
  }
  if (loading) return <LoadingState>Cargando cuentas…</LoadingState>
  if (error)
    return (
      <Feedback tone="error" title="Cuentas por confirmar">
        {error}
      </Feedback>
    )
  return (
    <div className={styles.groups}>
      {[...groups.entries()].map(([key, group]) => (
        <section key={key} aria-label={`Cuentas de ${group.name}`}>
          <div className={styles.heading}>
            <h2 className={styles.title}>{group.name}</h2>
            <p className={styles.caption}>
              {group.rows.length} {group.rows.length === 1 ? "cuenta" : "cuentas"}
            </p>
          </div>
          <ul className={styles.list}>
            {group.rows.map((account) => (
              <li key={account.id} className={styles.row} data-testid="account-row">
                <div>
                  <h3 className={styles.rowName}>{account.name}</h3>
                  <p className={styles.caption}>
                    {account.currency} · Activa ·{" "}
                    {account.type === "CASH"
                      ? "Efectivo"
                      : account.type === "VIRTUAL"
                        ? "Cuenta virtual"
                        : account.type === "BANK"
                          ? "Cuenta bancaria"
                          : "Tipo por confirmar"}
                  </p>
                  <p className={styles.caption}>
                    {account.activeEnvelopesCount === null
                      ? "Cantidad de sobres por confirmar"
                      : `${account.activeEnvelopesCount} sobres activos`}
                  </p>
                </div>
                <div>
                  <p
                    className={`${styles.rowAmount} ${account.balance !== null && account.balance < 0 ? "text-error" : ""}`}
                  >
                    {account.balance === null
                      ? "Por confirmar"
                      : formatCurrency(account.balance, account.currency)}
                  </p>
                  <p className={styles.caption}>Saldo registrado de la cuenta</p>
                </div>
                <div>
                  <div className={styles.actions}>
                    <Button asChild variant="outline">
                      <Link
                        href={`/envelopes?accountId=${account.id}`}
                        aria-label={`Ver sobres de ${account.name}`}
                      >
                        Ver sobres
                      </Link>
                    </Button>
                    <Button asChild variant="ghost">
                      <Link
                        href={contextActivityLink(account.id)}
                        aria-label={`Movimientos de la cuenta ${account.name}`}
                      >
                        Movimientos
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label={`Editar cuenta ${account.name}`}
                      data-testid={`Edit-${account.id}`}
                      onClick={() => onEdit(account)}
                    >
                      <Edit2 aria-hidden="true" className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label={`Desactivar cuenta ${account.name}`}
                      data-testid={`Deactivate-${account.id}`}
                      disabled={!canDeactivateContextAccount(account)}
                      onClick={() => onDeactivate(account.id)}
                    >
                      <XCircle aria-hidden="true" className="size-4" />
                    </Button>
                  </div>
                  {!canDeactivateContextAccount(account) && (
                    <p className={styles.caption}>
                      {account.hasActiveEnvelopes === null || account.activeEnvelopesCount === null
                        ? "Confirma los sobres activos antes de desactivar."
                        : "Desactiva primero los sobres activos de esta cuenta."}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
