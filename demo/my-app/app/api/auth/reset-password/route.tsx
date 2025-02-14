/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(req: Request) {
  const { email } = await req.json()
  const { data, error } = await supabase.auth.resetPasswordForEmail(email)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ message: "Password reset email sent" })
}

