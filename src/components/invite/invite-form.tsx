'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { PASSWORD_MIN_LENGTH } from '@/lib/account-schemas'
import { btnPrimary, Field, inputCls } from '@/components/settings/ui'

export function InviteForm({ token, email }: { token: string; email: string }) {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!fullName.trim()) return setError('Full name is required')
    if (password.length < PASSWORD_MIN_LENGTH) return setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    if (password !== confirm) return setError('Passwords do not match')
    if (!accepted) return setError('You must accept the Terms and Privacy Policy')

    setLoading(true)
    const res = await fetch('/api/invitations/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, fullName, company, password, acceptTerms: true }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setLoading(false)
      return setError(body?.error ?? `Signup failed (${res.status})`)
    }

    // Account exists now: sign in and go straight to subscribing
    const { error: signInError } = await createClient().auth.signInWithPassword({ email, password })
    if (signInError) {
      toast.error('Your account was created. Please sign in.')
      router.push('/login')
      return
    }
    router.push('/settings/billing?welcome=1')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email" htmlFor="email">
        <input id="email" value={email} readOnly disabled className={inputCls} />
      </Field>
      <Field label="Full name" htmlFor="fullName">
        <input id="fullName" required maxLength={120} value={fullName} onChange={e => setFullName(e.target.value)} className={inputCls} autoComplete="name" />
      </Field>
      <Field label="Company (optional)" htmlFor="company">
        <input id="company" maxLength={120} value={company} onChange={e => setCompany(e.target.value)} className={inputCls} autoComplete="organization" />
      </Field>
      <Field label="Password" htmlFor="password" hint={`At least ${PASSWORD_MIN_LENGTH} characters`}>
        <input id="password" type="password" required minLength={PASSWORD_MIN_LENGTH} value={password} onChange={e => setPassword(e.target.value)} className={inputCls} autoComplete="new-password" />
      </Field>
      <Field label="Confirm password" htmlFor="confirm">
        <input id="confirm" type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} className={inputCls} autoComplete="new-password" />
      </Field>

      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-1" />
        <span>
          I agree to the{' '}
          <Link href="/legal/terms" target="_blank" className="text-blue-600 hover:underline">Terms of Service</Link>{' '}
          and{' '}
          <Link href="/legal/privacy" target="_blank" className="text-blue-600 hover:underline">Privacy Policy</Link>.
        </span>
      </label>

      {error && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">{error}</div>}

      <button type="submit" disabled={loading} className={`${btnPrimary} w-full`}>
        {loading ? 'Creating account…' : 'Create account'}
      </button>
      <p className="text-xs text-gray-500 text-center">
        Already have an account? <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
      </p>
    </form>
  )
}
