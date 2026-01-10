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
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Edit2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

// Mock data
const mockAccounts = [
  {
    id: 1,
    name: "Main Checking",
    institution: "Banco Nacional",
    currency: "CRC",
    balance: 1250000,
    active: true,
    allowOverdraft: false,
  },
  {
    id: 2,
    name: "Credit Card",
    institution: "Banco Nacional",
    currency: "USD",
    balance: 2340,
    active: true,
    allowOverdraft: true,
  },
  {
    id: 3,
    name: "Savings",
    institution: "Banco Nacional",
    currency: "CRC",
    balance: 500000,
    active: true,
    allowOverdraft: false,
  },
  {
    id: 4,
    name: "Cash Wallet",
    institution: "Cash Wallet",
    currency: "CRC",
    balance: 50000,
    active: true,
    allowOverdraft: false,
  },
]

const mockInstitutions = ["Banco Nacional", "Cash Wallet", "Virtual Account"]

type InstitutionType = "BANK" | "CASH" | "VIRTUAL"

type InstitutionUi = {
  id: number
  name: string
  type: InstitutionType
  status: "Active" | "Inactive"
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: currency === "CRC" ? 0 : 2,
  }).format(amount)
}

export function AccountsContent() {
  const [institutions, setInstitutions] = React.useState<InstitutionUi[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [accounts, setAccounts] = React.useState(mockAccounts)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [deactivateId, setDeactivateId] = React.useState<number | null>(null)
  const [editAccount, setEditAccount] = React.useState<any>(null)
  const [formData, setFormData] = React.useState({
    name: "",
    institution: "",
    currency: "CRC",
    allowOverdraft: false,
  })

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

  const handleCreate = () => {
    const newAccount = {
      id: Math.max(...accounts.map((a) => a.id)) + 1,
      name: formData.name,
      institution: formData.institution,
      currency: formData.currency,
      balance: 0,
      active: true,
      allowOverdraft: formData.allowOverdraft,
    }
    setAccounts([...accounts, newAccount])
    setIsCreateOpen(false)
    setFormData({ name: "", institution: "", currency: "CRC", allowOverdraft: false })
  }

  const handleEdit = () => {
    setAccounts(
      accounts.map((acc) =>
        acc.id === editAccount.id
          ? {
              ...acc,
              name: formData.name,
              institution: formData.institution,
              allowOverdraft: formData.allowOverdraft,
            }
          : acc,
      ),
    )
    setIsEditOpen(false)
    setEditAccount(null)
    setFormData({ name: "", institution: "", currency: "CRC", allowOverdraft: false })
  }

  const handleDeactivate = () => {
    if (deactivateId) {
      setAccounts(accounts.map((acc) => (acc.id === deactivateId ? { ...acc, active: !acc.active } : acc)))
      setDeactivateId(null)
    }
  }

  const openEdit = (account: any) => {
    setEditAccount(account)
    setFormData({
      name: account.name,
      institution: account.institution,
      currency: account.currency,
      allowOverdraft: account.allowOverdraft,
    })
    setIsEditOpen(true)
  }

  // Group accounts by institution
  const groupedAccounts = accounts.reduce(
    (acc, account) => {
      if (!acc[account.institution]) {
        acc[account.institution] = []
      }
      acc[account.institution].push(account)
      return acc
    },
    {} as Record<string, typeof accounts>,
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Accounts</h2>
          <p className="text-muted-foreground">Manage your accounts across institutions</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Account</DialogTitle>
              <DialogDescription>Add a new account to track your finances</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="institution">Institution</Label>

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
                <Select
                  value={formData.institution}
                  onValueChange={(value) => setFormData({ ...formData, institution: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select institution" />
                  </SelectTrigger>
                  <SelectContent>
                    {institutions.map((inst) => (
                      <SelectItem key={inst.id} value={inst.name}>
                        {inst.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>)}
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Account Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Main Checking"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency (immutable)</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData({ ...formData, currency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CRC">CRC (Costa Rican Colón)</SelectItem>
                    <SelectItem value="USD">USD (US Dollar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!formData.name || !formData.institution}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No accounts yet</p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedAccounts).map(([institution, instAccounts]) => (
            <Card key={institution}>
              <CardHeader>
                <CardTitle>{institution}</CardTitle>
                <CardDescription>
                  {instAccounts.length} account{instAccounts.length !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account Name</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instAccounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-medium">{account.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{account.currency}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className={cn("font-semibold", account.balance >= 0 ? "text-success" : "text-error")}>
                            {formatCurrency(account.balance, account.currency)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={account.active ? "default" : "secondary"}>
                            {account.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(account)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDeactivateId(account.id)}>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>Update account details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-institution">Institution</Label>
              <Input value={formData.institution} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Account Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input value={formData.currency} disabled />
            </div>
 
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation */}
      <AlertDialog open={deactivateId !== null} onOpenChange={() => setDeactivateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {accounts.find((a) => a.id === deactivateId)?.active ? "Deactivate" : "Activate"} Account?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will {accounts.find((a) => a.id === deactivateId)?.active ? "deactivate" : "activate"} the account.
              You can reverse this action at any time.
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
