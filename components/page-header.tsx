import { ArrowUpRight } from "lucide-react"
import Link from "next/link"

import type { ReactNode } from "react"

type RelatedLink = { href: string; label: string }

/** One task title; actions wrap within the usable width, including enlarged system fonts. */
export function PageHeader({
  title,
  description,
  eyebrow,
  meta,
  related = [],
  children,
  actionsLabel = "Acciones de la página",
  ...props
}: {
  title: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  meta?: ReactNode
  related?: readonly RelatedLink[]
  children?: ReactNode
  actionsLabel?: string
  "data-testid"?: string
}) {
  return (
    <header
      data-slot="page-header"
      className="flex min-w-0 flex-col gap-5 [overflow-wrap:anywhere] lg:flex-row lg:flex-wrap lg:items-end lg:justify-between"
      {...props}
    >
      <div className="min-w-0 flex-1 lg:basis-72">
        {eyebrow && (
          <p className="mb-2 text-xs font-medium tracking-widest text-muted-foreground uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl leading-tight font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl leading-relaxed text-muted-foreground">{description}</p>
        )}
        {meta && (
          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {meta}
          </div>
        )}
        {related.length > 0 && (
          <nav
            aria-label="Gestión relacionada"
            className="mt-2 flex min-w-0 flex-wrap gap-x-4 gap-y-1"
          >
            {related.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="inline-flex min-h-control max-w-full min-w-0 items-center gap-1.5 rounded-md py-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="min-w-0">{label}</span>
                <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
              </Link>
            ))}
          </nav>
        )}
      </div>
      {children && (
        <div
          data-slot="page-actions"
          role="group"
          aria-label={actionsLabel}
          className="flex min-w-0 max-w-full flex-wrap items-end gap-2 lg:justify-end"
        >
          {children}
        </div>
      )}
    </header>
  )
}
