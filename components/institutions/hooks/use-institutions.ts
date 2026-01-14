import * as React from "react"

import type {
  InstitutionFormData,
  InstitutionType,
  InstitutionUi,
} from "@/components/institutions/types/institutions.types"

const API_BASE_URL = "http://localhost:3000/api/institutions"
const DEFAULT_FORM_DATA: InstitutionFormData = { name: "", type: "BANK" }

type ApiInstitution = {
  id: number
  name: string
  type: InstitutionType
  is_active: number
}

export function useInstitutions() {
  const [institutions, setInstitutions] = React.useState<InstitutionUi[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [deactivateId, setDeactivateId] = React.useState<number | null>(null)
  const [editInstitution, setEditInstitution] = React.useState<InstitutionUi | null>(null)
  const [formData, setFormData] = React.useState<InstitutionFormData>(DEFAULT_FORM_DATA)

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

      const res = await fetch(API_BASE_URL, {
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
        throw new Error("Error creating institution")
      }

      setIsCreateOpen(false)
      setFormData(DEFAULT_FORM_DATA)
      await fetchInstitutions()
    } catch {
      alert("Error creating institution")
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
        throw new Error("Error updating institution")
      }

      setIsEditOpen(false)
      setEditInstitution(null)
      setFormData(DEFAULT_FORM_DATA)
      await fetchInstitutions()
    } catch {
      alert("Error updating institution")
    }
  }

  const handleDeactivate = async () => {
    if (!deactivateId) return

    try {
      const response = await fetch(`${API_BASE_URL}/${deactivateId}/deactivate`, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
      })

      if (!response.ok) {
        throw new Error("Failed to deactivate institution")
      }

      await fetchInstitutions()
    } catch {
      alert("Error deactivating institution")
    } finally {
      setDeactivateId(null)
    }
  }

  const openEdit = (institution: InstitutionUi) => {
    setEditInstitution(institution)
    setFormData({ name: institution.name, type: institution.type })
    setIsEditOpen(true)
  }

  const closeCreate = () => setIsCreateOpen(false)
  const closeEdit = () => setIsEditOpen(false)

  return {
    institutions,
    loading,
    error,
    isCreateOpen,
    isEditOpen,
    deactivateId,
    formData,
    editInstitution,
    setIsCreateOpen,
    setDeactivateId,
    setFormData,
    fetchInstitutions,
    handleCreate,
    handleEdit,
    handleDeactivate,
    openEdit,
    closeCreate,
    closeEdit,
  }
}
