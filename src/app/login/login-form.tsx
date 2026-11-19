'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/logo'

// Shown once the Google provider is turned on in Supabase (Authentication → Providers → Google)
const GOOGLE_SIGN_IN = process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN === 'true'

const GOOGLE_ERRORS: Record<string, string> = {
  'google-no-account': 'No Benchtop account uses that Google address. Sign in with the Google account for the email you were invited with, or with your password.',
  'google-canceled': 'Google sign-in was canceled.',
  'google-failed': 'Google sign-in didn’t work. Please try again, or sign in with your password.',
}

// Google's "G" mark, in its brand colors as their sign-in guidelines ask
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/projects'
  // Set by /auth/confirm when a password reset link can't be used
  const linkError = searchParams.get('error') === 'invalid-reset-link'
  // Set by /auth/callback after "Continue with Google"
  const googleError = GOOGLE_ERRORS[searchParams.get('error') ?? '']

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function signInWithGoogle() {
    setGoogleLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { prompt: 'select_account' },
      },
    })
    // On success the browser is already on its way to Google
    if (error) {
      toast.error(error.message)
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    router.push(next)
    router.refresh()
  }

  return (
    <div className="w-full max-w-sm bg-white rounded-lg shadow-sm border border-gray-200 p-8 overflow-hidden">
      <div className="mb-6">
        <div className="-mx-8 -mt-8 mb-6 rounded-t-lg bg-lcd-300 px-8 py-7 shadow-[inset_0_2px_0_rgba(22,32,14,.12),inset_0_0_24px_rgba(111,140,18,.35)]">
          <h1 className="text-ink-900">
            <Logo variant="wordmark" height={36} />
          </h1>
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-ink-700 mt-3">Formulation, from bench to label.</p>
        </div>
        <p className="text-xs text-gray-500">
          Access is by invitation only. No invitation yet?{' '}
          <Link href="/request-invite" className="text-blue-600 hover:underline">Request one</Link>
        </p>
      </div>

      {linkError && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          That reset link has expired or was already used. Reset links only work once, in the browser
          you requested them from.{' '}
          <Link href="/forgot-password" className="font-medium underline">Send a new one</Link>
        </div>
      )}

      {googleError && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {googleError}
          {searchParams.get('error') === 'google-no-account' && (
            <> <Link href="/request-invite" className="font-medium underline">Request an invitation</Link></>
          )}
        </div>
      )}

      {GOOGLE_SIGN_IN && (
        <>
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-white text-gray-800 text-sm font-medium
                       border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <GoogleMark />
            {googleLoading ? 'Opening Google…' : 'Continue with Google'}
          </button>
          <div className="my-4 flex items-center gap-3 text-xs text-gray-400" aria-hidden>
            <span className="h-px flex-1 bg-gray-200" />or<span className="h-px flex-1 bg-gray-200" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 bg-blue-600 text-white text-sm font-medium rounded-md
                     hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-xs text-gray-500 text-center">
        By signing in you agree to the{' '}
        <Link href="/legal/terms" className="text-blue-600 hover:underline">Terms</Link>{' '}
        and{' '}
        <Link href="/legal/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
      </p>
    </div>
  )
}
