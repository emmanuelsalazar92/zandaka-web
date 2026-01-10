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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"

// Mock data
const mockReconciliations = [
  {
    id: 1,
    account: "Main Checking",
    date: "2026-01-02",
    calculatedBalance: 1250000,
    realBalance: 1255000,
    difference: 5000,
  },
  {
    id: 2,
    account: "Credit Card",
    date: "2026-01-02",
    calculatedBalance: 2340,
    realBalance: 2340,
    difference: 0,
  },
]

const mockAccounts = [
  { id: 1, name: "Main Checking", balance: 1250000 },
  { id: 2, name: "Credit Card", balance: 2340 },
  { id: 3, name: "Savings", balance: 500000 },
]

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: currency === "CRC" ? 0 : 2,
  }).format(amount)
}

export function ReconciliationContent() {
  const [reconciliations, setReconciliations] = React.useState(mockReconciliations)
  const [isReconcileOpen, setIsReconcileOpen] = React.useState(false)
  const [formData, setFormData] = React.useState({
    account: "",
    date: new Date().toISOString().split("T")[0],
    realBalance: "",
  })

  const handleReconcile = () => {
    if (!formData.account || !formData.realBalance) return

    const account = mockAccounts.find((a) => a.id === Number.parseInt(formData.account))
    if (!account) return

    const calculatedBalance = account.balance
    const realBalance = Number.parseFloat(formData.realBalance)
    const difference = realBalance - calculatedBalance

    const existingIndex = reconciliations.findIndex((r) => r.account === account.name && r.date === formData.date)

    if (existingIndex >= 0) {
      const updated = [...reconciliations]
      updated[existingIndex] = {
        ...updated[existingIndex],
        realBalance,
        difference,
      }
      setReconciliations(updated)
    } else {
      setReconciliations([
        ...reconciliations,
        {
          id: Math.max(...reconciliations.map((r) => r.id)) + 1,
          account: account.name,
          date: formData.date,
          calculatedBalance,
          realBalance,
          difference,
        },
      ])
    }

    setIsReconcileOpen(false)
    setFormData({
      account: "",
      date: new Date().toISOString().split("T")[0],
      realBalance: "",
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reconciliation</h2>
          <p className="text-muted-foreground">Compare calculated vs actual account balances</p>
        </div>
        <Dialog open={isReconcileOpen} onOpenChange={setIsReconcileOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Reconciliation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reconcile Account</DialogTitle>
              <DialogDescription>Compare calculated vs actual balance</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="account">Account</Label>
                <Select
                  value={formData.account}
                  onValueChange={(value) => setFormData({ ...formData, account: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id.toString()}>
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              {formData.account && (
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-sm text-muted-foreground">Calculated Balance:</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(
                      mockAccounts.find((a) => a.id === Number.parseInt(formData.account))?.balance || 0,
                      "CRC",
                    )}
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="realBalance">Real Balance (from bank)</Label>
                <Input
                  id="realBalance"
                  type="number"
                  placeholder="Enter actual balance"
                  value={formData.realBalance}
                  onChange={(e) => setFormData({ ...formData, realBalance: e.target.value })}
                />
              </div>
              {formData.realBalance && formData.account && (
                <div
                  className={cn(
                    "rounded-lg p-3",
                    Number.parseFloat(formData.realBalance) -
                      (mockAccounts.find((a) => a.id === Number.parseInt(formData.account))?.balance || 0) ===
                      0
                      ? "bg-success/10"
                      : "bg-warning/10",
                  )}
                >
                  <p className="text-sm text-muted-foreground">Difference:</p>
                  <p
                    className={cn(
                      "text-lg font-semibold",
                      Number.parseFloat(formData.realBalance) -
                        (mockAccounts.find((a) => a.id === Number.parseInt(formData.account))?.balance || 0) ===
                        0
                        ? "text-success"
                        : "text-warning",
                    )}
                  >
                    {formatCurrency(
                      Number.parseFloat(formData.realBalance) -
                        (mockAccounts.find((a) => a.id === Number.parseInt(formData.account))?.balance || 0),
                      "CRC",
                    )}
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsReconcileOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleReconcile} disabled={!formData.account || !formData.realBalance}>
                Reconcile
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reconciliation History</CardTitle>
          <CardDescription>{reconciliations.length} reconciliation(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Calculated</TableHead>
                <TableHead>Real Balance</TableHead>
                <TableHead>Difference</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reconciliations.map((recon) => (
                <TableRow key={recon.id}>
                  <TableCell className="font-medium">{recon.account}</TableCell>
                  <TableCell>{recon.date}</TableCell>
                  <TableCell>{formatCurrency(recon.calculatedBalance, "CRC")}</TableCell>
                  <TableCell>{formatCurrency(recon.realBalance, "CRC")}</TableCell>
                  <TableCell>
                    <span className={cn("font-semibold", recon.difference === 0 ? "text-success" : "text-warning")}>
                      {recon.difference > 0 ? "+" : ""}
                      {formatCurrency(recon.difference, "CRC")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={recon.difference === 0 ? "default" : "secondary"}>
                      {recon.difference === 0 ? "Balanced" : "Difference"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
