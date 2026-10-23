'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { readErrorMessage } from '@/lib/utils'
import { btnPrimary } from '@/components/settings/ui'
import { SignOutButton } from '@/components/settings/sign-out-button'

export function AcceptTermsForm({ termsVersion, privacyVersion }: { termsVersion: string; privacyVersion: string }) {
  const router = useRouter()
  const [accepted, setAccepted] = useState(false)
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!accepted) return
    setSaving(true)
    const res = await fetch('/api/legal/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accept: true, termsVersion, privacyVersion }),
    })
    if (!res.ok) {
      setSaving(false)
      return toast.error(await readErrorMessage(res, 'Could not record your acceptance'))
    }
    router.replace('/projects')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-1" />
        <span>
          I have read and agree to the{' '}
          <Link href="/legal/terms" target="_blank" className="text-blue-600 hover:underline">Terms of Service</Link>{' '}
          and the{' '}
          <Link href="/legal/privacy" target="_blank" className="text-blue-600 hover:underline">Privacy Policy</Link>.
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!accepted || saving} className={btnPrimary}>
          {saving ? 'Saving…' : 'Accept and continue'}
        </button>
        <SignOutButton />
      </div>
    </form>
  )
}
