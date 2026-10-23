'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { resolvePreferences, type ResolvedPreferences, type UserPreferences } from '@/lib/preferences'
import { readErrorMessage } from '@/lib/utils'

/** The signed-in user's preferences, with an optimistic setter. Defaults apply while loading. */
export function usePreferences() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery<ResolvedPreferences>({
    queryKey: ['preferences'],
    queryFn: () => fetch('/api/settings/preferences').then(r => r.json()),
    staleTime: 5 * 60_000,
  })

  const update = useMutation({
    mutationFn: async (patch: UserPreferences) => {
      const r = await fetch('/api/settings/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not save preference'))
      return (await r.json()) as ResolvedPreferences
    },
    onMutate: patch => {
      const prev = queryClient.getQueryData<ResolvedPreferences>(['preferences'])
      queryClient.setQueryData(['preferences'], { ...resolvePreferences(prev), ...patch })
      return { prev }
    },
    onError: (e: Error, _p, c) => {
      queryClient.setQueryData(['preferences'], c?.prev)
      toast.error(e.message)
    },
    onSuccess: p => queryClient.setQueryData(['preferences'], p),
  })

  return { prefs: data ?? resolvePreferences(null), isLoading, setPrefs: update.mutate }
}
