"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Edit2, XCircle } from "lucide-react"

type InstitutionType = "BANK" | "CASH" | "VIRTUAL"

type InstitutionUi = {
  id: number
  name: string
  type: InstitutionType
  status: "Active" | "Inactive"
}

export function InstitutionsContent() {
  const [institutions, setInstitutions] = React.useState<InstitutionUi[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [deactivateId, setDeactivateId] = React.useState<number | null>(null)
  const [editInstitution, setEditInstitution] = React.useState<any>(null)
  const [formData, setFormData] = React.useState({ name: "", type: "BANK" })

  const institutionTypeConfig: Record<InstitutionType, { label: string; variant: "default" | "secondary" | "outline" }> = {
    BANK: { label: "Bank", variant: "default" },
    CASH: { label: "Cash", variant: "secondary" },
    VIRTUAL: { label: "Virtual", variant: "outline" },
  }
  
  const fetchInstitutions = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
  
      const res = await fetch("http://localhost:3000/api/institutions", {
        headers: { Accept: "application/json" },
      })
  
      if (!res.ok) throw new Error("Failed to load institutions")
  
      const data = await res.json()
  
      const mapped = data.map((x: any) => ({
        id: x.id,
        name: x.name,
        type: x.type,
        status: x.is_active === 1 ? "Active" : "Inactive",
      }))
  
      setInstitutions(mapped)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchInstitutions()
  }, [fetchInstitutions])
  
  const handleCreate = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/institutions', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 1, // Puedes ajustar el userId segan tu l3gica
          name: formData.name,
          type: formData.type
        }),
      });

      if (!response.ok) {
        throw new Error('Error creating institution');
      }

      setIsCreateOpen(false);
      setFormData({ name: "", type: "BANK" });
      await fetchInstitutions();
    } catch (error) {
      alert('Error creating institution');
      // Manejo de error m3 avanzado puedes agregar un estado para mostrarlo en UI
    }
  }

  const handleEdit = async () => {
    if (!editInstitution) return
  
    try {
      const response = await fetch(`http://localhost:3000/api/institutions/${editInstitution.id}`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          type: formData.type,
        }),
      })
  
      if (!response.ok) {
        throw new Error("Error updating institution")
      }
  
      // (opcional) si querés usar lo que devuelve el API:
      // const updated = await response.json()
  
      setIsEditOpen(false)
      setEditInstitution(null)
      setFormData({ name: "", type: "BANK" })
  
      await fetchInstitutions() // 🔥 fuente de verdad
    } catch (error) {
      alert("Error updating institution")
    }
  }
  

  const handleDeactivate = async () => {
    if (!deactivateId) return
  
    try {
      const response = await fetch(
        `http://localhost:3000/api/institutions/${deactivateId}/deactivate`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
          },
        }
      )
  
      if (!response.ok) {
        throw new Error("Failed to deactivate institution")
      }
  
      // 🔥 refrescamos desde backend (fuente de verdad)
      await fetchInstitutions()
    } catch (error) {
      alert("Error deactivating institution")
    } finally {
      setDeactivateId(null)
    }
  }
  

  const openEdit = (institution: any) => {
    setEditInstitution(institution)
    setFormData({ name: institution.name, type: institution.type })
    setIsEditOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Institutions</h2>
          <p className="text-muted-foreground">Manage your financial institutions</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Institution
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Institution</DialogTitle>
              <DialogDescription>Add a new financial institution to your budget</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Institution Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Banco Nacional"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANK">Bank</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="VIRTUAL">Virtual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!formData.name}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {institutions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No institutions yet</p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Institution
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Institutions</CardTitle>
            <CardDescription>View and manage your financial institutions</CardDescription>
          </CardHeader>
          <CardContent>
          {loading && (
    <div className="py-6 text-center text-muted-foreground">
      Loading institutions...
    </div>
  )}

  {error && (
    <div className="py-6 text-center text-red-500">
      {error}
    </div>
  )}

  {!loading && !error && (

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
                        <Button variant="ghost" size="sm" onClick={() => openEdit(institution)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeactivateId(institution.id)}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table> )}
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Institution</DialogTitle>
            <DialogDescription>Update institution details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Institution Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type">Type</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK">Bank</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="VIRTUAL">Virtual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={!formData.name || loading}>
  Save Changes
</Button>

          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation */}
      <AlertDialog open={deactivateId !== null} onOpenChange={() => setDeactivateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {institutions.find((i) => i.id === deactivateId)?.status === "Active" ? "Deactivate" : "Activate"}{" "}
              Institution?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will{" "}
              {institutions.find((i) => i.id === deactivateId)?.status === "Active" ? "deactivate" : "activate"} the
              institution. You can reverse this action at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
