'use client'

import Link from 'next/link'
import { useInfiniteQuery } from '@tanstack/react-query'
import { btnSecondary } from '@/components/settings/ui'
import { EXPORT_CATEGORIES, FORMAT_LABEL, type AnyFormat, type ExportCategory } from '@/lib/export/model'
import type { DataExportItem } from '@/app/api/admin/exports/route'
import { formatWhen } from './activity-feed'

// Platform admin: the account data export log (Settings → Your data), newest first

// An export still 'started' after the 5-minute server limit (and a little slack) was stopped by the platform
const STALLED_MS = 6 * 60 * 1000

const sizeText = (bytes: number | null) =>
  bytes == null ? null : bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

/** "Projects and clients: Excel · Formulations: Skip · …", in the dialog's order */
function choicesText(choices: Record<string, string> | null): string | null {
  if (!choices) return null
  return (Object.keys(EXPORT_CATEGORIES) as ExportCategory[])
    .filter(k => choices[k])
    .map(k => `${EXPORT_CATEGORIES[k].label}: ${FORMAT_LABEL[choices[k] as AnyFormat] ?? choices[k]}`)
    .join(' · ')
}

function detailText(i: DataExportItem): string {
  const s = i.summary
  const parts = [
    sizeText(i.bytes),
    i.kind === 'files' && s.dataFiles != null ? `${s.dataFiles} data file${s.dataFiles === 1 ? '' : 's'}` : null,
    s.panels ? `${s.panels} panel${s.panels === 1 ? '' : 's'}` : null,
    s.documents ? `${s.documents} document${s.documents === 1 ? '' : 's'}` : null,
    s.documentsLeftOut ? `${s.documentsLeftOut} left out for size` : null,
    s.documentsUnreadable ? `${s.documentsUnreadable} unreadable` : null,
    i.durationMs != null ? `took ${Math.max(1, Math.round(i.durationMs / 1000))} s` : null,
  ]
  return parts.filter(Boolean).join(' · ')
}

export function ExportLog({ accountId, showAccount = true }: { accountId?: string; showAccount?: boolean }) {
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['admin-exports', accountId ?? null],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const qs = new URLSearchParams({ limit: '100' })
      if (accountId) qs.set('accountId', accountId)
      if (pageParam) qs.set('before', pageParam)
      const r = await fetch(`/api/admin/exports?${qs}`)
      if (!r.ok) throw new Error('Could not load exports')
      return (await r.json()) as { items: DataExportItem[]; nextBefore: string | null }
    },
    getNextPageParam: last => last.nextBefore,
  })

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>
  if (isError) return <p className="text-sm text-red-600">Could not load the export log.</p>
  const items = data?.pages.flatMap(p => p.items) ?? []
  if (items.length === 0) return <p className="text-sm text-gray-500">No data exports yet.</p>

  return (
    <div>
      <ul className="divide-y divide-gray-100">
        {items.map(i => (
          <li key={i.id} className="py-2.5 flex items-start gap-3 text-sm">
            <span className="w-36 shrink-0 text-xs text-gray-500 pt-0.5">{formatWhen(i.at)}</span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="text-gray-900">
                {i.status === 'failed' && (
                  <span className="mr-1.5 inline-flex items-center rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700"
                    data-tip="The export stopped with an error; nothing was downloaded">
                    Failed
                  </span>
                )}
                {i.status === 'started' && (Date.now() - new Date(i.at).getTime() > STALLED_MS ? (
                  <span className="mr-1.5 inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800"
                    data-tip="The export began but never reported back, most likely stopped at the 5-minute server time limit; nothing was downloaded">
                    Didn’t finish
                  </span>
                ) : (
                  <span className="mr-1.5 inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700"
                    data-tip="Still being prepared">
                    In progress
                  </span>
                ))}
                {i.kind === 'json' ? 'Downloaded the JSON export' : 'Exported data files'}
                {i.kind === 'files' && i.status === 'succeeded' && (
                  <span className="text-gray-500"
                    data-tip={i.downloadedAt
                      ? 'The browser finished downloading the zip'
                      : 'The zip was prepared but the browser didn’t confirm the download (it may have downloaded it directly, or the page was closed)'}>
                    {' · '}{i.downloadedAt ? `downloaded ${formatWhen(i.downloadedAt)}` : 'download not confirmed'}
                  </span>
                )}
              </div>
              {choicesText(i.choices) && <div className="text-xs text-gray-600">{choicesText(i.choices)}</div>}
              {detailText(i) && <div className="text-xs text-gray-500">{detailText(i)}</div>}
              {i.error && <div className="text-xs text-red-600 break-words">{i.error}</div>}
              <div className="text-xs text-gray-500 truncate">
                {i.email ?? 'Unknown person'}
                {showAccount && (
                  <>
                    {' · '}
                    <Link href={`/admin/accounts/${i.accountId}`} className="hover:underline">{i.accountName ?? 'Unknown account'}</Link>
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
