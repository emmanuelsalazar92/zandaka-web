import { Skeleton } from "@/components/ui/skeleton"

interface LoadingSkeletonProps {
  rows?: number
  columns?: number
  label?: string
}

/**
 * Reusable loading skeleton for tables and lists
 */
export function LoadingSkeleton({
  rows = 5,
  columns = 4,
  label = "Cargando información…",
}: LoadingSkeletonProps) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" aria-busy="true" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-3">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={`${rowIndex}-${colIndex}`} className="flex-1 h-10" />
          ))}
        </div>
      ))}
    </div>
  )
}
