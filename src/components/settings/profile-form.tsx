'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { readErrorMessage } from '@/lib/utils'
import { btnPrimary, Card, Field, inputCls } from './ui'

type Values = { fullName: string; company: string; jobTitle: string; phone: string; timezone: string }

export function ProfileForm({ email, initial }: { email: string; initial: Values }) {
  const router = useRouter()
  const [values, setValues] = useState<Values>(initial)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({})

  const set = (key: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues(v => ({ ...v, [key]: e.target.value }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    const res = await fetch('/api/settings/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.clone().json().catch(() => null)
      if (body?.fields) {
        const next: Partial<Record<keyof Values, string>> = {}
        for (const [k, v] of Object.entries(body.fields as Record<string, string[]>)) {
          next[k as keyof Values] = v?.[0]
        }
        setErrors(next)
      }
      toast.error(await readErrorMessage(res, 'Could not save your profile'))
      return
    }
    toast.success('Profile saved')
    router.refresh()
  }

  const browserTz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : ''

  return (
    <Card title="Personal details" description="Used on your account and in communications about it.">
      <form onSubmit={save} className="space-y-4 max-w-lg">
        <Field label="Email" htmlFor="email" hint="Change your sign-in email on the Account tab.">
          <input id="email" value={email} disabled readOnly className={inputCls} />
        </Field>
        <Field label="Full name" htmlFor="fullName" error={errors.fullName}>
          <input id="fullName" required maxLength={120} value={values.fullName} onChange={set('fullName')} className={inputCls} autoComplete="name" />
        </Field>
        <Field label="Company" htmlFor="company" error={errors.company}>
          <input id="company" maxLength={120} value={values.company} onChange={set('company')} className={inputCls} autoComplete="organization" />
        </Field>
        <Field label="Job title" htmlFor="jobTitle" error={errors.jobTitle}>
          <input id="jobTitle" maxLength={120} value={values.jobTitle} onChange={set('jobTitle')} className={inputCls} autoComplete="organization-title" />
        </Field>
        <Field label="Phone" htmlFor="phone" error={errors.phone} hint="Digits, spaces, + ( ) . - only">
          <input id="phone" maxLength={30} value={values.phone} onChange={set('phone')} className={inputCls} autoComplete="tel" />
        </Field>
        <Field label="Time zone" htmlFor="timezone" error={errors.timezone} hint="IANA name, e.g. America/New_York">
          <div className="flex gap-2">
            <input id="timezone" maxLength={64} value={values.timezone} onChange={set('timezone')} className={inputCls} placeholder="America/New_York" />
            {browserTz && (
              <button type="button" className="text-xs text-blue-600 hover:underline whitespace-nowrap" onClick={() => setValues(v => ({ ...v, timezone: browserTz }))}>
                Use mine
              </button>
            )}
          </div>
        </Field>
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </Card>
  )
}
