'use client'

import Link from 'next/link'
import { useInfiniteQuery } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { btnSecondary } from '@/components/settings/ui'

// Platform admin: the activity log (what people changed, and what platform admins did), newest first

export type ActivityItem = {
  id: string
  kind: 'user' | 'admin'
  at: string
  accountId: string | null
  accountName: string | null
  userId: string
  email: string | null
  description: string
  recordName: string | null
  href: string | null
  path: string | null
}

export const formatWhen = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—'

export function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 2) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days < 60) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ActivityFeed({ accountId, userId, showAccount = true }: { accountId?: string; userId?: string; showAccount?: boolean }) {
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['admin-activity', accountId ?? null, userId ?? null],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const qs = new URLSearchParams({ limit: '100' })
      if (accountId) qs.set('accountId', accountId)
      if (userId) qs.set('userId', userId)
      if (pageParam) qs.set('before', pageParam)
      const r = await fetch(`/api/admin/activity?${qs}`)
      if (!r.ok) throw new Error('Could not load activity')
      return (await r.json()) as { items: ActivityItem[]; nextBefore: string | null }
    },
    getNextPageParam: last => last.nextBefore,
  })

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>
  if (isError) return <p className="text-sm text-red-600">Could not load activity.</p>
  const items = data?.pages.flatMap(p => p.items) ?? []
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">No activity recorded yet. Changes people make are logged from now on.</p>
  }

  return (
    <div>
      <ul className="divide-y divide-gray-100">
        {items.map(i => (
          <li key={`${i.kind}-${i.id}`} className="py-2.5 flex items-start gap-3 text-sm">
            <span className="w-36 shrink-0 text-xs text-gray-500 pt-0.5">{formatWhen(i.at)}</span>
            <div className="min-w-0 flex-1">
              <div className="text-gray-900">
                {i.kind === 'admin' && (
                  <span data-tip="Done by a platform admin" className="mr-1.5 inline-flex items-center gap-1 rounded bg-purple-50 px-1.5 py-0.5 text-xs font-medium text-purple-700">
                    <ShieldCheck size={11} /> Admin
                  </span>
                )}
                {i.description}
                {i.recordName && (
                  <>
                    {' · '}
                    {i.href ? <Link href={i.href} className="text-blue-600 hover:underline">{i.recordName}</Link> : i.recordName}
                  </>
                )}
              </div>
              <div className="text-xs text-gray-500 truncate" data-tip={i.path ?? undefined}>
                {i.email ?? 'Unknown person'}
                {showAccount && i.accountName && (
                  <>
                    {' · '}
                    {i.accountId ? <Link href={`/admin/accounts/${i.accountId}`} className="hover:underline">{i.accountName}</Link> : i.accountName}
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {hasNextPage && (
        <button type="button" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className={`${btnSecondary} mt-3`}>
          {isFetchingNextPage ? 'Loading…' : 'Show older'}
        </button>
      )}
    </div>
  )
}
