/** Existing URLs stay public contracts; catalogs belong to the Settings destination. */
export const taskDestinations = [
  { href: "/", label: "Resumen" },
  { href: "/transactions", label: "Movimientos" },
  { href: "/accounts", label: "Cuentas" },
  { href: "/envelopes", label: "Sobres" },
  { href: "/reconciliation", label: "Conciliación" },
  { href: "/budgets", label: "Presupuestos" },
  { href: "/reports", label: "Reportes" },
] as const

export const settingsDestination = { href: "/settings", label: "Ajustes" } as const
export const institutionManagement = {
  href: "/institutions",
  label: "Gestionar instituciones",
} as const
export const categoryManagement = { href: "/categories", label: "Gestionar categorías" } as const

function matches(path: string, root: string) {
  return path === root || (root !== "/" && path.startsWith(`${root}/`))
}

export function navigationContext(pathname: string) {
  const catalog = [institutionManagement, categoryManagement].some(({ href }) =>
    matches(pathname, href),
  )
  const active =
    catalog || matches(pathname, settingsDestination.href)
      ? settingsDestination
      : taskDestinations.find(({ href }) => matches(pathname, href))
  return {
    activeHref: active?.href,
    // Only show ancestors in the utility bar: the current task has one title in main.
    parent: active && active.href !== pathname && active.href !== "/" ? active : undefined,
  }
}

export function navigationCurrent(pathname: string, href: string): "page" | "location" | undefined {
  return navigationContext(pathname).activeHref !== href
    ? undefined
    : pathname === href
      ? "page"
      : "location"
}
