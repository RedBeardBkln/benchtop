'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { readErrorMessage } from '@/lib/utils'
import type { AccountUsage } from '@/lib/admin-actions'
import { btnDanger, btnSecondary, Card, Field, formatDate, inputCls, Notice } from '@/components/settings/ui'
import { EditPlan, planSummary, type PlanAccount } from './plan-editor'
import { ActivityFeed, formatWhen, timeAgo } from './activity-feed'
import { Badge, SubscriptionBadge, useSuspendUser } from './admin-console'

// Platform admin: one account in full, with every action an admin can take on it

type Member = {
  userId: string
  email: string | null
  fullName: string | null
  role: string
  createdAt: string
  lastSeenAt: string | null
  lastSignInAt: string | null
  suspendedAt: string | null
  isPlatformAdmin: boolean | null
}

type AccountDetail = PlanAccount & {
  stripeCustomerId: string | null
  suspendedAt: string | null
  suspendedReason: string | null
  createdAt: string
  isOwnAccount: boolean
  subscription: {
    status: string
    stripeSubscriptionId: string | null
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
    seatQuantity: number
    priceId: string | null
  } | null
  members: Member[]
  usage: AccountUsage | null
}

const LIVE = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused']

async function send(url: string, method: string, body?: unknown) {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!r.ok) throw new Error(await readErrorMessage(r, 'Something went wrong'))
  return r.json()
}

function Stat({ label, value, tip }: { label: string; value: React.ReactNode; tip?: string }) {
  return (
    <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2" data-tip={tip}>
      <div className="text-lg font-semibold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}

function UsageCard({ usage }: { usage: AccountUsage | null }) {
  if (!usage) return null
  return (
    <Card title="Usage">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="People" value={usage.members} tip="Owner, admins and members" />
        <Stat label="Projects" value={usage.projects} />
        <Stat label="Formulations" value={usage.formulations} tip="Every formulation and iteration" />
        <Stat label="Ingredients" value={usage.ingredients} />
        <Stat label="Suppliers" value={usage.suppliers} />
        <Stat label="Clients" value={usage.clients} />
        <Stat label="Documents" value={usage.documents} tip="Files attached to ingredients (spec sheets, certificates…)" />
        <Stat label="Time entries" value={usage.timeEntries} />
        <Stat label="Sous Chef chats" value={usage.sousChefConversations} tip="Conversations started with Sous Chef, ever" />
        <Stat label="Sous Chef questions (30 days)" value={usage.sousChefMessages30d} tip="Messages people sent Sous Chef in the last 30 days" />
        <Stat label="Changes (7 days)" value={usage.changes7d} tip="Changes made in the app in the last 7 days (logged since the activity log started)" />
        <Stat label="Changes (30 days)" value={usage.changes30d} />
      </div>
      <p className="mt-3 text-xs text-gray-500">Last active {timeAgo(usage.lastSeenAt).toLowerCase()}.</p>
    </Card>
  )
}

function PlanCard({ account, onChanged }: { account: AccountDetail; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const extend = useMutation({
    mutationFn: async (days: number) => {
      // Adds the days to whatever free time is left (or starts from today)
      const base = account.freeUntil && Date.parse(account.freeUntil) > Date.now() ? new Date(account.freeUntil) : new Date()
      const until = new Date(base.getTime() + days * 864e5)
      return send(`/api/admin/accounts/${account.id}`, 'PATCH', {
        plan: account.plan,
        freeUntil: until.toISOString(),
        maxUsers: account.maxUsers,
      })
    },
    onSuccess: (body: { warning: string | null }) => {
      toast.success('Free access extended')
      if (body.warning) toast.warning(body.warning, { duration: 12000 })
      onChanged()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Card title="Plan and free access" description="Change the account type, or give it more free time as a promotion.">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <div className="font-medium text-gray-900">{planSummary(account)}</div>
          <div className="text-xs text-gray-500">
            {account.freeAccess ? 'Has free access now' : 'No free access now'} · {account.additionalUsers} additional user
            {account.additionalUsers === 1 ? '' : 's'}
          </div>
        </div>
        {!account.billingExempt && !editing && (
          <button type="button" onClick={() => setEditing(true)} className={btnSecondary}
            data-tip="Change this account’s type, free period or user limit">
            Change plan
          </button>
        )}
      </div>

      {!account.billingExempt && account.plan !== 'free_lifetime' && !editing && (
        <div className="mt-4">
          <div className="text-xs font-medium text-gray-700 mb-1.5">Extend free access</div>
          <div className="flex flex-wrap gap-2">
            {[[14, '+2 weeks'], [30, '+1 month'], [90, '+3 months'], [365, '+1 year']].map(([days, label]) => (
              <button
                key={days}
                type="button"
                disabled={extend.isPending}
                onClick={() => extend.mutate(days as number)}
                data-tip={`Adds ${(label as string).slice(1)} to the free time left (or from today if it has run out). A running Stripe subscription isn’t charged again until then.`}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <div className="mt-4">
          <EditPlan account={account} onDone={() => { setEditing(false); onChanged() }} />
        </div>
      )}
    </Card>
  )
}

function SubscriptionCard({ account, onChanged }: { account: AccountDetail; onChanged: () => void }) {
  const sub = account.subscription
  const act = useMutation({
    mutationFn: (action: 'cancel_at_period_end' | 'resume' | 'cancel_now') =>
      send(`/api/admin/accounts/${account.id}/subscription`, 'POST', { action }),
    onSuccess: () => { toast.success('Subscription updated'); onChanged() },
    onError: (e: Error) => toast.error(e.message),
  })
  const live = Boolean(sub?.stripeSubscriptionId) && LIVE.includes(sub!.status)

  return (
    <Card title="Subscription" description="The account’s Stripe subscription. Payment details and refunds are handled in Stripe.">
      {!sub ? (
        <p className="text-sm text-gray-500">{account.billingExempt ? 'Internal account: never billed.' : 'No subscription.'}</p>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <div><span className="text-gray-500">Status:</span> <SubscriptionBadge status={sub.status} cancelAtPeriodEnd={sub.cancelAtPeriodEnd} /></div>
            {sub.currentPeriodEnd && (
              <div>
                <span className="text-gray-500">{sub.cancelAtPeriodEnd ? 'Ends' : sub.status === 'trialing' ? 'First charge' : 'Renews'}:</span>{' '}
                {formatDate(sub.currentPeriodEnd)}
              </div>
            )}
            <div><span className="text-gray-500">Extra seats:</span> {sub.seatQuantity}</div>
          </div>
          {account.stripeCustomerId && (
            <a href={`https://dashboard.stripe.com/customers/${account.stripeCustomerId}`} target="_blank" rel="noreferrer"
              className="text-xs text-blue-600 hover:underline">
              Open in Stripe ↗
            </a>
          )}
          {live && (
            <div className="flex flex-wrap gap-2 pt-1">
              {sub.cancelAtPeriodEnd ? (
                <button type="button" className={btnSecondary} disabled={act.isPending} onClick={() => act.mutate('resume')}
                  data-tip="Keeps the subscription going after the current period">
                  Undo cancellation
                </button>
              ) : (
                <button type="button" className={btnSecondary} disabled={act.isPending}
                  onClick={() => window.confirm('Cancel at the end of the current period? The account keeps access until then.') && act.mutate('cancel_at_period_end')}
                  data-tip="Stops billing after the current period; access continues until then">
                  Cancel at period end
                </button>
              )}
              <button type="button" className={btnDanger} disabled={act.isPending}
                onClick={() => window.confirm('Cancel the subscription right now? Billing stops immediately with no refund, and the account loses access unless it has free time.') && act.mutate('cancel_now')}
                data-tip="Ends the subscription immediately, with no refund">
                Cancel now
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function PeopleCard({ account, onChanged }: { account: AccountDetail; onChanged: () => void }) {
  const suspend = useSuspendUser()
  const remove = useMutation({
    mutationFn: (userId: string) => send(`/api/admin/users/${userId}`, 'DELETE'),
    onSuccess: () => { toast.success('Removed from the account'); onChanged() },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Card title="People">
      <ul className="divide-y divide-gray-100">
        {account.members.map(m => (
          <li key={m.userId} className="py-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 text-sm">
              <div className="font-medium text-gray-900">{m.fullName || m.email || m.userId}</div>
              <div className="text-xs text-gray-500">
                {m.fullName && <>{m.email} · </>}
                <span className="capitalize">{m.role}</span> · joined {formatDate(m.createdAt)}
              </div>
              <div className="text-xs text-gray-500">
                Last active {timeAgo(m.lastSeenAt).toLowerCase()} · last sign-in {timeAgo(m.lastSignInAt).toLowerCase()}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {m.isPlatformAdmin && <Badge tone="purple"><ShieldCheck size={11} /> Platform admin</Badge>}
                {m.suspendedAt && <Badge tone="red" tip={`Suspended ${formatWhen(m.suspendedAt)}`}>Suspended</Badge>}
              </div>
            </div>
            {!m.isPlatformAdmin && (
              <div className="flex gap-3 text-xs">
                <button
                  type="button"
                  disabled={suspend.isPending}
                  onClick={() => {
                    if (m.suspendedAt) return suspend.mutate({ userId: m.userId, suspended: false }, { onSuccess: onChanged })
                    const reason = window.prompt(`Suspend ${m.email ?? 'this person'}? They won’t be able to use Benchtop until restored. Reason (optional, for the log):`)
                    if (reason !== null) suspend.mutate({ userId: m.userId, suspended: true, reason }, { onSuccess: onChanged })
                  }}
                  className={m.suspendedAt ? 'text-blue-600 hover:underline' : 'text-red-600 hover:underline'}
                  data-tip={m.suspendedAt ? 'Let this person use Benchtop again' : 'Stop this person using Benchtop. Nothing is deleted.'}
                >
                  {m.suspendedAt ? 'Restore' : 'Suspend'}
                </button>
                {m.role !== 'owner' && (
                  <button
                    type="button"
                    disabled={remove.isPending}
                    onClick={() => window.confirm(`Remove ${m.email ?? 'this person'} from ${account.name}? Their login is deleted; their work stays in the account.`) && remove.mutate(m.userId)}
                    className="text-red-600 hover:underline"
                    data-tip="Removes them from the account and deletes their login. Their work stays."
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

function DangerCard({ account, onChanged }: { account: AccountDetail; onChanged: () => void }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const [confirmName, setConfirmName] = useState('')

  const suspend = useMutation({
    mutationFn: (suspended: boolean) => send(`/api/admin/accounts/${account.id}/suspend`, 'POST', { suspended, reason: reason.trim() || undefined }),
    onSuccess: (_d, suspended) => { toast.success(suspended ? 'Account suspended' : 'Account restored'); setReason(''); onChanged() },
    onError: (e: Error) => toast.error(e.message),
  })
  const del = useMutation({
    mutationFn: () => send(`/api/admin/accounts/${account.id}`, 'DELETE', { confirmName }),
    onSuccess: (body: { loginsRemoved: boolean }) => {
      toast.success(`${account.name} deleted`)
      if (!body.loginsRemoved) toast.warning('Some logins could not be removed. They have no access, but you may want to delete them in Supabase.')
      queryClient.invalidateQueries({ queryKey: ['admin-accounts'] })
      router.push('/admin/accounts')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (account.isOwnAccount || account.billingExempt) {
    return (
      <Card title="Suspend or delete" tone="danger">
        <p className="text-sm text-gray-500">
          {account.isOwnAccount ? 'This is your own account, so it can’t be suspended or deleted here.' : 'Internal accounts can’t be suspended or deleted here.'}
        </p>
      </Card>
    )
  }

  return (
    <Card title="Suspend or delete" tone="danger">
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-900">{account.suspendedAt ? 'Restore the account' : 'Suspend the account'}</h3>
          {account.suspendedAt ? (
            <>
              <p className="text-sm text-gray-600">
                Suspended {formatWhen(account.suspendedAt)}{account.suspendedReason ? `: ${account.suspendedReason}` : ''}. Nobody in it can use Benchtop.
              </p>
              <button type="button" className={btnSecondary} disabled={suspend.isPending} onClick={() => suspend.mutate(false)}>
                Restore access
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Nobody in the account can use Benchtop until you restore it. Nothing is deleted, and billing isn’t touched:
                cancel the subscription above too if it shouldn’t keep charging.
              </p>
              <Field label="Reason (optional, for the log)" htmlFor="suspend-reason">
                <input id="suspend-reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={500} className={inputCls} />
              </Field>
              <button type="button" className={btnDanger} disabled={suspend.isPending}
                onClick={() => window.confirm(`Suspend ${account.name}?`) && suspend.mutate(true)}>
                Suspend account
              </button>
            </>
          )}
        </div>

        <div className="space-y-2 border-t border-red-100 pt-5">
          <h3 className="text-sm font-medium text-gray-900">Delete the account</h3>
          <Notice tone="error">
            Permanently deletes {account.name}: every project, formulation, ingredient, supplier, client, document and
            login in it, and cancels its subscription. This can’t be undone.
          </Notice>
          <Field label={`Type “${account.name}” to confirm`} htmlFor="delete-confirm">
            <input id="delete-confirm" value={confirmName} onChange={e => setConfirmName(e.target.value)} autoComplete="off" className={inputCls} />
          </Field>
          <button type="button" className={btnDanger} disabled={confirmName.trim() !== account.name.trim() || del.isPending} onClick={() => del.mutate()}>
            {del.isPending ? 'Deleting…' : 'Delete account permanently'}
          </button>
        </div>
      </div>
    </Card>
  )
}

export function AccountAdminDetail({ id }: { id: string }) {
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useQuery<AccountDetail>({
    queryKey: ['admin-account', id],
    queryFn: async () => {
      const r = await fetch(`/api/admin/accounts/${id}`)
      if (!r.ok) throw new Error('Not found')
      return r.json()
    },
  })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-account', id] })
    queryClient.invalidateQueries({ queryKey: ['admin-accounts'] })
    queryClient.invalidateQueries({ queryKey: ['admin-activity'] })
  }

  return (
    <div className="px-4 py-5 sm:px-8 sm:py-8 max-w-4xl">
      <Link href="/admin/accounts" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft size={14} /> Accounts
      </Link>
      {isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : isError || !data ? (
        <p className="text-sm text-red-500">Account not found.</p>
      ) : (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{data.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
              <span>Created {formatDate(data.createdAt)}</span>
              {data.suspendedAt && <Badge tone="red">Suspended</Badge>}
              {data.billingExempt && <Badge tone="gray">Internal</Badge>}
              {data.isOwnAccount && <Badge tone="purple">Your account</Badge>}
            </div>
          </div>
          {data.suspendedAt && (
            <Notice tone="error">
              Suspended {formatWhen(data.suspendedAt)}{data.suspendedReason ? `: ${data.suspendedReason}` : ''}. Restore it at the bottom of the page.
            </Notice>
          )}
          <UsageCard usage={data.usage} />
          <PlanCard account={data} onChanged={refresh} />
          <SubscriptionCard account={data} onChanged={refresh} />
          <PeopleCard account={data} onChanged={refresh} />
          <Card title="Activity" description="Changes made in this account, and platform admin actions on it.">
            <ActivityFeed accountId={data.id} showAccount={false} />
          </Card>
          <DangerCard account={data} onChanged={refresh} />
        </div>
      )}
    </div>
  )
}
