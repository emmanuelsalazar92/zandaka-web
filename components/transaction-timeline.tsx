"use client"

import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react"

import styles from "@/components/transactions/history.module.css"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { detailAmount } from "@/lib/transaction-detail"
import {
  getTimelineAmounts,
  getTransactionTypeMeta,
  type TimelineTransaction,
  type TransactionTimelineGroup,
} from "@/lib/transaction-timeline"

type OpenDetail = (transactionId: number, trigger: HTMLButtonElement) => void

function TransactionItem({
  transaction,
  onOpen,
}: {
  transaction: TimelineTransaction
  onOpen: OpenDetail
}) {
  const meta = getTransactionTypeMeta(transaction.type)
  const Icon =
    transaction.type === "TRANSFER"
      ? ArrowRightLeft
      : transaction.type === "INCOME"
        ? ArrowDownLeft
        : transaction.type === "EXPENSE"
          ? ArrowUpRight
          : SlidersHorizontal
  const amounts = getTimelineAmounts(transaction)
  const first = transaction.lines[0]
  const accounts = new Set(transaction.lines.map((line) => line.accountId)).size
  return (
    <li className={styles.item}>
      <article className={styles.row} data-testid="history-row">
        <button
          type="button"
          aria-label={`Ver detalle del movimiento ${transaction.id}`}
          aria-describedby={`history-${transaction.id}-description history-${transaction.id}-destination history-${transaction.id}-type history-${transaction.id}-amounts`}
          aria-haspopup="dialog"
          className={styles.open}
          onClick={(event) => onOpen(transaction.id, event.currentTarget)}
        />
        <div className={styles.icon}>
          <Icon aria-hidden="true" className="size-4" />
        </div>
        <div className={styles.context}>
          <p id={`history-${transaction.id}-description`} className={styles.description}>
            {transaction.description || "Movimiento sin descripción"}
          </p>
          <p id={`history-${transaction.id}-destination`} className={styles.destination}>
            {first ? `${first.account} · ${first.envelope}` : "Cuenta y sobre por identificar"}
          </p>
          <p className={styles.caption}>
            {transaction.lines.length}{" "}
            {transaction.lines.length === 1 ? "línea visible" : "líneas visibles"}
            {accounts > 1 ? ` · ${accounts} cuentas` : ""} · <span>Ver detalle completo</span>
          </p>
        </div>
        <Badge id={`history-${transaction.id}-type`} variant="secondary" className={styles.type}>
          {meta.label}
        </Badge>
        <div id={`history-${transaction.id}-amounts`} className={styles.amounts}>
          {amounts ? (
            amounts.map((amount) => (
              <p
                key={`${amount.currency}:${amount.direction}`}
                className="min-w-0 [overflow-wrap:anywhere]"
              >
                {transaction.type === "TRANSFER" && (
                  <span className={styles.amountCaption}>
                    {amount.direction === "out"
                      ? "Salida"
                      : amount.direction === "in"
                        ? "Entrada"
                        : "Sin efecto"}{" "}
                  </span>
                )}
                <span
                  className={
                    amount.direction === "net" && transaction.type === "INCOME"
                      ? "text-success"
                      : undefined
                  }
                >
                  {detailAmount(amount.amount, amount.currency)}
                </span>
              </p>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Importe por confirmar · Ver ficha</p>
          )}
          {amounts && new Set(amounts.map((amount) => amount.currency)).size > 1 && (
            <p className={styles.amountCaption}>Sin conversión</p>
          )}
        </div>
        <ChevronRight aria-hidden="true" className={styles.chevron} />
      </article>
    </li>
  )
}

export function TransactionTimeline({
  groups,
  onOpen,
  density = "compact",
  appearance = "adaptive",
}: {
  groups: TransactionTimelineGroup[]
  onOpen: OpenDetail
  density?: "compact" | "comfortable"
  appearance?: "adaptive" | "open"
}) {
  return (
    <div
      className={styles.timeline}
      data-density={density}
      data-appearance={appearance}
      data-testid="history-timeline"
    >
      {groups.map((group) => (
        <section key={group.key} className={styles.dateGroup} aria-label={group.fullDateLabel}>
          <div className={styles.dateHeading}>
            <h3>{group.label}</h3>
            <span>
              {group.transactionCount} {group.transactionCount === 1 ? "movimiento" : "movimientos"}
            </span>
          </div>
          {group.label !== group.fullDateLabel && (
            <p className="mb-3 text-xs text-muted-foreground">{group.fullDateLabel}</p>
          )}
          <ol className={styles.list}>
            {group.items.map((transaction) => (
              <TransactionItem key={transaction.id} transaction={transaction} onOpen={onOpen} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

export function TransactionTimelineSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-4">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="space-y-2 border-b py-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  )
}
