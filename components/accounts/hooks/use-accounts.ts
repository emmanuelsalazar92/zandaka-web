import * as React from "react"

import type {
  AccountFormData,
  AccountUi,
  InstitutionType,
  InstitutionUi,
} from "@/components/accounts/types/accounts.types"

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "")
const API_BASE_URL = `${API_ROOT}/api`
const ACCOUNTS_URL = `${API_BASE_URL}/accounts`
const ACCOUNT_BALANCES_URL = `${API_BASE_URL}/reports/account-balances?isActive=true`
const INSTITUTIONS_URL = `${API_BASE_URL}/institutions`
const DEFAULT_FORM_DATA: AccountFormData = {
  name: "",
  institutionId: "",
  currency: "CRC",
  allowOverdraft: true,
}

type ApiInstitution = {
  id: number
  name: string
  type: InstitutionType
  is_active: number
}

type ApiAccountBalance = {
  id: number
  user_id: number
  institution_id: number
  name: string
  currency: string
  is_active: number
  allow_overdraft: number
  institution: string
  type: string | null
  balance: number
}

const toBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value === 1
  return Boolean(value)
}

export function useAccounts() {
  const [accounts, setAccounts] = React.useState<AccountUi[]>([])
  const [institutions, setInstitutions] = React.useState<InstitutionUi[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [deactivateId, setDeactivateId] = React.useState<number | null>(null)
  const [editAccount, setEditAccount] = React.useState<AccountUi | null>(null)
  const [formData, setFormData] = React.useState<AccountFormData>(DEFAULT_FORM_DATA)

  const mapInstitution = (item: ApiInstitution): InstitutionUi => ({
    id: item.id,
    name: item.name,
    type: item.type,
    status: item.is_active === 1 ? "Active" : "Inactive",
  })

  const fetchInstitutions = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(INSTITUTIONS_URL, {
        headers: { Accept: "application/json" },
      })

      if (!res.ok) throw new Error("Failed to load institutions")

      const data = (await res.json()) as ApiInstitution[]
      setInstitutions(data.map(mapInstitution))
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load institutions"
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchAccounts = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(ACCOUNT_BALANCES_URL, {
        headers: { Accept: "application/json" },
      })

      if (!res.ok) throw new Error("Failed to load accounts")

      const data = (await res.json()) as ApiAccountBalance[]
      setAccounts(
        data.map((account) => ({
          id: account.id,
          name: account.name,
          institution: account.institution,
          currency: account.currency,
          balance: account.balance,
          active: account.is_active === 1,
          allowOverdraft: toBoolean(account.allow_overdraft),
          type: account.type ?? null,
        })),
      )
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load accounts"
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchInstitutions()
  }, [fetchInstitutions])

  React.useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const handleCreate = async () => {
    try {
      setLoading(true)
      setError(null)

      const payload = {
        userId: 1,
        institutionId: Number(formData.institutionId),
        name: formData.name.trim(),
        currency: formData.currency,
        allowOverdraft: formData.allowOverdraft,
      }

      const res = await fetch(ACCOUNTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        let message = "Failed to create account"
        try {
          const err = await res.json()
          message = err?.message || message
        } catch {}
        throw new Error(message)
      }

      const created = await res.json()
      const institutionName =
        institutions.find((inst) => inst.id === payload.institutionId)?.name ?? "Unknown"

      setAccounts((prev) => [
        ...prev,
        {
          id: created?.id ?? (prev.length ? Math.max(...prev.map((acc) => acc.id)) + 1 : 1),
          name: created?.name ?? payload.name,
          institution: created?.institution ?? institutionName,
          currency: created?.currency ?? payload.currency,
          balance: created?.balance ?? 0,
          active: toBoolean(created?.active ?? true),
          allowOverdraft: toBoolean(created?.allowOverdraft ?? payload.allowOverdraft),
          type: created?.type ?? null,
        },
      ])

      setIsCreateOpen(false)
      setFormData(DEFAULT_FORM_DATA)
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected error creating account"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async () => {
    if (!editAccount) return

    try {
      setLoading(true)
      setError(null)

      const res = await fetch(`${ACCOUNTS_URL}/${editAccount.id}`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: formData.name.trim() }),
      })

      if (!res.ok) {
        throw new Error("Failed to update account")
      }

      const updated = await res.json()

      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === editAccount.id
            ? {
                ...acc,
                name: updated?.name ?? formData.name,
              }
            : acc,
        ),
      )

      setIsEditOpen(false)
      setEditAccount(null)
      setFormData(DEFAULT_FORM_DATA)
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to update account"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeactivate = async () => {
    if (!deactivateId) return

    try {
      setLoading(true)
      setError(null)

      const res = await fetch(`${ACCOUNTS_URL}/${deactivateId}/deactivate`, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
      })

      if (!res.ok) {
        let message = "Failed to deactivate account"
        try {
          const err = await res.json()
          message = err?.message || message
        } catch {}
        throw new Error(message)
      }

      await fetchAccounts()
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to deactivate account"
      setError(message)
    } finally {
      setLoading(false)
      setDeactivateId(null)
    }
  }

  const openEdit = (account: AccountUi) => {
    setEditAccount(account)
    setFormData({
      name: account.name,
      institutionId: account.institution,
      currency: account.currency,
      allowOverdraft: account.allowOverdraft,
    })
    setIsEditOpen(true)
  }

  const closeEdit = () => {
    setIsEditOpen(false)
    setEditAccount(null)
  }

  return {
    accounts,
    institutions,
    loading,
    error,
    isCreateOpen,
    isEditOpen,
    deactivateId,
    formData,
    setIsCreateOpen,
    setDeactivateId,
    setFormData,
    handleCreate,
    handleEdit,
    handleDeactivate,
    openEdit,
    closeEdit,
  }
}
