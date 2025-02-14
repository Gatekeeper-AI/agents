"use client"

import { SessionProvider as Provider } from "next-auth/react"
import type React from "react" // Added import for React

type Props = {
  children: React.ReactNode
}

export function SessionProvider({ children }: Props) {
  return <Provider>{children}</Provider>
}

