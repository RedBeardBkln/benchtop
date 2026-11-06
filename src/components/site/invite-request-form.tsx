'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { readErrorMessage } from '@/lib/utils'
import { Field, inputCls, Notice } from '@/components/settings/ui'
import { siteBtnPrimary } from '@/components/site/site-layout'
import {
  INVITE_COMPANY_TYPE_LABELS, INVITE_COMPANY_TYPES, INVITE_MESSAGE_MAX, INVITE_TEAM_SIZE_LABELS, INVITE_TEAM_SIZES,
} from '@/lib/invite-requests'

type FieldErrors = Partial<Record<string, string[]>>

const EMPTY = {
  name: '',
  email: '',
  company: '',
  role: '',
  companyType: '',
  teamSize: '',
  message: '',
  referral: '',
  website: '',
}

export function InviteRequestForm() {
  const [form, setForm] = useState(EMPTY)
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [sentTo, setSentTo] = useState<string | null>(null)

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))
  const fieldError = (key: string) => fieldErrors[key]?.[0]

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError(null)
    setFieldErrors({})
    const res = await fetch('/api/invite-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        companyType: form.companyType || null,
        teamSize: form.teamSize || null,
        consent,
      }),
    }).catch(() => null)
    setSending(false)
    if (!res) return setError('Could not send your request. Check your connection and try again.')
    if (!res.ok) {
      const body = await res.clone().json().catch(() => null)
      if (body?.fields) setFieldErrors(body.fields)
      return setError(await readErrorMessage(res, 'Could not send your request'))
    }
    setSentTo(form.email.trim())
    setForm(EMPTY)
    setConsent(false)
  }

  if (sentTo) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8">
        <CheckCircle2 size={28} className="text-lcd-600" />
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">Thanks, your request is in.</h2>
        <p className="mt-2 text-gray-600">
          We’ll review it and write to <span className="font-medium text-gray-900">{sentTo}</span> about the beta. In the
          meantime, have a look at the <Link href="/features" className="text-blue-600">features</Link> or the{' '}
          <Link href="/faq" className="text-blue-600">FAQ</Link>.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" htmlFor="irName" error={fieldError('name')}>
          <input id="irName" required autoComplete="name" maxLength={120} value={form.name} onChange={set('name')} className={inputCls} />
        </Field>
        <Field label="Work email" htmlFor="irEmail" error={fieldError('email')}>
          <input id="irEmail" type="email" required autoComplete="email" maxLength={254} value={form.email} onChange={set('email')} className={inputCls} />
        </Field>
        <Field label="Company (optional)" htmlFor="irCompany">
          <input id="irCompany" autoComplete="organization" maxLength={160} value={form.company} onChange={set('company')} className={inputCls} />
        </Field>
        <Field label="Your role (optional)" htmlFor="irRole">
          <input id="irRole" autoComplete="organization-title" maxLength={120} placeholder="e.g. Product developer" value={form.role} onChange={set('role')} className={inputCls} />
        </Field>
        <Field label="What best describes you? (optional)" htmlFor="irType">
          <select id="irType" value={form.companyType} onChange={set('companyType')} className={inputCls}>
            <option value="">Choose one</option>
            {INVITE_COMPANY_TYPES.map(t => <option key={t} value={t}>{INVITE_COMPANY_TYPE_LABELS[t]}</option>)}
          </select>
        </Field>
        <Field label="Team size (optional)" htmlFor="irTeam">
          <select id="irTeam" value={form.teamSize} onChange={set('teamSize')} className={inputCls}>
            <option value="">Choose one</option>
            {INVITE_TEAM_SIZES.map(t => <option key={t} value={t}>{INVITE_TEAM_SIZE_LABELS[t]}</option>)}
          </select>
        </Field>
      </div>

      <Field label="What would you use Benchtop for? (optional)" htmlFor="irMessage" hint="The products you develop, and what slows you down today." error={fieldError('message')}>
        <textarea id="irMessage" rows={4} maxLength={INVITE_MESSAGE_MAX} value={form.message} onChange={set('message')} className={inputCls} />
      </Field>

      <Field label="How did you hear about us? (optional)" htmlFor="irReferral">
        <input id="irReferral" maxLength={200} value={form.referral} onChange={set('referral')} className={inputCls} />
      </Field>

      {/* Hidden from people; bots that fill every field give themselves away here */}
      <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="irWebsite">Website</label>
        <input id="irWebsite" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm text-gray-700">
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5" />
          <span>
            Benchtop may use these details to review my request and contact me about the beta, as described in the{' '}
            <Link href="/legal/privacy" target="_blank" className="text-blue-600">Privacy Policy</Link>.
          </span>
        </label>
        {fieldError('consent') && <p className="text-xs text-red-600 mt-1">{fieldError('consent')}</p>}
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      <button type="submit" disabled={sending} className={`${siteBtnPrimary} disabled:opacity-50`}>
        {sending ? 'Sending…' : 'Request my invite'}
      </button>
    </form>
  )
}
