import { Suspense } from 'react'
import LoginForm from './login-form'

// Read per request, not baked in at build time, so the Vercel setting takes effect without a rebuild
export const dynamic = 'force-dynamic'

// A computed name keeps the bundler from inlining the build-time value of the variable
function runtimeEnv(name: string): string | undefined {
  return process.env[name]
}

export default function LoginPage() {
  // Shown once the Google provider is turned on in Supabase (Authentication → Providers → Google)
  const googleSignIn = runtimeEnv(['NEXT_PUBLIC', 'GOOGLE_SIGN_IN'].join('_'))?.trim().toLowerCase() === 'true'
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Suspense fallback={
        <div className="w-full max-w-sm bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="h-8 w-24 bg-gray-100 rounded animate-pulse mb-6" />
          <div className="space-y-4">
            <div className="h-10 bg-gray-100 rounded animate-pulse" />
            <div className="h-10 bg-gray-100 rounded animate-pulse" />
            <div className="h-10 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      }>
        <LoginForm googleSignIn={googleSignIn} />
      </Suspense>
    </div>
  )
}
