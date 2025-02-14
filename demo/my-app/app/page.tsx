import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export default async function Home() {
  const session = await getServerSession(authOptions)

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Welcome to Auth Demo</h1>
      {session ? (
        <div>
          <p>You are signed in as {session.user?.email}</p>
          <p>
            You can now access the{" "}
            <a href="/protected" className="text-blue-600 hover:underline">
              protected page
            </a>
            .
          </p>
        </div>
      ) : (
        <div>
          <p>You are not signed in.</p>
          <p>
            Please{" "}
            <a href="/signin" className="text-blue-600 hover:underline">
              sign in
            </a>{" "}
            or{" "}
            <a href="/signup" className="text-blue-600 hover:underline">
              sign up
            </a>{" "}
            to access the protected content.
          </p>
        </div>
      )}
    </div>
  )
}

