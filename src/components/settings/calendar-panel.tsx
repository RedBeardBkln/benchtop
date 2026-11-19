'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { readErrorMessage } from '@/lib/utils'
import { btnPrimary, btnSecondary, Card, formatDate, Notice } from './ui'

type Connection = { provider: string; email: string | null; connectedAt: string } | null

// What /api/calendar/google/callback reports back in ?error=
const ERRORS: Record<string, string> = {
  denied: 'Google Calendar wasn’t connected: access was canceled on Google’s screen.',
  scope_denied: 'Google Calendar wasn’t connected: the permission to see your calendar events was left unticked. Connect again and leave it ticked.',
  no_refresh_token: 'Google didn’t give Benchtop lasting access. Connect again; if it keeps happening, remove Benchtop under Third-party connections in your Google Account first.',
  expired: 'That connection attempt expired. Please try again.',
  exchange_failed: 'Google Calendar couldn’t be connected. Please try again.',
  failed: 'Google Calendar couldn’t be connected. Please try again.',
  not_configured: 'Calendar connections aren’t available yet.',
}

// Settings → Calendar: connect a Google Calendar so the time log can offer the day's meetings
export function CalendarPanel() {
  const router = useRouter()
  const params = useSearchParams()
  const [connection, setConnection] = useState<Connection | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const error = ERRORS[params.get('error') ?? '']

  useEffect(() => {
    fetch('/api/calendar')
      .then(async r => (r.ok ? setConnection((await r.json()).connection) : toast.error(await readErrorMessage(r))))
      .catch(() => toast.error('Could not load your calendar connection'))
  }, [])

  useEffect(() => {
    if (params.get('connected')) {
      toast.success('Google Calendar connected')
      router.replace('/settings/calendar')
    }
  }, [params, router])

  async function disconnect() {
    if (!window.confirm('Disconnect Google Calendar? The time log will stop showing your meetings. Time you’ve already logged stays.')) return
    setBusy(true)
    try {
      const r = await fetch('/api/calendar', { method: 'DELETE' })
      if (!r.ok) return toast.error(await readErrorMessage(r))
      setConnection(null)
      toast.success('Google Calendar disconnected')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      title="Calendar"
      description="Connect your Google Calendar and the time log lists your meetings for the day, so you can log one with a click: its time, title and, where Benchtop can tell, the client fill themselves in. Benchtop only reads your events; it never changes your calendar. This is just for you; teammates don’t see your calendar."
    >
      <div className="space-y-4">
        {error && <Notice tone="error">{error}</Notice>}
        {connection === undefined ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : connection ? (
          <>
            <p className="text-sm text-gray-700">
              Connected to <strong>{connection.email ?? 'your Google account'}</strong> since {formatDate(connection.connectedAt)}.
            </p>
            <div className="flex flex-wrap gap-2">
              <a href="/api/calendar/google/connect" className={btnSecondary}>Reconnect or switch account</a>
              <button type="button" onClick={disconnect} disabled={busy} className={btnSecondary}>
                {busy ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600">Not connected.</p>
            <a href="/api/calendar/google/connect" className={btnPrimary}>Connect Google Calendar</a>
          </>
        )}
      </div>
    </Card>
  )
}
