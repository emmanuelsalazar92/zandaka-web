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
  CalendarRange,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
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
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Building2, label: "Institutions", href: "/institutions" },
  { icon: CreditCard, label: "Accounts", href: "/accounts" },
  { icon: FolderTree, label: "Categories", href: "/categories" },
  { icon: Mail, label: "Envelopes", href: "/envelopes" },
  { icon: CalendarRange, label: "Planner", href: "/planner" },
  { icon: ArrowLeftRight, label: "Transactions", href: "/transactions" },
  { icon: CheckSquare, label: "Reconciliation", href: "/reconciliation" },
  { icon: BarChart3, label: "Reports", href: "/reports" },
]

function AppSidebar() {
  const isPlannerEnabled = process.env.NEXT_PUBLIC_FEATURE_PLANNER === "true"
  const navItems = isPlannerEnabled
    ? NAV_ITEMS
    : NAV_ITEMS.filter((item) => item.href !== "/planner")
  const pathname = usePathname()
  const { state } = useSidebar()

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
          <span
            className={`font-semibold text-lg text-sidebar-foreground transition-opacity duration-200 group-data-[collapsible=icon]:hidden`}
          >
            Zandaka
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Link
                        href={item.href}
                        data-testid={`nav-${item.href.replace("/", "") || "dashboard"}`}
                        aria-label={item.label}
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
      <SidebarRail />
    </Sidebar>
  )
}

function AppHeader() {
  const pathname = usePathname()
  const isPlannerEnabled = process.env.NEXT_PUBLIC_FEATURE_PLANNER === "true"
  const navItems = isPlannerEnabled
    ? NAV_ITEMS
    : NAV_ITEMS.filter((item) => item.href !== "/planner")
  const [theme, setTheme] = React.useState<"light" | "dark">("light")
  const { state } = useSidebar()

  React.useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.classList.toggle("dark", savedTheme === "dark")
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light"
    setTheme(newTheme)
    localStorage.setItem("theme", newTheme)
    document.documentElement.classList.toggle("dark", newTheme === "dark")
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-4 md:px-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger
          className="-ml-1"
          aria-expanded={state === "expanded"}
          aria-label="Toggle sidebar"
        />
        <h1 className="text-lg font-semibold md:text-xl">
          {navItems.find((item) => item.href === pathname)?.label || "Dashboard"}
        </h1>
      </div>
      <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
        {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </Button>
    </header>
  )
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col">
        <AppHeader />
        <div className="flex-1 overflow-auto p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
