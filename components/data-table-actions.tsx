"use client"

import { Edit2, Trash2, MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface DataTableActionsProps {
  onEdit?: () => void
  onDelete?: () => void
  onCustomAction?: (action: string) => void
  customActions?: Array<{ label: string; action: string }>
  compact?: boolean
}

/**
 * Reusable data table actions component for consistent action buttons
 */
export function DataTableActions({
  onEdit,
  onDelete,
  onCustomAction,
  customActions,
  compact = false,
}: DataTableActionsProps) {
  if (compact && (customActions?.length || onEdit || onDelete)) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onEdit && (
            <DropdownMenuItem onClick={onEdit}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
          )}
          {customActions?.map((action) => (
            <DropdownMenuItem key={action.action} onClick={() => onCustomAction?.(action.action)}>
              {action.label}
            </DropdownMenuItem>
          ))}
          {onDelete && (
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="flex justify-end gap-2">
      {onEdit && (
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Edit2 className="h-4 w-4" />
        </Button>
      )}
      {onDelete && (
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
