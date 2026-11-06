export type InstitutionType = "BANK" | "CASH" | "VIRTUAL"

export type InstitutionUi = {
  id: number
  name: string
  type: InstitutionType
  status: "Active" | "Inactive"
}

export type AccountUi = {
  id: number
  name: string
  institution: string
  currency: string
  balance: number | null
  active: boolean
  hasActiveEnvelopes: boolean | null
  activeEnvelopesCount: number | null
  allowOverdraft: boolean
  type: string | null
  institutionId?: number | null
}

export type AccountFormData = {
  name: string
  institutionId: string
  currency: string
  allowOverdraft: boolean
}
