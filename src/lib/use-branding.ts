'use client'

import { useQuery } from '@tanstack/react-query'
import type { Branding } from '@/lib/logo'

export const BRANDING_KEY = ['branding'] as const

/** The signed-in user's company logos (see lib/logo); `logoUrl` is the one to put on documents */
export function useBranding() {
  return useQuery<Branding & { isTeamAdmin: boolean }>({
    queryKey: BRANDING_KEY,
    queryFn: async () => {
      const r = await fetch('/api/branding')
      if (!r.ok) throw new Error('Could not load your logo')
      return r.json()
    },
    staleTime: 5 * 60 * 1000,
  })
}
