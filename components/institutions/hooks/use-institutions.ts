import * as React from "react"

import type {
  InstitutionFormData,
  InstitutionType,
  InstitutionUi,
} from "@/components/institutions/types/institutions.types"
import { publicErrorMessage } from "@/lib/public-error"

const API_BASE_URL = "/api/institutions"
const ACCOUNT_BALANCES_URL = "/api/reports/account-balances?isActive=true"
const DEFAULT_FORM_DATA: InstitutionFormData = { name: "", type: "BANK" }

type ApiInstitution = {
  id: number
  name: string
  type: InstitutionType
  is_active: number
}

type ApiAccountBalance = {
  institution_id: number
  is_active: number
}

const getApiErrorMessage = (payload: unknown, fallback: string) =>
  publicErrorMessage(payload, fallback)

export function useInstitutions() {
  const [institutions, setInstitutions] = React.useState<InstitutionUi[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [deactivateId, setDeactivateId] = React.useState<number | null>(null)
  const [deactivateError, setDeactivateError] = React.useState<string | null>(null)
  const [editInstitution, setEditInstitution] = React.useState<InstitutionUi | null>(null)
  const [formData, setFormData] = React.useState<InstitutionFormData>(DEFAULT_FORM_DATA)

  const mapInstitution = (item: ApiInstitution, activeAccountsCount: number): InstitutionUi => ({
    id: item.id,
    name: item.name,
    type: item.type,
    status: item.is_active === 1 ? "Active" : "Inactive",
    activeAccountsCount,
  })

  const fetchInstitutions = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [institutionRes, accountBalancesRes] = await Promise.all([
        fetch(API_BASE_URL, {
          headers: { Accept: "application/json" },
        }),
        fetch(ACCOUNT_BALANCES_URL, {
          headers: { Accept: "application/json" },
        }),
      ])

      if (!institutionRes.ok || !accountBalancesRes.ok) {
        throw new Error("No pudimos cargar las instituciones. Vuelve a intentar.")
      }

      const institutionsData = (await institutionRes.json()) as ApiInstitution[]
      const accountBalancesData = (await accountBalancesRes.json()) as ApiAccountBalance[]
      const activeAccountsByInstitution = accountBalancesData.reduce<Record<number, number>>(
        (counts, account) => {
          if (account.is_active === 1) {
            counts[account.institution_id] = (counts[account.institution_id] || 0) + 1
          }

          return counts
        },
        {},
      )

      setInstitutions(
        institutionsData.map((institution) =>
          mapInstitution(institution, activeAccountsByInstitution[institution.id] || 0),
        ),
      )
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "No pudimos cargar las instituciones. Vuelve a intentar."
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchInstitutions()
  }, [fetchInstitutions])

  const handleCreate = async () => {
    try {
      const response = await fetch(API_BASE_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: 1,
          name: formData.name,
          type: formData.type,
        }),
      })

      if (!response.ok) {
        throw new Error("No pudimos crear la institución. Revisa los datos y vuelve a intentar.")
      }

      setIsCreateOpen(false)
      setFormData(DEFAULT_FORM_DATA)
      await fetchInstitutions()
    } catch {
      alert("No pudimos crear la institución. Revisa los datos y vuelve a intentar.")
    }
  }

  const handleEdit = async () => {
    if (!editInstitution) return

    try {
      const response = await fetch(`${API_BASE_URL}/${editInstitution.id}`, {
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
        throw new Error("No pudimos guardar la institución. Vuelve a intentar.")
      }

      setIsEditOpen(false)
      setEditInstitution(null)
      setFormData(DEFAULT_FORM_DATA)
      await fetchInstitutions()
    } catch {
      alert("No pudimos guardar la institución. Vuelve a intentar.")
    }
  }

  const handleDeactivate = async () => {
    if (!deactivateId) return

    const currentInstitution = institutions.find((institution) => institution.id === deactivateId)
    if (currentInstitution?.status === "Active" && currentInstitution.activeAccountsCount > 0) {
      setDeactivateError("Desactiva las cuentas activas antes de desactivar esta institución.")
      return
    }

    try {
      setDeactivateError(null)
      const response = await fetch(`${API_BASE_URL}/${deactivateId}/deactivate`, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null)
        throw new Error(
          getApiErrorMessage(
            errorPayload,
            "No pudimos desactivar la institución. Revisa sus cuentas activas.",
          ),
        )
      }

      await fetchInstitutions()
      setDeactivateId(null)
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "No pudimos desactivar la institución. Vuelve a intentar."
      setDeactivateError(message)
    }
  }

  const openEdit = (institution: InstitutionUi) => {
    setEditInstitution(institution)
    setFormData({ name: institution.name, type: institution.type })
    setIsEditOpen(true)
  }

  const closeCreate = () => setIsCreateOpen(false)
  const closeEdit = () => setIsEditOpen(false)
  const openDeactivate = (institutionId: number) => {
    setDeactivateError(null)
    setDeactivateId(institutionId)
  }
  const closeDeactivate = () => {
    setDeactivateError(null)
    setDeactivateId(null)
  }

  return {
    institutions,
    loading,
    error,
    isCreateOpen,
    isEditOpen,
    deactivateId,
    deactivateError,
    formData,
    editInstitution,
    setIsCreateOpen,
    setFormData,
    fetchInstitutions,
    handleCreate,
    handleEdit,
    handleDeactivate,
    openEdit,
    openDeactivate,
    closeCreate,
    closeEdit,
    closeDeactivate,
  }
}
