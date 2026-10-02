'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

/**
 * Free-text note on how this iteration differs from the others. Saves on blur,
 * independent of the grid's Save button, and stays editable on locked iterations
 * (it describes the iteration; it isn't formulation data).
 */
export function IterationNote({ formulationId, note }: { formulationId: string; note: string | null }) {
  const queryClient = useQueryClient()
  const [value, setValue] = useState(note ?? '')

  const saveMutation = useMutation({
    mutationFn: (iterationNote: string | null) =>
      fetch(`/api/formulations/${formulationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iterationNote }),
      }).then(async r => { if (!r.ok) throw new Error('Failed to save iteration note'); return r.json() }),
    onSuccess: () => {
      // sibling iterations show this note in the version dropdown
      queryClient.invalidateQueries({ queryKey: ['formulation'] })
      toast.success('Iteration note saved')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function commit() {
    const next = value.trim()
    if (next === (note ?? '').trim()) return
    saveMutation.mutate(next || null)
  }

  return (
    <textarea
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={commit}
      maxLength={2000}
      rows={1}
      placeholder="How is this iteration different?"
      aria-label="Iteration note"
      className="flex-1 min-w-[18rem] max-w-xl px-2 py-0.5 text-sm text-gray-700 border border-gray-200 rounded
                 resize-none [field-sizing:content] max-h-32
                 focus:outline-none focus:ring-2 focus:ring-blue-500 print:hidden"
    />
  )
}
