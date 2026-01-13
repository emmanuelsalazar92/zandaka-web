import type { InstitutionType } from "@/components/institutions/types/institutions.types"

export const institutionTypeConfig: Record<
  InstitutionType,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  BANK: { label: "Bank", variant: "default" },
  CASH: { label: "Cash", variant: "secondary" },
  VIRTUAL: { label: "Virtual", variant: "outline" },
}
