'use client'

import { useQuery } from '@tanstack/react-query'
import type { TimeEntryRow, TimeOptions } from '@/lib/time-entries-server'

export type { TimeEntryRow, TimeOptions }

export const fieldCls =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
export const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

/** Clients and projects the signed-in user can log time against */
export function useTimeOptions() {
  return useQuery<TimeOptions>({
    queryKey: ['time-options'],
    queryFn: async () => {
      const r = await fetch('/api/time-entries/options')
      if (!r.ok) throw new Error('Could not load clients')
      return r.json()
    },
  })
}

/** Entries for a query string built from the list filters */
export function useTimeEntries(params: URLSearchParams) {
  const qs = params.toString()
  return useQuery<{ entries: TimeEntryRow[]; truncated: boolean }>({
    queryKey: ['time-entries', qs],
    queryFn: async () => {
      const r = await fetch(`/api/time-entries?${qs}`)
      if (!r.ok) throw new Error('Could not load time entries')
      return r.json()
    },
  })
}
