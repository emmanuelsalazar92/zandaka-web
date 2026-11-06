"use client"

import * as React from "react"

import { useContextRead } from "@/components/accounts/hooks/use-context-read"
import type {
  AccountFormData,
  AccountUi,
  InstitutionUi,
} from "@/components/accounts/types/accounts.types"
import {
  canDeactivateContextAccount,
  contextRead,
  contextWrite,
  ContextWriteError,
  parseContextAccounts,
  parseContextInstitutions,
} from "@/lib/account-context"

const defaults: AccountFormData = {
  name: "",
  institutionId: "",
  currency: "CRC",
  allowOverdraft: true,
}
const loadAccounts = async (signal: AbortSignal) =>
  parseContextAccounts(await contextRead("/reports/account-balances?isActive=true", signal))
const loadInstitutions = async (signal: AbortSignal) =>
  parseContextInstitutions(await contextRead("/institutions", signal))
export function useAccounts() {
  const listing = useContextRead("accounts", loadAccounts)
  const catalog = useContextRead("institutions", loadInstitutions)
  const [createdInstitutions, setCreatedInstitutions] = React.useState<InstitutionUi[]>([])
  const institutions = [...(catalog.data ?? []), ...createdInstitutions].filter(
    (row, index, rows) => rows.findIndex((item) => item.id === row.id) === index,
  )
  const accounts = listing.data ?? []
  const [formData, setFormData] = React.useState<AccountFormData>(defaults)
  const [isCreateOpen, setCreateOpen] = React.useState(false)
  const [editAccount, setEdit] = React.useState<AccountUi | null>(null)
  const [deactivateId, setDeactivateId] = React.useState<number | null>(null)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [deactivateError, setDeactivateError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [uncertain, setUncertain] = React.useState(false)
  const [notice, setNotice] = React.useState<string | null>(null)
  const lock = React.useRef(false)
  const setIsCreateOpen = (open: boolean) => {
    if (lock.current) return
    setCreateOpen(open)
    setFormError(null)
    setUncertain(false)
    if (!open) setFormData(defaults)
  }
  const run = async (task: () => Promise<void>, onError: (message: string) => void) => {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    try {
      await task()
    } catch (error) {
      onError(error instanceof Error ? error.message : "No pudimos verificar el resultado.")
      if (error instanceof ContextWriteError && error.uncertain) setUncertain(true)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const handleCreate = () => {
    if (
      uncertain ||
      !formData.name.trim() ||
      !institutions.some(
        (row) => row.id === Number(formData.institutionId) && row.status === "Active",
      )
    )
      return
    return run(async () => {
      setFormError(null)
      await contextWrite("/accounts", "POST", {
        userId: 1,
        institutionId: Number(formData.institutionId),
        name: formData.name.trim(),
        currency: formData.currency,
        allowOverdraft: formData.allowOverdraft,
      })
      setCreateOpen(false)
      setFormData(defaults)
      listing.reload()
      setNotice("Cuenta creada. Consulta sus sobres para empezar a distribuir tu dinero.")
    }, setFormError)
  }
  const handleEdit = () => {
    if (!editAccount || uncertain || !formData.name.trim()) return
    return run(async () => {
      setFormError(null)
      await contextWrite(`/accounts/${editAccount.id}`, "PATCH", { name: formData.name.trim() })
      setEdit(null)
      listing.reload()
      setNotice("Nombre de la cuenta actualizado.")
    }, setFormError)
  }
  const handleDeactivate = () => {
    const account = accounts.find((row) => row.id === deactivateId)
    if (!account || !canDeactivateContextAccount(account) || uncertain) return
    return run(async () => {
      setDeactivateError(null)
      await contextWrite(`/accounts/${account.id}/deactivate`, "POST")
      setDeactivateId(null)
      listing.reload()
      setNotice("Cuenta desactivada. Sus movimientos históricos se conservan.")
    }, setDeactivateError)
  }
  return {
    accounts,
    institutions,
    loading: listing.loading,
    error: listing.error,
    institutionsLoading: catalog.loading,
    institutionsError: catalog.error,
    reloadAccounts: listing.reload,
    reloadInstitutions: catalog.reload,
    busy,
    uncertain,
    notice,
    formError,
    isCreateOpen,
    isEditOpen: editAccount !== null,
    deactivateId,
    deactivateError,
    formData,
    setFormData,
    setIsCreateOpen,
    handleCreate,
    handleEdit,
    handleDeactivate,
    onInstitutionCreated: (institution: InstitutionUi) => {
      setCreatedInstitutions((rows) => [...rows, institution])
      setFormData((data) => ({ ...data, institutionId: String(institution.id) }))
    },
    openEdit: (account: AccountUi) => {
      setFormError(null)
      setUncertain(false)
      setEdit(account)
      setFormData({
        name: account.name,
        institutionId: account.institution,
        currency: account.currency,
        allowOverdraft: account.allowOverdraft,
      })
    },
    closeEdit: () => {
      if (!lock.current) {
        setEdit(null)
        setFormError(null)
        setUncertain(false)
      }
    },
    openDeactivate: (id: number) => {
      setDeactivateError(null)
      setUncertain(false)
      setDeactivateId(id)
    },
    closeDeactivate: () => {
      if (!lock.current) {
        setDeactivateId(null)
        setDeactivateError(null)
        setUncertain(false)
      }
    },
  }
}
