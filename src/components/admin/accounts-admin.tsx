'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { readErrorMessage } from '@/lib/utils'
import { btnPrimary, btnSecondary, Card, Field, formatDate, inputCls, Notice } from '@/components/settings/ui'
import { ACCOUNT_PLANS, MAX_USER_CAP, PLAN_LABELS, type AccountPlan } from '@/lib/billing/plans'

type Account = {
  id: string
  name: string
  ownerEmail: string | null
  billingExempt: boolean
  plan: AccountPlan
  freeUntil: string | null
  freeAccess: boolean
  maxUsers: number | null
  additionalUsers: number
  subscriptionStatus: string | null
  createdAt: string
}

const DAY_MS = 24 * 60 * 60 * 1000

const PLAN_TIPS: Record<AccountPlan, string> = {
  paid: 'Needs a subscription once any free trial ends.',
  free_lifetime: 'Never needs a subscription. You can cap how many extra users it has.',
  free_period: 'Free until the date you set, then needs a subscription.',
}

// <input type="date"> value (local date) <-> ISO timestamp at the end of that day
function toDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fromDateInput(value: string): string | null {
  return value ? new Date(`${value}T23:59:59`).toISOString() : null
}
function daysFromToday(days: number): string {
  return toDateInput(new Date(Date.now() + days * DAY_MS).toISOString())
}

function planSummary(a: Account): string {
  if (a.billingExempt) return 'Internal (billing exempt)'
  if (a.plan === 'free_lifetime') return a.maxUsers == null ? 'Free for life' : `Free for life, up to ${a.maxUsers} users`
  if (a.plan === 'free_period') {
    return a.freeUntil ? `Free ${a.freeAccess ? 'until' : 'ended'} ${formatDate(a.freeUntil)}` : 'Free period'
  }
  if (a.freeUntil && a.freeAccess) return `Paid, trial until ${formatDate(a.freeUntil)}`
  return 'Paid'
}

function EditPlan({ account, onDone }: { account: Account; onDone: () => void }) {
  const [plan, setPlan] = useState<AccountPlan>(account.plan)
  const [until, setUntil] = useState(toDateInput(account.freeUntil))
  const [cap, setCap] = useState(account.maxUsers == null ? '' : String(account.maxUsers))
  const [saving, setSaving] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch(`/api/admin/accounts/${account.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan,
        freeUntil: plan === 'free_lifetime' ? null : fromDateInput(until),
        maxUsers: plan === 'free_lifetime' && cap.trim() !== '' ? Number(cap) : null,
      }),
    })
    setSaving(false)
    if (!res.ok) return toast.error(await readErrorMessage(res, 'Could not change the plan'))
    const body = await res.json()
    toast.success(`Updated ${account.name}`)
    if (body.warning) toast.warning(body.warning, { duration: 12000 })
    onDone()
  }

  const presets = [
    { days: 90, label: '+3 months' },
    { days: 180, label: '+6 months' },
    { days: 365, label: '+1 year' },
  ]

  return (
    <form onSubmit={save} className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4">
      <fieldset className="space-y-1">
        <legend className="block text-sm font-medium text-gray-700 mb-1">Account type</legend>
        {ACCOUNT_PLANS.map(p => (
          <label key={p} className="flex items-center gap-2 text-sm text-gray-900" data-tip={PLAN_TIPS[p]}>
            <input type="radio" name={`plan-${account.id}`} checked={plan === p} onChange={() => setPlan(p)} />
            {PLAN_LABELS[p]}
          </label>
        ))}
      </fieldset>

      {plan !== 'free_lifetime' && (
        <Field
          label={plan === 'free_period' ? 'Free until' : 'Free trial ends (optional)'}
          htmlFor={`until-${account.id}`}
          hint={plan === 'paid' ? 'Leave empty to require a subscription now.' : undefined}
        >
          <input
            id={`until-${account.id}`}
            type="date"
            required={plan === 'free_period'}
            min={daysFromToday(1)}
            value={until}
            onChange={e => setUntil(e.target.value)}
            className={inputCls}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {presets.map(p => (
              <button
                key={p.days}
                type="button"
                onClick={() => setUntil(daysFromToday(p.days))}
                data-tip={`Sets the date ${p.label.slice(1)} from today`}
                className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
              >
                {p.label}
              </button>
            ))}
            {plan === 'paid' && until && (
              <button type="button" onClick={() => setUntil('')} className="text-xs text-gray-500 hover:underline"
                data-tip="Clears the trial, so the account needs a subscription now">
                No trial
              </button>
            )}
          </div>
        </Field>
      )}

      {plan === 'free_lifetime' && (
        <Field
          label="Most additional users (optional)"
          htmlFor={`cap-${account.id}`}
          hint={`Users besides the owner. Leave empty for no limit. It has ${account.additionalUsers} now.`}
        >
          <input
            id={`cap-${account.id}`}
            type="number"
            min={0}
            max={MAX_USER_CAP}
            value={cap}
            onChange={e => setCap(e.target.value)}
            className={inputCls}
          />
        </Field>
      )}

      {plan === 'free_lifetime' && cap.trim() !== '' && Number(cap) < account.additionalUsers && (
        <Notice tone="warning">
          This account already has {account.additionalUsers} additional users. Nobody is removed, but it can&apos;t invite
          anyone else until it is under the limit.
        </Notice>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={btnPrimary} data-tip="Applies the new account type straight away">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onDone} className={btnSecondary}>Cancel</button>
      </div>
    </form>
  )
}

export function AccountsAdmin() {
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [editing, setEditing] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/accounts')
    if (!res.ok) return toast.error(await readErrorMessage(res, 'Could not load accounts'))
    setAccounts(await res.json())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Card title="Accounts" description="Change an account's type after signup.">
      {accounts === null ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-gray-500">No accounts yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {accounts.map(a => (
            <li key={a.id} className="py-3 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">{a.name}</div>
                  <div className="text-xs text-gray-500">
                    {a.ownerEmail ?? 'No owner email'} · joined {formatDate(a.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-right">
                    <div className="text-gray-900">{planSummary(a)}</div>
                    <div className="text-xs text-gray-500">
                      {a.additionalUsers} additional user{a.additionalUsers === 1 ? '' : 's'}
                      {a.subscriptionStatus ? ` · Stripe: ${a.subscriptionStatus}` : ''}
                    </div>
                  </div>
                  {!a.billingExempt && editing !== a.id && (
                    <button onClick={() => setEditing(a.id)} className="text-xs text-blue-600 hover:underline"
                      data-tip="Change this account’s type, free period or user limit">
                      Change
                    </button>
                  )}
                </div>
              </div>
              {editing === a.id && (
                <EditPlan
                  account={a}
                  onDone={() => {
                    setEditing(null)
                    load()
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
