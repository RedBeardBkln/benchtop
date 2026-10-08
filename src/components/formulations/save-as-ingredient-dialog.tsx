'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { readErrorMessage } from '@/lib/utils'

interface Props {
  formulationId: string
  formulationName: string
  onClose: () => void
}

export function SaveAsIngredientDialog({ formulationId, formulationName, onClose }: Props) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(formulationName)

  const { data, isLoading } = useQuery<{ existing: { id: string; name: string } | null }>({
    queryKey: ['save-as-ingredient', formulationId],
    queryFn: () => fetch(`/api/formulations/${formulationId}/save-as-ingredient`).then(r => r.json()),
  })
  const existing = data?.existing ?? null
  // A formulation backs at most one ingredient, so saving again refreshes it
  const updating = !!existing

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/formulations/${formulationId}/save-as-ingredient`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), updateExisting: updating }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not save ingredient'))
      return r.json() as Promise<{ ingredient: { id: string; name: string }; updated: boolean; costKnown: boolean }>
    },
    onSuccess: ({ ingredient, updated, costKnown }) => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      queryClient.invalidateQueries({ queryKey: ['ingredient', ingredient.id] })
      queryClient.invalidateQueries({ queryKey: ['save-as-ingredient', formulationId] })
      toast.success(
        `${updated ? 'Updated' : 'Saved'} ingredient "${ingredient.name}"` +
          (costKnown ? '' : ' — cost left blank because some ingredients have no cost'),
      )
      onClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const canSave = name.trim().length > 0 && !save.isPending && !isLoading

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-5 space-y-4"
        onSubmit={e => { e.preventDefault(); if (canSave) save.mutate() }}
      >
        <h3 className="text-base font-semibold text-gray-900">Save as ingredient</h3>
        <p className="text-sm text-gray-500">
          Adds this finalized formulation to your ingredient library so it can be used in other
          formulations and projects. Nutrients (per 100 g of finished product, after process losses),
          allergens, the ingredient list, and cost are copied as a snapshot; later edits to this
          formulation won&apos;t change the ingredient unless you update it.
        </p>

        {existing && (
          <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm space-y-2">
            <p className="text-blue-800">
              Already saved as{' '}
              <Link href={`/ingredients/${existing.id}`} className="font-medium underline">{existing.name}</Link>.
            </p>
            <p className="text-gray-600">
              Saving refreshes it from this formulation and keeps its brand, supplier, stock, docs, and certs.
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ingredient name</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={255}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={!canSave}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            {save.isPending ? 'Saving…' : updating ? 'Update ingredient' : 'Save ingredient'}
          </button>
        </div>
      </form>
    </div>
  )
}
