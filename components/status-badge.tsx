import { Badge } from "@/components/ui/badge"

import type React from "react"

interface StatusBadgeProps {
  status: "active" | "inactive" | "pending" | "balanced" | "difference"
  children?: React.ReactNode
}

/**
 * Reusable component for status display with appropriate colors
 */
export function StatusBadge({ status, children }: StatusBadgeProps) {
  const variantMap: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    active: "default",
    inactive: "secondary",
    pending: "outline",
    balanced: "default",
    difference: "secondary",
  }

  const displayText: Record<string, string> = {
    active: "Activo",
    inactive: "Inactivo",
    pending: "Pendiente",
    balanced: "Sin diferencia",
    difference: "Diferencia",
  }

  return <Badge variant={variantMap[status]}>{children || displayText[status]}</Badge>
}
