'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Copy } from 'lucide-react'
import { readErrorMessage } from '@/lib/utils'
import { btnPrimary, btnSecondary, Card, Field, formatDate, inputCls, Notice } from '@/components/settings/ui'
import {
  ACCOUNT_PLANS, describePlan, MAX_FREE_PERIOD_DAYS, MAX_USER_CAP, MIN_FREE_PERIOD_DAYS, PAID_TRIAL_DAYS, PLAN_LABELS, type AccountPlan,
} from '@/lib/billing/plans'
import { Term } from '@/components/term'

const PLAN_HINTS: Record<AccountPlan, string> = {
  paid: `Starts with a ${PAID_TRIAL_DAYS}-day free trial, then needs a subscription.`,
  free_lifetime: 'Never needs a subscription. Team members are free too.',
  free_period: `Free for the number of days you choose (more than ${PAID_TRIAL_DAYS}), counted from signup. Then needs a subscription.`,
}

const FREE_PERIOD_PRESETS = [
  { days: 90, label: '3 months' },
  { days: 180, label: '6 months' },
  { days: 365, label: '1 year' },
  { days: 730, label: '2 years' },
]

type Invite = {
  id: string
  email: string
  note: string | null
  plan: AccountPlan
  freeDays: number | null
  maxUsers: number | null
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  createdAt: string
  expiresAt: string
  acceptedAt: string | null
}

const STATUS_CLS: Record<Invite['status'], string> = {
  pending: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  expired: 'bg-gray-100 text-gray-600',
  revoked: 'bg-red-100 text-red-700',
}

export function InvitationsAdmin() {
  const [invites, setInvites] = useState<Invite[] | null>(null)
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [days, setDays] = useState('7')
  const [plan, setPlan] = useState<AccountPlan>('paid')
  const [freeDays, setFreeDays] = useState('365')
  const [maxUsers, setMaxUsers] = useState('')
  const [creating, setCreating] = useState(false)
  const [link, setLink] = useState<{ email: string; url: string; plan: string } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/invitations')
    if (!res.ok) return toast.error(await readErrorMessage(res, 'Could not load invitations'))
    setInvites(await res.json())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setLink(null)
    const res = await fetch('/api/admin/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        note: note || undefined,
        expiresInDays: Number(days) || undefined,
        plan,
        freeDays: plan === 'free_period' ? Number(freeDays) : undefined,
        maxUsers: plan === 'free_lifetime' && maxUsers.trim() !== '' ? Number(maxUsers) : null,
      }),
    })
    setCreating(false)
    if (!res.ok) return toast.error(await readErrorMessage(res, 'Could not create the invitation'))
    const body = await res.json()
    setLink({ email: body.email, url: body.url, plan: describePlan(plan, Number(freeDays)).toLowerCase() })
    setEmail('')
    setNote('')
    setPlan('paid')
    setMaxUsers('')
    load()
  }

  async function revoke(id: string) {
    if (!window.confirm('Revoke this invitation? The link will stop working.')) return
    const res = await fetch(`/api/admin/invitations/${id}`, { method: 'DELETE' })
    if (!res.ok) return toast.error(await readErrorMessage(res, 'Could not revoke the invitation'))
    toast.success('Invitation revoked')
    load()
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy; select the link and copy it manually')
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Invite someone">
        <form onSubmit={create} className="space-y-3 max-w-lg">
          <Field label="Email" htmlFor="inviteEmail">
            <input id="inviteEmail" type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Note (optional, only visible to admins)" htmlFor="inviteNote">
            <input id="inviteNote" maxLength={500} value={note} onChange={e => setNote(e.target.value)} className={inputCls} />
          </Field>
          <fieldset className="space-y-2">
            <legend className="block text-sm font-medium text-gray-700 mb-1">Account type</legend>
            {ACCOUNT_PLANS.map(p => (
              <label key={p} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="invitePlan"
                  value={p}
                  checked={plan === p}
                  onChange={() => setPlan(p)}
                  className="mt-1"
                />
                <span>
                  <span className="text-gray-900">{PLAN_LABELS[p]}</span>
                  <span className="block text-xs text-gray-500">{PLAN_HINTS[p]}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {plan === 'free_period' && (
            <Field label="Free for (days from signup)" htmlFor="inviteFreeDays">
              <input
                id="inviteFreeDays"
                type="number"
                required
                min={MIN_FREE_PERIOD_DAYS}
                max={MAX_FREE_PERIOD_DAYS}
                value={freeDays}
                onChange={e => setFreeDays(e.target.value)}
                className={inputCls}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {FREE_PERIOD_PRESETS.map(p => (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => setFreeDays(String(p.days))}
                    data-tip={`Free for ${p.days} days from signup`}
                    className={`rounded-full border px-2.5 py-0.5 text-xs ${
                      Number(freeDays) === p.days ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </Field>
          )}
          {plan === 'free_lifetime' && (
            <Field
              label="Most additional users (optional)"
              htmlFor="inviteMaxUsers"
              hint="Team members they can add besides themselves. Leave empty for no limit. You can change it later."
            >
              <input
                id="inviteMaxUsers"
                type="number"
                min={0}
                max={MAX_USER_CAP}
                value={maxUsers}
                onChange={e => setMaxUsers(e.target.value)}
                className={inputCls}
              />
            </Field>
          )}
          <Field label="Invitation link expires in (days)" htmlFor="inviteDays">
            <input id="inviteDays" type="number" min={1} max={60} value={days} onChange={e => setDays(e.target.value)} className={inputCls}
              data-tip="How long the sign-up link works, from 1 to 60 days" />
          </Field>
          <button type="submit" disabled={creating} className={btnPrimary}
            data-tip="Creates a one-time sign-up link for a new account of this type. Nothing is emailed: copy the link and send it.">
            {creating ? 'Creating…' : 'Create invitation'}
          </button>
        </form>

        {link && (
          <div className="mt-4 space-y-2">
            <Notice tone="success">
              Invitation created for {link.email} ({link.plan}). This link is shown only once, so copy it now and send it to them.
            </Notice>
            <div className="flex gap-2">
              <input readOnly value={link.url} onFocus={e => e.currentTarget.select()} className={`${inputCls} font-mono text-xs`} />
              <button type="button" onClick={() => copy(link.url)} className={btnSecondary}
                data-tip="Copies the link. It’s shown only once.">
                <Copy size={14} className="mr-2" />
                Copy
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card title="All invitations">
        {invites === null ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : invites.length === 0 ? (
          <p className="text-sm text-gray-500">No invitations yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Account type</th>
                  <th className="py-2 pr-4 font-medium">
                    <Term tip="pending: not used yet. accepted: the account was created. expired: the link ran out. revoked: canceled.">Status</Term>
                  </th>
                  <th className="py-2 pr-4 font-medium">Created</th>
                  <th className="py-2 pr-4 font-medium"><Term tip="When the sign-up link stops working">Expires</Term></th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {invites.map(i => (
                  <tr key={i.id} className="border-b border-gray-100">
                    <td className="py-2 pr-4">
                      <div className="text-gray-900">{i.email}</div>
                      {i.note && <div className="text-xs text-gray-500">{i.note}</div>}
                    </td>
                    <td className="py-2 pr-4 text-gray-700">
                      {i.plan === 'free_period'
                        ? `Free for ${i.freeDays} days`
                        : i.plan === 'free_lifetime' && i.maxUsers != null
                          ? `Free for life, up to ${i.maxUsers} users`
                          : PLAN_LABELS[i.plan]}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLS[i.status]}`}>
                        {i.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">{formatDate(i.createdAt)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{formatDate(i.expiresAt)}</td>
                    <td className="py-2 text-right">
                      {i.status === 'pending' && (
                        <button onClick={() => revoke(i.id)} className="text-xs text-red-600 hover:underline"
                          data-tip="Cancels this invitation after you confirm. The link stops working.">
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
