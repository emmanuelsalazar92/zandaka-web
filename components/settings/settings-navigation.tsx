"use client"

import {
  Building2,
  Coins,
  FolderTree,
  SlidersHorizontal,
  UserRound,
  WandSparkles,
} from "lucide-react"
import Link from "next/link"

import styles from "@/components/settings/settings.module.css"

const destinations = [
  { id: "profile", href: "/settings", label: "Perfil y preferencias", icon: UserRound },
  { id: "institutions", href: "/institutions", label: "Instituciones", icon: Building2 },
  { id: "categories", href: "/categories", label: "Categorías", icon: FolderTree },
  { id: "cash", href: "/settings?section=cash", label: "Efectivo", icon: Coins },
  { id: "payroll", href: "/settings?section=payroll", label: "Nómina", icon: SlidersHorizontal },
  { id: "rules", href: "/settings?section=rules", label: "Automatización", icon: WandSparkles },
] as const

export function SettingsNavigation({
  current,
  onSectionChange,
}: {
  current: string
  onSectionChange?: (section: string) => void
}) {
  return (
    <nav aria-label="Secciones de ajustes" className={styles.navigation}>
      {destinations.map(({ id, href, label, icon: Icon }) => (
        <Link
          key={id}
          href={href}
          aria-current={current === id ? "page" : undefined}
          onClick={
            onSectionChange && id !== "institutions" && id !== "categories"
              ? (event) => {
                  if (
                    event.button ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                  )
                    return
                  event.preventDefault()
                  onSectionChange(id)
                  window.history.replaceState(null, "", href)
                }
              : undefined
          }
        >
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  )
}
