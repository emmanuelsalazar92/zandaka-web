import { Analytics } from "@vercel/analytics/next"
import { cookies } from "next/headers"

import { AppLayout } from "@/components/app-layout"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"

import type { Metadata } from "next"
import type React from "react"

import "./globals.css"

export const metadata: Metadata = {
  title: "Zandaka — Tu dinero, con claridad",
  description: "Organiza tus cuentas, sobres y movimientos con claridad.",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const sidebarState = cookieStore.get("sidebar_state")?.value
  const defaultSidebarOpen = sidebarState === undefined ? true : sidebarState === "true"

  return (
    <html lang="es-CR" suppressHydrationWarning>
      <body className={`font-sans antialiased`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AppLayout defaultSidebarOpen={defaultSidebarOpen}>{children}</AppLayout>
          <Toaster />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
