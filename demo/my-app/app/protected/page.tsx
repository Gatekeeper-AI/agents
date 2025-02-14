import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function ProtectedPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/signin?callbackUrl=/protected")
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Protected Page</h1>
      <p>This is a protected page. Only authenticated users can see this content.</p>
      <p>Your email: {session.user?.email}</p>
    </div>
  )
}

