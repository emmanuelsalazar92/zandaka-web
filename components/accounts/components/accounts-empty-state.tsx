import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type AccountsEmptyStateProps = {
  onCreateClick: () => void
}

export function AccountsEmptyState({ onCreateClick }: AccountsEmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-4">Todavía no hay cuentas</p>
        <Button onClick={onCreateClick}>
          <Plus className="mr-2 h-4 w-4" />
          Añadir mi primera cuenta
        </Button>
      </CardContent>
    </Card>
  )
}
