import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Plus } from "lucide-react"

type InstitutionsEmptyStateProps = {
  onCreateClick: () => void
}

export function InstitutionsEmptyState({ onCreateClick }: InstitutionsEmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-4">No institutions yet</p>
        <Button onClick={onCreateClick}>
          <Plus className="mr-2 h-4 w-4" />
          Add Your First Institution
        </Button>
      </CardContent>
    </Card>
  )
}
