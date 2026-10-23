'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/logo'

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/projects'
  // Set by /auth/confirm when a password reset link can't be used
  const linkError = searchParams.get('error') === 'invalid-reset-link'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

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
        <p className="text-xs text-gray-500">Access is by invitation only.</p>
      </div>

      {linkError && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          That reset link has expired or was already used. Reset links only work once, in the browser
          you requested them from.{' '}
          <Link href="/forgot-password" className="font-medium underline">Send a new one</Link>
        </div>
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
