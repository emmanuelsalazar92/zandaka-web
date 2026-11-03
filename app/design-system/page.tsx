import { DesignSystemGallery } from "@/components/design-system/gallery"

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Atlántico · Galería de Zandaka",
  robots: { index: false, follow: false },
}

export default function DesignSystemPage() {
  return <DesignSystemGallery />
}
