import { Analytics } from "@vercel/analytics/next"
import { Geist, Geist_Mono } from "next/font/google"

import { AppLayout } from "@/components/app-layout"
import { Toaster } from "@/components/ui/toaster"

import type { Metadata } from "next"
import type React from "react"

import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Zandaka - Personal Finance Manager",
  description: "Track your spending with envelope budgeting",
  generator: "v0.app",
  icons: {
    icon: "/favicon.ico",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased`} suppressHydrationWarning>
        <AppLayout>{children}</AppLayout>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
