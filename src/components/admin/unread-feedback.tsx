'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { MessageSquare, X } from 'lucide-react'

export const UNREAD_FEEDBACK_KEY = ['admin-feedback-unread']

// Unread feedback count for platform admins; 0 for everyone else (never fetched)
export function useUnreadFeedback(enabled: boolean): number {
  const { data } = useQuery<{ count: number }>({
    queryKey: UNREAD_FEEDBACK_KEY,
    queryFn: async () => {
      const r = await fetch('/api/admin/feedback/unread')
      if (!r.ok) throw new Error('Could not load unread feedback')
      return r.json()
    },
    enabled,
    staleTime: 60 * 1000,
  })
  return enabled ? data?.count ?? 0 : 0
}

const DISMISS_KEY = 'benchtop:feedback-banner-dismissed'

// Banner at the top of every page while there is unread feedback. Dismissing hides it for the
// rest of the browser session, until more submissions arrive.
export function UnreadFeedbackBanner({ count }: { count: number }) {
  const pathname = usePathname()
  const [dismissedAt, setDismissedAt] = useState<number | null>(null)

  useEffect(() => {
    try {
      const v = sessionStorage.getItem(DISMISS_KEY)
      if (v) setDismissedAt(Number(v))
    } catch {
      // Storage blocked: the banner just can't stay dismissed
    }
  }, [])

  if (count === 0 || pathname.startsWith('/admin/feedback')) return null
  if (dismissedAt != null && count <= dismissedAt) return null

  function dismiss() {
    setDismissedAt(count)
    try { sessionStorage.setItem(DISMISS_KEY, String(count)) } catch {}
  }

  return (
    <div className="flex items-center gap-3 px-4 sm:px-8 py-2.5 bg-blue-50 border-b border-blue-200 text-sm text-blue-900 print:hidden">
      <MessageSquare size={16} className="shrink-0 text-blue-600" />
      <span className="flex-1 min-w-0">
        You have {count} unread feedback submission{count === 1 ? '' : 's'}.{' '}
        <Link href="/admin/feedback" className="font-medium text-blue-700 underline hover:text-blue-800">
          View
        </Link>
      </span>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="text-blue-500 hover:text-blue-700">
        <X size={16} />
      </button>
    </div>
  )
}
