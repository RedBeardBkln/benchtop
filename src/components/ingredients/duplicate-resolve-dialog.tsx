'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, GitMerge, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import type { DuplicateIngredientEntry, IngredientDetail } from '@/lib/types'
import { readErrorMessage } from '@/lib/utils'

// Resolves a pre-existing duplicate: either make this entry different (rename / change brand,
// supplier or item code) or merge the duplicates into the one entry that is kept.

type Mode = 'rename' | 'merge'

type Entry = {
  id: string
  name: string
  brandName: string | null
  supplierName: string | null
  itemCode: string | null
  stockG: string | null
  formulationCount: number
  nutrientCount: number
  isCurrent: boolean
}

function describe(e: Pick<Entry, 'brandName' | 'supplierName' | 'itemCode'>) {
  const bits = [
    e.brandName && `Brand: ${e.brandName}`,
    e.supplierName && `Supplier: ${e.supplierName}`,
    e.itemCode && `Item #${e.itemCode}`,
  ].filter(Boolean)
  return bits.length ? bits.join(' · ') : 'No brand, supplier or item code'
}

export function DuplicateResolveDialog({
  ingredientId,
  initialMode = 'rename',
  onClose,
  onRemoved,
}: {
  ingredientId: string
  initialMode?: Mode
  onClose: () => void
  /** Called after a merge removed the ingredient this dialog was opened from */
  onRemoved?: () => void
}) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<Mode>(initialMode)

  const { data, isLoading, error } = useQuery<IngredientDetail>({
    queryKey: ['ingredient', ingredientId],
    queryFn: async () => {
      const r = await fetch(`/api/ingredients/${ingredientId}`)
      if (!r.ok) throw new Error('Not found')
      return r.json()
    },
  })

  // rename form
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [supplier, setSupplier] = useState('')
  const [itemCode, setItemCode] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  useEffect(() => {
    if (!data) return
    setName(data.name)
    setBrand(data.brandName ?? '')
    setSupplier(data.supplierName ?? '')
    setItemCode(data.itemCode ?? '')
  }, [data])

  // merge selection
  const [keepId, setKeepId] = useState<string>(ingredientId)
  const [mergeError, setMergeError] = useState<string | null>(null)

  const entries: Entry[] = data
    ? [
        {
          id: data.id, name: data.name, brandName: data.brandName, supplierName: data.supplierName,
          itemCode: data.itemCode, stockG: data.stockG, isCurrent: true,
          formulationCount: new Set(data.formulations.map(f => f.formulationId)).size,
          nutrientCount: data.nutrients.length,
        },
        ...(data.duplicates ?? []).map((d: DuplicateIngredientEntry) => ({ ...d, isCurrent: false })),
      ]
    : []

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['ingredients'] })
    queryClient.invalidateQueries({ queryKey: ['ingredient'] })
    queryClient.invalidateQueries({ queryKey: ['formulation'] })
  }

  const renameMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/ingredients/${ingredientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          brandName: brand.trim() || null,
          supplierName: supplier.trim() || null,
          itemCode: itemCode.trim() || null,
        }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not save'))
      return r.json()
    },
    onSuccess: () => {
      refresh()
      toast.success('Ingredient updated — it is no longer a duplicate')
      onClose()
    },
    onError: (e: Error) => setRenameError(e.message),
  })

  const mergeMutation = useMutation({
    mutationFn: async () => {
      const removed = entries.filter(e => e.id !== keepId)
      for (const e of removed) {
        const r = await fetch(`/api/ingredients/${e.id}/merge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intoId: keepId }),
        })
        if (!r.ok) throw new Error(await readErrorMessage(r, `Could not merge "${e.name}"`))
      }
      return removed
    },
    onSuccess: removed => {
      refresh()
      const keeper = entries.find(e => e.id === keepId)
      toast.success(`Merged ${removed.length} duplicate${removed.length === 1 ? '' : 's'} into "${keeper?.name}"`)
      if (keepId !== ingredientId) onRemoved?.()
      onClose()
    },
    onError: (e: Error) => { setMergeError(e.message); refresh() },
  })

  const unchanged = !!data
    && name.trim() === data.name
    && brand.trim() === (data.brandName ?? '')
    && supplier.trim() === (data.supplierName ?? '')
    && itemCode.trim() === (data.itemCode ?? '')

  const removedEntries = entries.filter(e => e.id !== keepId)
  const affectedFormulations = removedEntries.reduce((n, e) => n + e.formulationCount, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-gray-900">Duplicate ingredient</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {entries.length > 1
                  ? `${entries.length} entries have the same name, brand, supplier and item code.`
                  : 'Loading…'}{' '}
                Make this one different, or merge the duplicates into one.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {isLoading && <p className="px-5 py-8 text-sm text-gray-400">Loading…</p>}
        {error && <p className="px-5 py-8 text-sm text-red-500">Could not load this ingredient.</p>}

        {data && entries.length < 2 && (
          <div className="px-5 py-6 text-sm text-gray-600">
            This ingredient is no longer a duplicate.
            <div className="mt-4"><button onClick={onClose} className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Close</button></div>
          </div>
        )}

        {data && entries.length >= 2 && (
          <>
            <div className="flex gap-1 px-5 mt-4 border-b border-gray-100">
              {([['rename', 'Rename', Pencil], ['merge', 'Merge', GitMerge]] as const).map(([m, label, Icon]) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    mode === m ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>

            {mode === 'rename' && (
              <form
                className="px-5 py-4 space-y-3"
                onSubmit={e => { e.preventDefault(); setRenameError(null); renameMutation.mutate() }}
              >
                <p className="text-xs text-gray-500">
                  Change at least one of these so it no longer matches the other {entries.length - 1 === 1 ? 'entry' : 'entries'}.
                </p>
                {[
                  ['Name', name, setName, true],
                  ['Brand', brand, setBrand, false],
                  ['Supplier', supplier, setSupplier, false],
                  ['Item code', itemCode, setItemCode, false],
                ].map(([label, value, set, required]) => (
                  <div key={label as string}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label as string}</label>
                    <input
                      value={value as string}
                      onChange={e => { (set as (v: string) => void)(e.target.value); setRenameError(null) }}
                      required={required as boolean}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                    />
                  </div>
                ))}
                {renameError && <p className="text-sm text-red-600" role="alert">{renameError}</p>}
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={onClose} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!name.trim() || unchanged || renameMutation.isPending}
                    className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {renameMutation.isPending ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            )}

            {mode === 'merge' && (
              <div className="px-5 py-4 space-y-3">
                <p className="text-xs text-gray-500">Choose the entry to keep. The others are merged into it and removed.</p>
                <ul className="space-y-2">
                  {entries.map(e => (
                    <li key={e.id}>
                      <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer ${
                        keepId === e.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                      }`}>
                        <input
                          type="radio"
                          name="keep"
                          checked={keepId === e.id}
                          onChange={() => { setKeepId(e.id); setMergeError(null) }}
                          className="mt-1"
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-gray-900">
                            {e.name} {e.isCurrent && <span className="text-xs font-normal text-gray-400">(this one)</span>}
                          </span>
                          <span className="block text-xs text-gray-500">{describe(e)}</span>
                          <span className="block text-xs text-gray-400 mt-0.5">
                            Used in {e.formulationCount} formulation{e.formulationCount === 1 ? '' : 's'} · {e.nutrientCount} nutrient value{e.nutrientCount === 1 ? '' : 's'}
                            {e.stockG != null && ` · ${parseFloat(e.stockG).toFixed(0)} g in stock`}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>

                <div className="text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                  <p className="font-medium text-amber-800">What a merge does</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>
                      {affectedFormulations > 0
                        ? `${affectedFormulations} formulation use${affectedFormulations === 1 ? '' : 's'} of the removed ${removedEntries.length === 1 ? 'entry' : 'entries'} will switch to the kept one.`
                        : 'The removed entries are not used in any formulation.'}
                      {' '}Their nutrition then comes from the kept entry, which can change a formulation’s numbers, including finalized ones.
                    </li>
                    <li>The kept entry’s values win. Nutrients, documents, certifications and suppliers it lacks are copied over; allergens are combined; stock is added.</li>
                    <li>This cannot be undone.</li>
                  </ul>
                </div>

                {mergeError && <p className="text-sm text-red-600" role="alert">{mergeError}</p>}
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={onClose} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                    Cancel
                  </button>
                  <button
                    onClick={() => { setMergeError(null); mergeMutation.mutate() }}
                    disabled={mergeMutation.isPending}
                    className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {mergeMutation.isPending
                      ? 'Merging…'
                      : `Merge ${removedEntries.length} into “${entries.find(e => e.id === keepId)?.name ?? ''}”`}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
