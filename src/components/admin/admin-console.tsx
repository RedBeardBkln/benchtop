'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Search, ShieldCheck } from 'lucide-react'
import { readErrorMessage } from '@/lib/utils'
import { Card, formatDate } from '@/components/settings/ui'
import { planSummary, type PlanAccount } from './plan-editor'
import { ActivityFeed, formatWhen, timeAgo } from './activity-feed'
import type { AccountUsage } from '@/lib/admin-actions'

// Platform admin console: every account, every person, and the activity log

type AccountRow = PlanAccount & {
  ownerEmail: string | null
  subscriptionStatus: string | null
  cancelAtPeriodEnd: boolean
  suspendedAt: string | null
  createdAt: string
  usage: AccountUsage | null
}

type UserRow = {
  userId: string
  email: string | null
  fullName: string | null
  signedUpAt: string | null
  lastSignInAt: string | null
  lastSeenAt: string | null
  suspendedAt: string | null
  isPlatformAdmin: boolean
  account: { id: string; name: string; role: string; suspendedAt: string | null } | null
}

const TABS = [
  { key: 'accounts', label: 'Accounts' },
  { key: 'people', label: 'People' },
  { key: 'activity', label: 'Activity' },
] as const
type Tab = (typeof TABS)[number]['key']

const searchCls =
  'w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

export function Badge({ tone, children, tip }: { tone: 'red' | 'amber' | 'green' | 'gray' | 'purple'; children: React.ReactNode; tip?: string }) {
  const cls = {
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-800',
    green: 'bg-green-50 text-green-700',
    gray: 'bg-gray-100 text-gray-600',
    purple: 'bg-purple-50 text-purple-700',
  }[tone]
  return <span data-tip={tip} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>{children}</span>
}

export function SubscriptionBadge({ status, cancelAtPeriodEnd }: { status: string | null; cancelAtPeriodEnd: boolean }) {
  if (!status) return null
  const tone = status === 'active' || status === 'trialing' ? 'green' : status === 'past_due' ? 'amber' : 'gray'
  return (
    <Badge tone={cancelAtPeriodEnd ? 'amber' : tone} tip="The Stripe subscription’s status">
      Stripe: {status.replace('_', ' ')}{cancelAtPeriodEnd ? ', canceling' : ''}
    </Badge>
  )
}

function AccountsTab() {
  const [query, setQuery] = useState('')
  const { data, isLoading, isError } = useQuery<AccountRow[]>({
    queryKey: ['admin-accounts'],
    queryFn: async () => {
      const r = await fetch('/api/admin/accounts')
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not load accounts'))
      return r.json()
    },
  })

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>
  if (isError || !data) return <p className="text-sm text-red-600">Could not load accounts.</p>

  const q = query.trim().toLowerCase()
  const rows = data.filter(a => !q || a.name.toLowerCase().includes(q) || a.ownerEmail?.toLowerCase().includes(q))
  const totals = {
    accounts: data.length,
    people: data.reduce((n, a) => n + (a.usage?.members ?? 0), 0),
    active7d: data.filter(a => a.usage?.lastSeenAt && Date.now() - Date.parse(a.usage.lastSeenAt) < 7 * 864e5).length,
    paying: data.filter(a => a.subscriptionStatus === 'active' || a.subscriptionStatus === 'past_due').length,
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Accounts', totals.accounts, 'Every account that hasn’t been deleted'],
          ['People', totals.people, 'Owners, admins and members across all accounts'],
          ['Active this week', totals.active7d, 'Accounts where someone used the app in the last 7 days'],
          ['Paying', totals.paying, 'Accounts with an active (or past-due) Stripe subscription'],
        ].map(([label, value, tip]) => (
          <div key={label as string} className="rounded-lg border border-gray-200 bg-white p-4" data-tip={tip as string}>
            <div className="text-2xl font-semibold text-gray-900">{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search accounts or owner emails"
          aria-label="Search accounts" className={searchCls} />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Account</th>
              <th className="px-4 py-3 text-left font-medium">Plan</th>
              <th className="hidden md:table-cell px-4 py-3 text-right font-medium" data-tip="People in the account, including the owner">People</th>
              <th className="hidden md:table-cell px-4 py-3 text-right font-medium" data-tip="Projects / formulations">Work</th>
              <th className="hidden sm:table-cell px-4 py-3 text-left font-medium" data-tip="The last time anyone in the account used the app">Last active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(a => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/accounts/${a.id}`} className="font-medium text-gray-900 hover:text-blue-700 hover:underline">{a.name}</Link>
                  <div className="text-xs text-gray-500">{a.ownerEmail ?? 'No owner email'} · joined {formatDate(a.createdAt)}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {a.suspendedAt && <Badge tone="red" tip={`Suspended ${formatWhen(a.suspendedAt)}`}>Suspended</Badge>}
                    <SubscriptionBadge status={a.subscriptionStatus} cancelAtPeriodEnd={a.cancelAtPeriodEnd} />
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700">{planSummary(a)}</td>
                <td className="hidden md:table-cell px-4 py-3 text-right text-gray-700">{a.usage?.members ?? '—'}</td>
                <td className="hidden md:table-cell px-4 py-3 text-right text-gray-700">
                  {a.usage ? `${a.usage.projects} / ${a.usage.formulations}` : '—'}
                </td>
                <td className="hidden sm:table-cell px-4 py-3 text-gray-700">{timeAgo(a.usage?.lastSeenAt ?? null)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">No accounts match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function useSuspendUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, suspended, reason }: { userId: string; suspended: boolean; reason?: string }) => {
      const r = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspended, reason }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not change this person'))
    },
    onSuccess: (_d, v) => {
      toast.success(v.suspended ? 'Suspended' : 'Restored')
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-account'] })
      queryClient.invalidateQueries({ queryKey: ['admin-activity'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

function PeopleTab() {
  const [query, setQuery] = useState('')
  const suspend = useSuspendUser()
  const { data, isLoading, isError } = useQuery<{ users: UserRow[]; me: string }>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const r = await fetch('/api/admin/users')
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not load people'))
      return r.json()
    },
  })

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>
  if (isError || !data) return <p className="text-sm text-red-600">Could not load people.</p>

  const q = query.trim().toLowerCase()
  const rows = data.users.filter(u =>
    !q || u.email?.toLowerCase().includes(q) || u.fullName?.toLowerCase().includes(q) || u.account?.name.toLowerCase().includes(q))

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search people, emails or accounts"
          aria-label="Search people" className={searchCls} />
      </div>
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Person</th>
              <th className="px-4 py-3 text-left font-medium">Account</th>
              <th className="hidden sm:table-cell px-4 py-3 text-left font-medium" data-tip="The last time they used the app">Last active</th>
              <th className="hidden md:table-cell px-4 py-3 text-left font-medium" data-tip="The last time they signed in with their password or a link">Last sign-in</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(u => (
              <tr key={u.userId}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{u.fullName || u.email || u.userId}</div>
                  {u.fullName && <div className="text-xs text-gray-500">{u.email}</div>}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {u.isPlatformAdmin && <Badge tone="purple"><ShieldCheck size={11} /> Platform admin</Badge>}
                    {u.suspendedAt && <Badge tone="red" tip={`Suspended ${formatWhen(u.suspendedAt)}`}>Suspended</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {u.account ? (
                    <>
                      <Link href={`/admin/accounts/${u.account.id}`} className="text-gray-900 hover:text-blue-700 hover:underline">{u.account.name}</Link>
                      <div className="text-xs text-gray-500 capitalize">{u.account.role}{u.account.suspendedAt ? ' · account suspended' : ''}</div>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400" data-tip="This login isn’t linked to any account, so it can’t see anything">No account</span>
                  )}
                </td>
                <td className="hidden sm:table-cell px-4 py-3 text-gray-700">{timeAgo(u.lastSeenAt)}</td>
                <td className="hidden md:table-cell px-4 py-3 text-gray-700">{timeAgo(u.lastSignInAt)}</td>
                <td className="px-4 py-3 text-right">
                  {u.userId !== data.me && !u.isPlatformAdmin && (
                    <button
                      type="button"
                      disabled={suspend.isPending}
                      onClick={() => {
                        if (u.suspendedAt) return suspend.mutate({ userId: u.userId, suspended: false })
                        const reason = window.prompt(`Suspend ${u.email ?? 'this person'}? They won’t be able to use Benchtop until restored. Reason (optional, for the log):`)
                        if (reason !== null) suspend.mutate({ userId: u.userId, suspended: true, reason })
                      }}
                      data-tip={u.suspendedAt ? 'Let this person use Benchtop again' : 'Stop this person using Benchtop. Nothing is deleted.'}
                      className={`text-xs hover:underline ${u.suspendedAt ? 'text-blue-600' : 'text-red-600'}`}
                    >
                      {u.suspendedAt ? 'Restore' : 'Suspend'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">No people match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AdminConsole() {
  const router = useRouter()
  const params = useSearchParams()
  const tab: Tab = TABS.some(t => t.key === params.get('tab')) ? (params.get('tab') as Tab) : 'accounts'

  return (
    <div>
      <div className="flex gap-1 border-b border-gray-200 mb-5" role="tablist">
        {TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => router.replace(t.key === 'accounts' ? '/admin/accounts' : `/admin/accounts?tab=${t.key}`)}
            className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === t.key ? 'border-blue-600 text-blue-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'accounts' && <AccountsTab />}
      {tab === 'people' && <PeopleTab />}
      {tab === 'activity' && (
        <Card title="Activity" description="Every change people make in the app, and everything platform admins do, newest first.">
          <ActivityFeed />
        </Card>
      )}
    </div>
  )
}
