'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays } from 'lucide-react'
import { readErrorMessage } from '@/lib/utils'
import { combineLocal } from '@/lib/time-tracking'
import type { CalendarMeeting } from '@/lib/calendar/events'

export type { CalendarMeeting }

type Status = { configured: boolean; connection: { email: string | null } | null }

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

/** The person's calendar connection; shared by everything that offers meetings */
export function useCalendarStatus() {
  return useQuery<Status>({
    queryKey: ['calendar-status'],
    queryFn: async () => {
      const r = await fetch('/api/calendar')
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not load your calendar connection'))
      return r.json()
    },
    staleTime: 5 * 60_000,
  })
}

// Meetings from the connected Google Calendar on `date` (the browser's local day); picking one
// fills the entry's times, and its task, type and client where those are still empty.
export function CalendarMeetings({ date, selectedId, onPick }: {
  date: string
  selectedId: string | null
  onPick: (m: CalendarMeeting) => void
}) {
  const status = useCalendarStatus()
  const connected = !!status.data?.connection
  const dayStart = combineLocal(date, '00:00')

  const meetings = useQuery<CalendarMeeting[]>({
    queryKey: ['calendar-events', date],
    enabled: connected && !!dayStart,
    queryFn: async () => {
      const from = dayStart!
      const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1)
      const r = await fetch(`/api/calendar/events?${new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })}`)
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not read your calendar'))
      return (await r.json()).meetings
    },
    staleTime: 60_000,
    retry: false,
  })

  if (!status.data?.configured) return null
  if (!connected) {
    return (
      <p className="text-xs text-gray-500 flex items-center gap-1.5">
        <CalendarDays size={13} className="shrink-0" />
        <span>
          <Link href="/settings/calendar" className="text-blue-600 hover:underline">Connect your Google Calendar</Link>{' '}
          to log a meeting with one click.
        </span>
      </p>
    )
  }

  return (
    <div>
      <p className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1.5">
        <CalendarDays size={13} /> Meetings this day
      </p>
      {meetings.isLoading ? (
        <p className="text-xs text-gray-400">Reading your calendar…</p>
      ) : meetings.error ? (
        <p className="text-xs text-amber-700">{(meetings.error as Error).message}</p>
      ) : !meetings.data?.length ? (
        <p className="text-xs text-gray-400">No meetings on your calendar this day.</p>
      ) : (
        <ul className="max-h-40 overflow-y-auto space-y-1 pr-1">
          {meetings.data.map(m => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onPick(m)}
                aria-pressed={selectedId === m.id}
                className={`w-full text-left px-2 py-1.5 rounded-md border text-xs transition-colors ${
                  selectedId === m.id ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-gray-200 hover:bg-gray-50 text-gray-800'
                }`}
              >
                <span className="tabular-nums text-gray-500 mr-2 whitespace-nowrap">{clock(m.start)}–{clock(m.end)}</span>
                <span className="font-medium">{m.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
