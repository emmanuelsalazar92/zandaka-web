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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, AlertTriangle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

// Mock data
const mockEnvelopes = [
  { id: 1, accountId: 1, account: "Main Checking", category: "Groceries", balance: 125000, active: true },
  { id: 2, accountId: 1, account: "Main Checking", category: "Utilities", balance: 80000, active: true },
  { id: 3, accountId: 1, account: "Main Checking", category: "Transportation", balance: -15000, active: true },
  { id: 4, accountId: 2, account: "Credit Card", category: "Entertainment", balance: -50, active: true },
  { id: 5, accountId: 3, account: "Savings", category: "Emergency Fund", balance: 500000, active: true },
]

const mockAccounts = [
  { id: 1, name: "Main Checking" },
  { id: 2, name: "Credit Card" },
  { id: 3, name: "Savings" },
  { id: 4, name: "Cash Wallet" },
]

const mockCategories = [
  "Groceries",
  "Utilities",
  "Transportation",
  "Entertainment",
  "Emergency Fund",
  "Salary",
  "Dining Out",
  "Investments",
]

function formatCurrency(amount: number) {
  const currency = amount >= -1000 ? "USD" : "CRC"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: currency === "CRC" ? 0 : 2,
  }).format(amount)
}

export function EnvelopesContent() {
  const [envelopes, setEnvelopes] = React.useState(mockEnvelopes)
  const [selectedAccount, setSelectedAccount] = React.useState<string>("1")
  const [isLinkOpen, setIsLinkOpen] = React.useState(false)
  const [unlinkId, setUnlinkId] = React.useState<number | null>(null)
  const [formData, setFormData] = React.useState({
    category: "",
  })

  const filteredEnvelopes = envelopes.filter((env) => env.accountId === Number.parseInt(selectedAccount))

  const handleLinkCategory = () => {
    const newEnvelope = {
      id: Math.max(...envelopes.map((e) => e.id)) + 1,
      accountId: Number.parseInt(selectedAccount),
      account: mockAccounts.find((a) => a.id === Number.parseInt(selectedAccount))?.name || "",
      category: formData.category,
      balance: 0,
      active: true,
    }
    setEnvelopes([...envelopes, newEnvelope])
    setIsLinkOpen(false)
    setFormData({ category: "" })
  }

  const handleUnlink = () => {
    if (unlinkId) {
      const envelope = envelopes.find((e) => e.id === unlinkId)
      if (envelope && envelope.balance !== 0) {
        alert("Cannot unlink envelope with non-zero balance. Transfer the balance first.")
        setUnlinkId(null)
        return
      }
      setEnvelopes(envelopes.filter((e) => e.id !== unlinkId))
      setUnlinkId(null)
    }
  }

  const selectedAccountName = mockAccounts.find((a) => a.id === Number.parseInt(selectedAccount))?.name

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Envelopes</h2>
          <p className="text-muted-foreground">Link categories to accounts for envelope budgeting</p>
        </div>
      </div>

      {/* Account Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Account</CardTitle>
          <CardDescription>Choose an account to view and manage its envelopes</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mockAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id.toString()}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {filteredEnvelopes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No envelopes for {selectedAccountName} yet</p>
            <Dialog open={isLinkOpen} onOpenChange={setIsLinkOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Link Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Link Category to Account</DialogTitle>
                  <DialogDescription>
                    Create an envelope by linking a category to {selectedAccountName}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label>Category</label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({ category: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsLinkOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleLinkCategory} disabled={!formData.category}>
                    Link Category
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex gap-2">
            <Dialog open={isLinkOpen} onOpenChange={setIsLinkOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Link Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Link Category to Account</DialogTitle>
                  <DialogDescription>
                    Create an envelope by linking a category to {selectedAccountName}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label>Category</label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({ category: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsLinkOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleLinkCategory} disabled={!formData.category}>
                    Link Category
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{selectedAccountName} Envelopes</CardTitle>
              <CardDescription>
                {filteredEnvelopes.length} envelope{filteredEnvelopes.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEnvelopes.map((envelope) => (
                    <TableRow key={envelope.id}>
                      <TableCell className="font-medium">{envelope.category}</TableCell>
                      <TableCell>
                        <span className={cn("font-semibold", envelope.balance >= 0 ? "text-success" : "text-error")}>
                          {formatCurrency(envelope.balance)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={envelope.active ? "default" : "secondary"}>
                          {envelope.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setUnlinkId(envelope.id)}
                          className={cn(envelope.balance !== 0 && "opacity-50")}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {filteredEnvelopes.some((e) => e.balance < 0) && (
            <Alert className="border-error/50 bg-error/5">
              <AlertTriangle className="h-4 w-4 text-error" />
              <AlertTitle className="text-error">Negative Balance Warning</AlertTitle>
              <AlertDescription>
                Some envelopes have negative balances. Review and transfer funds as needed.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {/* Unlink Confirmation */}
      {unlinkId && envelopes.find((e) => e.id === unlinkId)?.balance === 0 && (
        <Dialog open={unlinkId !== null} onOpenChange={() => setUnlinkId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Unlink Envelope?</DialogTitle>
              <DialogDescription>
                Remove {envelopes.find((e) => e.id === unlinkId)?.category} from {selectedAccountName}
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setUnlinkId(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleUnlink}>
                Unlink
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
