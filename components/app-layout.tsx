"use client"

import {
  LayoutDashboard,
  CreditCard,
  Mail,
  ArrowLeftRight,
  ArrowLeft,
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
import {
  navigationContext,
  navigationCurrent,
  settingsDestination,
  taskDestinations,
} from "@/lib/navigation"

const NAV_ICONS = {
  "/": LayoutDashboard,
  "/transactions": ArrowLeftRight,
  "/accounts": CreditCard,
  "/envelopes": Mail,
  "/reconciliation": CheckSquare,
  "/budgets": PiggyBank,
  "/reports": BarChart3,
} as const
const NAV_ITEMS = taskDestinations.map((item) => ({ ...item, icon: NAV_ICONS[item.href] }))

function AppSidebar() {
  const pathname = usePathname()
  const { isMobile, closeMobileForNavigation } = useSidebar()
  const closeMobile = () => {
    if (isMobile) closeMobileForNavigation()
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex h-12 items-center gap-2 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center">
            <Image
              src="/brand/zandaka-mark.svg"
              alt="Zandaka"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <span
              aria-hidden="true"
              className="text-xl font-semibold tracking-[-0.035em] text-foreground"
            >
              Zandaka
            </span>
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
                const isActive = navigationContext(pathname).activeHref === item.href
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      className="min-h-11 h-auto whitespace-normal rounded-xl px-3 [&>span:last-child]:whitespace-normal [&>span:last-child]:overflow-visible [&>span:last-child]:[overflow-wrap:anywhere]"
                    >
                      <Link
                        href={item.href}
                        data-testid={`nav-${item.href.replace("/", "") || "dashboard"}`}
                        aria-label={item.label}
                        aria-current={navigationCurrent(pathname, item.href)}
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
              isActive={navigationContext(pathname).activeHref === settingsDestination.href}
              className="h-11 rounded-xl px-3"
            >
              <Link
                href={settingsDestination.href}
                onNavigate={closeMobile}
                aria-label="Ajustes"
                aria-current={navigationCurrent(pathname, settingsDestination.href)}
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

  const { parent } = navigationContext(pathname)

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  return (
    <header
      aria-label="Herramientas de Zandaka"
      className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-card px-4 py-2 md:px-7"
    >
      <SidebarTrigger
        className="-ml-1 size-11 text-muted-foreground"
        aria-expanded={isMobile ? openMobile : state === "expanded"}
        aria-label={
          (isMobile ? openMobile : state === "expanded") ? "Cerrar navegación" : "Abrir navegación"
        }
      />
      {parent && (
        <nav
          aria-label="Ubicación"
          className="order-last w-full min-w-0 md:order-none md:w-auto md:flex-1"
        >
          <Link
            href={parent.href}
            aria-label={`Volver a ${parent.label}`}
            className="flex min-h-control min-w-0 items-center gap-2 rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{parent.label}</span>
          </Link>
        </nav>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="ml-auto size-11 text-muted-foreground"
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
    <SidebarProvider
      defaultOpen={defaultSidebarOpen}
      style={{ "--sidebar-width": "min(16rem, 50vw)" } as React.CSSProperties}
    >
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-card p-3 text-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>
      <AppSidebar />
      <SidebarInset className="flex min-w-0 flex-col">
        <AppHeader />
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 p-4 outline-none md:p-7">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
