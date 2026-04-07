import { Analytics } from "@vercel/analytics/next"
import { cookies } from "next/headers"

import { AppLayout } from "@/components/app-layout"
import { Toaster } from "@/components/ui/toaster"

import type { Metadata } from "next"
import type React from "react"

import "./globals.css"

export const metadata: Metadata = {
  title: "Zandaka - Personal Finance Manager",
  description: "Track your spending with envelope budgeting",
  generator: "v0.app",
  icons: {
    icon: "/favicon.ico",
  },
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
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased`} suppressHydrationWarning>
        <AppLayout defaultSidebarOpen={defaultSidebarOpen}>{children}</AppLayout>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
