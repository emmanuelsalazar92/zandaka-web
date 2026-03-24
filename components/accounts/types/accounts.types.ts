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
  balance: number
  active: boolean
  hasActiveEnvelopes: boolean
  activeEnvelopesCount: number
  allowOverdraft: boolean
  type: string | null
}

export type AccountFormData = {
  name: string
  institutionId: string
  currency: string
  allowOverdraft: boolean
}
