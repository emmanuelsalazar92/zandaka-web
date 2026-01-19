"use client"

import { Plus, AlertTriangle, XCircle } from "lucide-react"
import * as React from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

function formatCurrency(amount: number) {
  const currency = amount >= -1000 ? "USD" : "CRC"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: currency === "CRC" ? 0 : 2,
  }).format(amount)
}

type EnvelopeRow = {
  id: number
  accountId: number
  categoryId: number
  category: string
  balance: number
  active: boolean
}

export function EnvelopesContent() {
  const [envelopes, setEnvelopes] = React.useState<EnvelopeRow[]>([])
  const [envelopesLoading, setEnvelopesLoading] = React.useState(false)
  const [envelopesError, setEnvelopesError] = React.useState<string | null>(null)
  const [accounts, setAccounts] = React.useState<{ id: number; name: string; active: boolean }[]>(
    [],
  )
  const [accountsLoading, setAccountsLoading] = React.useState(false)
  const [accountsError, setAccountsError] = React.useState<string | null>(null)
  const [categories, setCategories] = React.useState<
    { id: number; name: string; parentId: number | null }[]
  >([])
  const [categoriesLoading, setCategoriesLoading] = React.useState(false)
  const [categoriesError, setCategoriesError] = React.useState<string | null>(null)
  const [selectedAccount, setSelectedAccount] = React.useState<string>("")
  const [isLinkOpen, setIsLinkOpen] = React.useState(false)
  const [unlinkId, setUnlinkId] = React.useState<number | null>(null)
  const [isLinking, setIsLinking] = React.useState(false)
  const [linkError, setLinkError] = React.useState<string | null>(null)
  const [formData, setFormData] = React.useState({
    categoryId: "",
  })

  React.useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setAccountsLoading(true)
        setAccountsError(null)
        const res = await fetch("http://localhost:3000/api/accounts", {
          headers: { Accept: "application/json" },
        })
        if (!res.ok) throw new Error("Failed to load accounts")
        const data = (await res.json()) as {
          id: number
          name: string
          is_active: number
        }[]
        setAccounts(
          data.map((account) => ({
            id: account.id,
            name: account.name,
            active: account.is_active === 1,
          })),
        )
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load accounts"
        setAccountsError(message)
      } finally {
        setAccountsLoading(false)
      }
    }

    fetchAccounts()
  }, [])

  React.useEffect(() => {
    const fetchCategories = async () => {
      try {
        setCategoriesLoading(true)
        setCategoriesError(null)
        const res = await fetch("http://localhost:3000/api/categories?activeOnly=true", {
          headers: { Accept: "application/json" },
        })
        if (!res.ok) throw new Error("Failed to load categories")
        const data = (await res.json()) as {
          id: number
          name: string
          parentId?: number | null
          parent_id?: number | null
          parent?: { id?: number | null } | number | null
        }[]
        setCategories(
          data.map((category) => ({
            id: category.id,
            name: category.name,
            parentId:
              category.parentId ??
              category.parent_id ??
              (typeof category.parent === "object" && category.parent
                ? (category.parent.id ?? null)
                : (category.parent ?? null)),
          })),
        )
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load categories"
        setCategoriesError(message)
      } finally {
        setCategoriesLoading(false)
      }
    }

    fetchCategories()
  }, [])

  const selectableCategories = categories.filter((category) => category.parentId !== null)
  const hasCategories = selectableCategories.length > 0
  const activeAccounts = accounts.filter((account) => account.active)

  React.useEffect(() => {
    if (activeAccounts.length === 0) {
      setSelectedAccount("")
      return
    }
    setSelectedAccount((prev) =>
      activeAccounts.some((account) => account.id.toString() === prev)
        ? prev
        : activeAccounts[0].id.toString(),
    )
  }, [activeAccounts])

  const selectedAccountId = Number.parseInt(selectedAccount)
  const isAccountSelected = !Number.isNaN(selectedAccountId)
  const filteredEnvelopes = Number.isNaN(selectedAccountId)
    ? []
    : envelopes.filter((env) => env.accountId === selectedAccountId)

  const fetchEnvelopes = React.useCallback(async (accountId: number) => {
    try {
      setEnvelopesLoading(true)
      setEnvelopesError(null)
      const res = await fetch(
        `http://localhost:3000/api/reports/envelope-balances?accountId=${accountId}`,
        { headers: { Accept: "application/json" } },
      )
      if (!res.ok) throw new Error("Failed to load envelope balances")
      const data = (await res.json()) as {
        envelopeId: number
        categoryId: number
        categoryName: string
        balance: number
      }[]
      setEnvelopes(
        data.map((item) => ({
          id: item.envelopeId,
          accountId,
          categoryId: item.categoryId,
          category: item.categoryName,
          balance: item.balance,
          active: true,
        })),
      )
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load envelope balances"
      setEnvelopesError(message)
      setEnvelopes([])
    } finally {
      setEnvelopesLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (!isAccountSelected) {
      setEnvelopes([])
      setEnvelopesError(null)
      return
    }
    fetchEnvelopes(selectedAccountId)
  }, [fetchEnvelopes, isAccountSelected, selectedAccountId])

  const handleLinkCategory = async () => {
    if (Number.isNaN(selectedAccountId) || !formData.categoryId || isLinking) return

    try {
      setIsLinking(true)
      setLinkError(null)
      const res = await fetch(`http://localhost:3000/api/accounts/${selectedAccountId}/envelopes`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          categoryId: Number.parseInt(formData.categoryId, 10),
        }),
      })
      if (!res.ok) {
        let message = "Failed to link category"
        try {
          const err = (await res.json()) as {
            error?: { message?: string }
            message?: string
          }
          message = err?.error?.message || err?.message || message
        } catch {}
        throw new Error(message)
      }
      const data = (await res.json()) as {
        id: number
        account_id?: number
        category_id?: number
        is_active?: number
      }

      const linkedCategory = categories.find(
        (cat) => cat.id === Number.parseInt(formData.categoryId, 10),
      )

      setEnvelopes((prev) => [
        ...prev,
        {
          id:
            typeof data.id === "number"
              ? data.id
              : prev.length
                ? Math.max(...prev.map((e) => e.id)) + 1
                : 1,
          accountId: selectedAccountId,
          categoryId: Number.parseInt(formData.categoryId, 10),
          category: linkedCategory?.name || "",
          balance: 0,
          active: data.is_active === 1,
        },
      ])
      setIsLinkOpen(false)
      setFormData({ categoryId: "" })
      await fetchEnvelopes(selectedAccountId)
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to link category"
      setLinkError(message)
    } finally {
      setIsLinking(false)
    }
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

  const selectedAccountName = accounts.find((a) => a.id === selectedAccountId)?.name
  const selectedAccountLabel = selectedAccountName ?? "this account"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Envelopes</h2>
          <p className="text-muted-foreground">
            Link categories to accounts for envelope budgeting
          </p>
        </div>
      </div>

      {/* Account Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Account</CardTitle>
          <CardDescription>Choose an account to view and manage its envelopes</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedAccount}
            onValueChange={setSelectedAccount}
            disabled={accountsLoading || activeAccounts.length === 0}
          >
            <SelectTrigger className="w-64">
              <SelectValue
                placeholder={
                  accountsLoading
                    ? "Loading accounts..."
                    : activeAccounts.length === 0
                      ? "No active accounts"
                      : "Select an account"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {activeAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id.toString()}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {accountsError && <p className="text-sm text-error mt-2">{accountsError}</p>}
        </CardContent>
      </Card>

      {envelopesError && <p className="text-sm text-error">{envelopesError}</p>}

      {envelopesLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Loading envelopes...</p>
          </CardContent>
        </Card>
      ) : filteredEnvelopes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              No envelopes for {selectedAccountLabel} yet
            </p>
            <Dialog
              open={isLinkOpen}
              onOpenChange={(open) => {
                setIsLinkOpen(open)
                if (!open) {
                  setFormData({ categoryId: "" })
                  setLinkError(null)
                }
              }}
            >
              <DialogTrigger asChild>
                <Button disabled={!isAccountSelected}>
                  <Plus className="mr-2 h-4 w-4" />
                  Link Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Link Category to Account</DialogTitle>
                  <DialogDescription>
                    Create an envelope by linking a category to {selectedAccountLabel}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label>Category</label>
                    <Select
                      value={formData.categoryId}
                      onValueChange={(value) => setFormData({ categoryId: value })}
                      disabled={categoriesLoading || !hasCategories}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            categoriesLoading
                              ? "Loading categories..."
                              : !hasCategories
                                ? "No active categories"
                                : "Select a category"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {selectableCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {categoriesError && <p className="text-sm text-error">{categoriesError}</p>}
                    {linkError && <p className="text-sm text-error">{linkError}</p>}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsLinkOpen(false)
                      setFormData({ categoryId: "" })
                      setLinkError(null)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleLinkCategory} disabled={!formData.categoryId || isLinking}>
                    {isLinking ? "Linking..." : "Link Category"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex gap-2">
            <Dialog
              open={isLinkOpen}
              onOpenChange={(open) => {
                setIsLinkOpen(open)
                if (!open) {
                  setFormData({ categoryId: "" })
                  setLinkError(null)
                }
              }}
            >
              <DialogTrigger asChild>
                <Button disabled={!isAccountSelected}>
                  <Plus className="mr-2 h-4 w-4" />
                  Link Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Link Category to Account</DialogTitle>
                  <DialogDescription>
                    Create an envelope by linking a category to {selectedAccountLabel}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label>Category</label>
                    <Select
                      value={formData.categoryId}
                      onValueChange={(value) => setFormData({ categoryId: value })}
                      disabled={categoriesLoading || !hasCategories}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            categoriesLoading
                              ? "Loading categories..."
                              : !hasCategories
                                ? "No active categories"
                                : "Select a category"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {selectableCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {categoriesError && <p className="text-sm text-error">{categoriesError}</p>}
                    {linkError && <p className="text-sm text-error">{linkError}</p>}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsLinkOpen(false)
                      setFormData({ categoryId: "" })
                      setLinkError(null)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleLinkCategory} disabled={!formData.categoryId || isLinking}>
                    {isLinking ? "Linking..." : "Link Category"}
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
                        <span
                          className={cn(
                            "font-semibold",
                            envelope.balance >= 0 ? "text-success" : "text-error",
                          )}
                        >
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
                Remove {envelopes.find((e) => e.id === unlinkId)?.category} from{" "}
                {selectedAccountLabel}
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
