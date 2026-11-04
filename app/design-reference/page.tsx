import { AtlanticCompositionStudy } from "@/components/design-reference/study"

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Atlántico · Composiciones de Sobres",
  robots: { index: false, follow: false },
}

export default async function DesignReferencePage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>
}) {
  const { variant } = await searchParams
  return <AtlanticCompositionStudy initialVariant={variant === "faro" ? "faro" : "marea"} />
}
