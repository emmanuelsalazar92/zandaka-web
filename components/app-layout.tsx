"use client"

import {
  LayoutDashboard,
  Building2,
  CreditCard,
  FolderTree,
  Mail,
  ArrowLeftRight,
  CheckSquare,
  BarChart3,
  Moon,
  Sun,
  PiggyBank,
  Settings2,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Resumen", href: "/" },
  { icon: ArrowLeftRight, label: "Movimientos", href: "/transactions" },
  { icon: CreditCard, label: "Cuentas", href: "/accounts" },
  { icon: Mail, label: "Sobres", href: "/envelopes" },
  { icon: CheckSquare, label: "Conciliación", href: "/reconciliation" },
  { icon: PiggyBank, label: "Presupuestos", href: "/budgets" },
  { icon: BarChart3, label: "Reportes", href: "/reports" },
]

const SETTINGS_ROUTES = ["/settings", "/institutions", "/categories"]
const CATALOG_ITEMS = [
  { icon: Building2, label: "Instituciones", href: "/institutions" },
  { icon: FolderTree, label: "Categorías", href: "/categories" },
]

function AppSidebar() {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()
  const closeMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex h-12 items-center gap-2 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center">
            <Image
              src="/favicon.ico"
              alt="Zandaka"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <span className="text-xl font-semibold tracking-tight text-foreground">Zandaka</span>
            <p className="text-xs text-muted-foreground">Tu dinero, con claridad.</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const isActive =
                  item.href === "/"
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      className="h-11 rounded-xl px-3"
                    >
                      <Link
                        href={item.href}
                        data-testid={`nav-${item.href.replace("/", "") || "dashboard"}`}
                        aria-label={item.label}
                        aria-current={isActive ? "page" : undefined}
                        onNavigate={closeMobile}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Ajustes"
              isActive={SETTINGS_ROUTES.some((route) => pathname.startsWith(route))}
              className="h-11 rounded-xl px-3"
            >
              <Link
                href="/settings"
                onNavigate={closeMobile}
                aria-label="Ajustes"
                aria-current={
                  SETTINGS_ROUTES.some((route) => pathname.startsWith(route)) ? "page" : undefined
                }
              >
                <Settings2 className="h-5 w-5" />
                <span>Ajustes</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function AppHeader() {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const { state, isMobile, openMobile } = useSidebar()
  const previousPath = React.useRef(pathname)

  React.useEffect(() => {
    if (previousPath.current !== pathname) {
      document.getElementById("main-content")?.focus({ preventScroll: true })
      previousPath.current = pathname
    }
  }, [pathname])

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  return (
    <header className="flex h-18 shrink-0 items-center justify-between border-b border-border/70 bg-card px-4 md:px-7">
      <div className="flex items-center gap-4">
        <SidebarTrigger
          className="-ml-1 size-11 text-muted-foreground"
          aria-expanded={isMobile ? openMobile : state === "expanded"}
          aria-label={isMobile && openMobile ? "Cerrar navegación" : "Abrir navegación"}
        />
        <h1 className="text-sm font-medium text-muted-foreground">
          {[...NAV_ITEMS, ...CATALOG_ITEMS, { label: "Ajustes", href: "/settings" }]
            .sort((left, right) => right.href.length - left.href.length)
            .find((item) =>
              item.href === "/" ? pathname === item.href : pathname.startsWith(item.href),
            )?.label || "Resumen"}
        </h1>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 text-muted-foreground"
        onClick={toggleTheme}
        aria-label="Cambiar apariencia"
      >
        <Sun className="hidden h-5 w-5 dark:block" aria-hidden="true" />
        <Moon className="h-5 w-5 dark:hidden" aria-hidden="true" />
      </Button>
    </header>
  )
}

export function AppLayout({
  children,
  defaultSidebarOpen,
}: {
  children: React.ReactNode
  defaultSidebarOpen: boolean
}) {
  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-card p-3 text-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>
      <AppSidebar />
      <SidebarInset className="flex flex-col">
        <AppHeader />
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 p-4 outline-none md:p-7">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
