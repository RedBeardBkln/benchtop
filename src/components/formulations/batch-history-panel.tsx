'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { formatWeightG } from '@/lib/weight'
import { readErrorMessage } from '@/lib/utils'
import { Term } from '@/components/term'

type BatchRun = {
  id: string
  batchMultiplier: string
  batchWeightG: string | null
  notes: string | null
  runAt: string
  runByName: string | null
}

export const batchRunsKey = (formulationId: string) => ['batch-runs', formulationId]

/** Batches recorded with "Complete batch" for this version, newest first. Hidden until there is one. */
export function BatchHistoryPanel({ formulationId }: { formulationId: string }) {
  const [open, setOpen] = useState(false)
  const { data: runs = [] } = useQuery<BatchRun[]>({
    queryKey: batchRunsKey(formulationId),
    queryFn: async () => {
      const r = await fetch(`/api/formulations/${formulationId}/complete-batch`)
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not load batch history'))
      return r.json()
    },
  })

  if (runs.length === 0) return null

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        data-tip={open ? 'Hides the batch history' : 'Shows each batch recorded with Complete batch for this version'}
        className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Batch history
        <span className="text-xs text-gray-400 font-normal">
          ({runs.length} batch{runs.length !== 1 ? 'es' : ''})
        </span>
      </button>

      {open && (
        <div className="border border-gray-100 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 text-left">
              <tr>
                <th className="font-medium px-3 py-2">Date</th>
                <th className="font-medium px-3 py-2 text-right"><Term t="batchMultiplier">Multiplier</Term></th>
                <th className="font-medium px-3 py-2 text-right"><Term tip="The total weight of ingredients used: the saved batch size × the multiplier.">Batch weight</Term></th>
                <th className="font-medium px-3 py-2">Recorded by</th>
                <th className="font-medium px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {runs.map(run => (
                <tr key={run.id}>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-700">{format(new Date(run.runAt), 'd MMM yyyy, HH:mm')}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700">×{Number(parseFloat(run.batchMultiplier).toFixed(4))}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                    {run.batchWeightG != null ? `${formatWeightG(parseFloat(run.batchWeightG))} g` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{run.runByName ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-pre-line">{run.notes ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
