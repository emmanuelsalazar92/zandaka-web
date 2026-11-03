import { CircleCheck, CircleAlert, Info, LoaderCircle, Inbox } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

const tones = {
  info: { icon: Info, className: "bg-secondary text-secondary-foreground" },
  success: { icon: CircleCheck, className: "bg-success/10 text-success" },
  warning: { icon: CircleAlert, className: "bg-warning/10 text-warning" },
  error: { icon: CircleAlert, className: "bg-error/10 text-error" },
}

export function Feedback({
  tone = "info",
  title,
  children,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  tone?: keyof typeof tones
  title: React.ReactNode
}) {
  const { icon: Icon, className: color } = tones[tone]
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      data-slot="feedback"
      className={cn("flex items-start gap-3 rounded-lg p-4 text-sm", color, className)}
      {...props}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 space-y-1">
        <p className="font-semibold">{title}</p>
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
    </div>
  )
}

export function LoadingState({
  children = "Cargando información…",
}: {
  children?: React.ReactNode
}) {
  return (
    <div role="status" className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
      <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
      {children}
    </div>
  )
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div data-slot="empty-state" className="flex flex-col items-center gap-3 px-4 py-8 text-center">
      <Inbox aria-hidden="true" className="size-8 text-muted-foreground" />
      <p className="font-semibold">{title}</p>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{children}</p>
      {action}
    </div>
  )
}
