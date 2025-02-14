import Link from "next/link"
import AuthForm from "@/components/auth-form"

export default function SignUp() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">Create a new account</h2>
        </div>
        <AuthForm mode="signup" />
        <div className="text-sm text-center">
          <Link href="/signin" className="font-medium text-indigo-600 hover:text-indigo-500">
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}

