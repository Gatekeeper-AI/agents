import "./globals.css"
import { Inter } from "next/font/google"
import { SessionProvider } from "@/components/session-provider"
import Nav from "@/components/nav"
import type React from "react" // Added import for React

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Auth Demo",
  description: "Authentication demo with Next.js and Vercel",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>
          <Nav />
          <main className="container mx-auto mt-8 px-4">{children}</main>
        </SessionProvider>
      </body>
    </html>
  )
}

