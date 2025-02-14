import Link from "next/link"
import AuthForm from "@/components/auth-form"

export default function SignIn() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">Sign in to your account</h2>
        </div>
        <AuthForm mode="signin" />
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <Link href="/signup" className="font-medium text-indigo-600 hover:text-indigo-500">
              Dont have an account? Sign up
            </Link>
          </div>
          <div className="text-sm">
            <Link href="/reset-password" className="font-medium text-indigo-600 hover:text-indigo-500">
              Forgot your password?
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

