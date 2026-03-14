export type InstitutionType = "BANK" | "CASH" | "VIRTUAL"

export type InstitutionStatus = "Active" | "Inactive"

export type InstitutionUi = {
  id: number
  name: string
  type: InstitutionType
  status: InstitutionStatus
  activeAccountsCount: number
}

export type InstitutionFormData = {
  name: string
  type: InstitutionType
}
