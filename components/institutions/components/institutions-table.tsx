import { Edit2, XCircle } from "lucide-react"
import * as React from "react"

import { institutionTypeConfig } from "@/components/institutions/constants/institutionTypeConfig"
import type { InstitutionUi } from "@/components/institutions/types/institutions.types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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
        <CardTitle>Todas las instituciones</CardTitle>
        <CardDescription>Consulta y administra tus instituciones financieras</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-6 text-center text-muted-foreground">Cargando instituciones…</div>
        ) : null}
        {error ? <div className="py-6 text-center text-error">{error}</div> : null}
        {!loading && !error ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {institutions.map((institution) => {
                const disableDeactivate =
                  institution.status === "Active" && institution.activeAccountsCount > 0
                const deactivateTitle = disableDeactivate
                  ? "Desactiva las cuentas activas antes de desactivar esta institución"
                  : undefined

                return (
                  <TableRow key={institution.id}>
                    <TableCell className="font-medium">{institution.name}</TableCell>
                    <TableCell>
                      <Badge variant={institutionTypeConfig[institution.type].variant}>
                        {institutionTypeConfig[institution.type].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={institution.status === "Active" ? "default" : "secondary"}>
                        {institution.status === "Active" ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={"Edit-" + institution.id}
                          aria-label={"Editar institución " + institution.name}
                          onClick={() => onEdit(institution)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={"Deactivate-" + institution.id}
                          aria-label={
                            (institution.status === "Active" ? "Desactivar" : "Activar") +
                            " institución " +
                            institution.name
                          }
                          disabled={disableDeactivate}
                          title={deactivateTitle}
                          onClick={() => onDeactivate(institution.id)}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  )
}
