import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Edit2, XCircle } from "lucide-react"
import { institutionTypeConfig } from "@/components/institutions/constants/institutionTypeConfig"
import type { InstitutionUi } from "@/components/institutions/types/institutions.types"

type InstitutionsTableProps = {
  institutions: InstitutionUi[]
  loading: boolean
  error: string | null
  onEdit: (institution: InstitutionUi) => void
  onDeactivate: (institutionId: number) => void
}

export function InstitutionsTable({
  institutions,
  loading,
  error,
  onEdit,
  onDeactivate,
}: InstitutionsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>All Institutions</CardTitle>
        <CardDescription>View and manage your financial institutions</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-6 text-center text-muted-foreground">Loading institutions...</div>
        ) : null}
        {error ? <div className="py-6 text-center text-red-500">{error}</div> : null}
        {!loading && !error ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {institutions.map((institution) => (
                <TableRow key={institution.id}>
                  <TableCell className="font-medium">{institution.name}</TableCell>
                  <TableCell>
                    <Badge variant={institutionTypeConfig[institution.type].variant}>
                      {institutionTypeConfig[institution.type].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={institution.status === "Active" ? "default" : "secondary"}>
                      {institution.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(institution)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDeactivate(institution.id)}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  )
}
