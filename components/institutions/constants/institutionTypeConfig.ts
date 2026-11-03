import type { InstitutionType } from "@/components/institutions/types/institutions.types"

export const institutionTypeConfig: Record<
  InstitutionType,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  BANK: { label: "Banco", variant: "default" },
  CASH: { label: "Efectivo", variant: "secondary" },
  VIRTUAL: { label: "Virtual", variant: "outline" },
}
