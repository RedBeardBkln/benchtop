'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Bug, Lightbulb, Mail, Phone } from 'lucide-react'
import { FEEDBACK_KIND_LABELS, type FeedbackKind } from '@/lib/feedback'
import { readErrorMessage } from '@/lib/utils'
import { btnSecondary, Card, Notice } from '@/components/settings/ui'
import { UNREAD_FEEDBACK_KEY } from '@/components/admin/unread-feedback'
import { Term } from '@/components/term'

type FeedbackRow = {
  id: string
  kind: FeedbackKind
  message: string
  contactName: string
  contactEmail: string
  contactPhone: string | null
  wantsContact: boolean
  pagePath: string | null
  userAgent: string | null
  readAt: string | null
  resolvedAt: string | null
  createdAt: string
  accountName: string
}

const FILTERS = [
  { key: 'open', label: 'Open', tip: 'Show feedback not yet marked resolved' },
  { key: 'resolved', label: 'Resolved', tip: 'Show feedback marked resolved' },
  { key: 'all', label: 'All', tip: 'Show all feedback' },
] as const
type Filter = (typeof FILTERS)[number]['key']

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

export function FeedbackAdmin() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Filter>('open')

  const { data, isLoading, error } = useQuery<FeedbackRow[]>({
    queryKey: ['admin-feedback'],
    queryFn: async () => {
      const r = await fetch('/api/admin/feedback')
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not load feedback'))
      return r.json()
    },
  })

  // Opening the page reads everything; what was unread keeps a "New" tag until the page is left
  const [newIds, setNewIds] = useState<Set<string> | null>(null)
  useEffect(() => {
    if (!data || newIds) return
    const unread = new Set(data.filter(f => !f.readAt).map(f => f.id))
    setNewIds(unread)
    if (unread.size === 0) return
    fetch('/api/admin/feedback/read', { method: 'POST' })
      .then(r => { if (r.ok) queryClient.invalidateQueries({ queryKey: UNREAD_FEEDBACK_KEY }) })
      .catch(() => {})
  }, [data, newIds, queryClient])

  const setResolved = useMutation({
    mutationFn: async ({ id, resolved }: { id: string; resolved: boolean }) => {
      const r = await fetch(`/api/admin/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not update feedback'))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-feedback'] }),
    onError: (e: Error) => toast.error(e.message),
  })

  const rows = (data ?? []).filter(f =>
    filter === 'all' ? true : filter === 'open' ? !f.resolvedAt : !!f.resolvedAt)
  const openCount = (data ?? []).filter(f => !f.resolvedAt).length

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {FILTERS.map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            data-tip={f.tip}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              filter === f.key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {f.label}{f.key === 'open' && openCount > 0 && ` (${openCount})`}
          </button>
        ))}
      </div>

      {error && <Notice tone="error">{(error as Error).message}</Notice>}
      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {data && rows.length === 0 && (
        <p className="text-sm text-gray-500">{filter === 'open' ? 'Nothing open.' : 'No feedback yet.'}</p>
      )}

      {rows.map(f => {
        const Icon = f.kind === 'bug' ? Bug : Lightbulb
        return (
          <Card key={f.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Icon size={16} className={f.kind === 'bug' ? 'text-red-500' : 'text-amber-500'} />
                <span className="font-medium text-gray-900">{FEEDBACK_KIND_LABELS[f.kind] ?? f.kind}</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-500">{formatWhen(f.createdAt)}</span>
                {newIds?.has(f.id) && (
                  <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[11px] font-semibold">
                    <Term tip="Unread when you opened this page. It’s now marked read; the tag goes when you leave.">New</Term>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setResolved.mutate({ id: f.id, resolved: !f.resolvedAt })}
                disabled={setResolved.isPending}
                data-tip={f.resolvedAt ? 'Moves this back to Open' : 'Marks this dealt with and moves it to Resolved'}
                className={`${btnSecondary} !py-1 !px-3 !text-xs`}
              >
                {f.resolvedAt ? 'Reopen' : 'Mark resolved'}
              </button>
            </div>

            <p className="mt-3 text-sm text-gray-800 whitespace-pre-wrap break-words">{f.message}</p>

            <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
              <span className="text-gray-700 font-medium">{f.contactName}</span>
              <span>{f.accountName}</span>
              <a href={`mailto:${f.contactEmail}`} data-tip="Start an email to this person" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                <Mail size={12} /> {f.contactEmail}
              </a>
              {f.contactPhone && (
                <a href={`tel:${f.contactPhone}`} className="inline-flex items-center gap-1 hover:text-gray-700">
                  <Phone size={12} /> {f.contactPhone}
                </a>
              )}
              <span className={f.wantsContact ? 'text-green-700 font-medium' : ''}>
                {f.wantsContact ? 'Wants to be contacted' : 'No contact requested'}
              </span>
            </div>
            {(f.pagePath || f.userAgent) && (
              <div className="mt-1 text-xs text-gray-400 break-all">
                {f.pagePath && <span className="font-mono">{f.pagePath}</span>}
                {f.pagePath && f.userAgent && ' · '}
                {f.userAgent}
              </div>
            )}
            {f.resolvedAt && <div className="mt-1 text-xs text-gray-400">Resolved {formatWhen(f.resolvedAt)}</div>}
          </Card>
        )
      })}
    </div>
  )
}
