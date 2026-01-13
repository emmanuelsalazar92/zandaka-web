import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Edit2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AccountUi } from "@/components/accounts/types/accounts.types"

type AccountsTableProps = {
  accounts: AccountUi[]
  loading: boolean
  error: string | null
  onEdit: (account: AccountUi) => void
  onDeactivate: (accountId: number) => void
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "CRC" ? 0 : 2,
  }).format(amount)
}

export function AccountsTable({
  accounts,
  loading,
  error,
  onEdit,
  onDeactivate,
}: AccountsTableProps) {
  const groupedAccounts = accounts.reduce(
    (acc, account) => {
      if (!acc[account.institution]) {
        acc[account.institution] = []
      }
      acc[account.institution].push(account)
      return acc
    },
    {} as Record<string, AccountUi[]>,
  )

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="py-6 text-center text-muted-foreground">Loading accounts...</div>
      ) : null}
      {error ? <div className="py-6 text-center text-red-500">{error}</div> : null}
      {!loading && !error
        ? Object.entries(groupedAccounts).map(([institution, instAccounts]) => (
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
                          <span
                            className={cn(
                              "font-semibold",
                              account.balance >= 0 ? "text-success" : "text-error",
                            )}
                          >
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
                            <Button variant="ghost" size="sm" onClick={() => onEdit(account)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDeactivate(account.id)}
                            >
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
          ))
        : null}
    </div>
  )
}
