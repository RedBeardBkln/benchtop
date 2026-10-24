'use client'

import { useQuery } from '@tanstack/react-query'
import { readErrorMessage } from '@/lib/utils'

export type ImportDraftSummary = { id: string; name: string; fileName: string; missing: string[]; updatedAt: string }

export const IMPORTS_KEY = ['formulation-imports']

/** The signed-in person's unfinished spreadsheet imports */
export function useImportDrafts() {
  return useQuery<ImportDraftSummary[]>({
    queryKey: IMPORTS_KEY,
    queryFn: async () => {
      const r = await fetch('/api/formulation-imports')
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not load your imports'))
      return r.json()
    },
  })
}
