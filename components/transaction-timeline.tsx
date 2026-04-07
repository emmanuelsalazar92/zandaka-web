"use client"

import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, SlidersHorizontal } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatSignedCurrency } from "@/lib/currency-formatter"
import {
  getTransactionDisplayAmount,
  getTransactionDisplayCurrency,
  getTransactionTypeMeta,
  type TimelineTransaction,
  type TransactionTimelineGroup,
  type TransactionVisualTone,
} from "@/lib/transaction-timeline"
import { cn } from "@/lib/utils"

function toneClasses(tone: TransactionVisualTone) {
  if (tone === "income") {
    return {
      accent: "bg-success/80",
      badge: "border-success/35 bg-success/10 text-success",
      iconRing: "border-success/20 bg-success/10",
      icon: "text-success",
      amount: "text-success",
    }
  }

  if (tone === "expense") {
    return {
      accent: "bg-error/80",
      badge: "border-error/35 bg-error/10 text-error",
      iconRing: "border-error/20 bg-error/10",
      icon: "text-error",
      amount: "text-error",
    }
  }

  if (tone === "transfer") {
    return {
      accent: "bg-primary/80",
      badge: "border-primary/30 bg-primary/10 text-primary",
      iconRing: "border-primary/20 bg-primary/10",
      icon: "text-primary",
      amount: "text-primary",
    }
  }

  return {
    accent: "bg-warning/75",
    badge: "border-warning/35 bg-warning/10 text-warning",
    iconRing: "border-warning/20 bg-warning/10",
    icon: "text-warning",
    amount: "text-foreground",
  }
}

function lineAmountClass(amount: number) {
  if (amount > 0) return "text-success"
  if (amount < 0) return "text-error"
  return "text-muted-foreground"
}

function buildSecondaryLabel(transaction: TimelineTransaction) {
  if (transaction.lines.length === 1) {
    const line = transaction.lines[0]
    return `${line.account} / ${line.envelope}`
  }

  const uniqueAccounts = new Set(transaction.lines.map((line) => line.account))
  return `${transaction.lines.length} ledger lines across ${uniqueAccounts.size} account${uniqueAccounts.size === 1 ? "" : "s"}`
}

function buildAmountText(transaction: TimelineTransaction) {
  const amount = getTransactionDisplayAmount(transaction)
  const currency = getTransactionDisplayCurrency(transaction)

  if (!currency) {
    return {
      value: "Mixed currencies",
      caption: "Review line-level amounts below",
    }
  }

  const meta = getTransactionTypeMeta(transaction.type)

  if (transaction.type === "TRANSFER") {
    return {
      value: formatCurrency(amount, currency),
      caption: meta.amountContextLabel,
    }
  }

  return {
    value: formatSignedCurrency(amount, currency),
    caption: meta.amountContextLabel,
  }
}

function TransactionTimelineItem({ transaction }: { transaction: TimelineTransaction }) {
  const meta = getTransactionTypeMeta(transaction.type)
  const tones = toneClasses(meta.tone)
  const amountText = buildAmountText(transaction)
  const hasUnresolvedLine = transaction.lines.some(
    (line) => line.account.startsWith("Unknown") || line.envelope.startsWith("Unknown"),
  )

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/70 bg-card/50 transition-all hover:border-primary/20 hover:bg-muted/15">
      <div className={cn("absolute inset-y-4 left-0 w-1 rounded-full", tones.accent)} />

      <div className="space-y-4 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
                  tones.iconRing,
                )}
              >
                {meta.tone === "income" ? (
                  <ArrowDownLeft className={cn("h-4 w-4", tones.icon)} />
                ) : meta.tone === "expense" ? (
                  <ArrowUpRight className={cn("h-4 w-4", tones.icon)} />
                ) : meta.tone === "transfer" ? (
                  <ArrowRightLeft className={cn("h-4 w-4", tones.icon)} />
                ) : (
                  <SlidersHorizontal className={cn("h-4 w-4", tones.icon)} />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold sm:text-base">
                    {transaction.description || "Untitled transaction"}
                  </p>
                  <Badge variant="outline" className={tones.badge}>
                    {meta.label}
                  </Badge>
                  {hasUnresolvedLine ? (
                    <Badge
                      variant="outline"
                      className="border-warning/35 bg-warning/10 text-warning"
                    >
                      Needs review
                    </Badge>
                  ) : null}
                </div>

                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {buildSecondaryLabel(transaction)}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {transaction.lines.length} line{transaction.lines.length === 1 ? "" : "s"}
                  </span>
                  {transaction.lines.length > 1 ? (
                    <span>Expanded below for account-by-account detail</span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="pl-12 text-left lg:pl-0 lg:text-right">
            <p className={cn("font-mono text-lg font-semibold sm:text-xl", tones.amount)}>
              {amountText.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{amountText.caption}</p>
          </div>
        </div>

        {transaction.lines.length > 1 ? (
          <div className="space-y-2 border-t border-border/60 pt-3">
            {transaction.lines.map((line, index) => (
              <div
                key={`${transaction.id}-${line.accountId}-${line.envelopeId}-${index}`}
                className="flex items-center justify-between gap-4 rounded-lg bg-muted/10 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{line.account}</p>
                  <p className="truncate text-xs text-muted-foreground">{line.envelope}</p>
                </div>
                <p
                  className={cn(
                    "shrink-0 font-mono text-sm font-semibold",
                    lineAmountClass(line.amount),
                  )}
                >
                  {formatSignedCurrency(line.amount, line.accountCurrency)}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function TransactionDateGroup({ group }: { group: TransactionTimelineGroup }) {
  const showFullDate = group.label !== group.fullDateLabel

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 border-b border-border/60 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-px w-8 bg-border/80" />
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {group.label}
            </h3>
          </div>
          {showFullDate ? (
            <p className="pl-11 text-xs text-muted-foreground">{group.fullDateLabel}</p>
          ) : null}
        </div>

        <Badge variant="secondary" className="w-fit">
          {group.transactionCount} transaction{group.transactionCount === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="space-y-3">
        {group.items.map((transaction) => (
          <TransactionTimelineItem key={transaction.id} transaction={transaction} />
        ))}
      </div>
    </section>
  )
}

export function TransactionTimeline({ groups }: { groups: TransactionTimelineGroup[] }) {
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <TransactionDateGroup key={group.key} group={group} />
      ))}
    </div>
  )
}

export function TransactionTimelineSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, groupIndex) => (
        <div key={groupIndex} className="space-y-3">
          <div className="flex items-end justify-between border-b border-border/60 pb-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>

          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, itemIndex) => (
              <div
                key={`${groupIndex}-${itemIndex}`}
                className="rounded-xl border border-border/70 bg-card/40 px-5 py-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex flex-1 items-start gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-52" />
                      <Skeleton className="h-3 w-64" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                  <div className="space-y-2 lg:text-right">
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
