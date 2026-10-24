'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit2, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Equipment } from '@/lib/types'
import { readErrorMessage } from '@/lib/utils'

type EquipmentRow = Equipment & { stepCount?: number }

/** Rename or remove the account's shared equipment list. Render only while open. */
export function EquipmentManagerDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nameEdit, setNameEdit] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const { data: rows = [], isLoading } = useQuery<EquipmentRow[]>({
    queryKey: ['equipment'],
    queryFn: async () => {
      const r = await fetch('/api/equipment')
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not load equipment'))
      return r.json()
    },
    staleTime: 0,
  })

  // Steps show equipment names through a join, so open formulations need a re-fetch too
  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['equipment'] })
    queryClient.invalidateQueries({ queryKey: ['formulation'] })
  }

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const r = await fetch(`/api/equipment/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not rename'))
    },
    onSuccess: () => { refresh(); setEditingId(null); toast.success('Equipment renamed') },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/equipment/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not remove'))
    },
    onSuccess: () => { refresh(); setConfirmDeleteId(null); toast.success('Equipment removed') },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-5 space-y-4 max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Equipment</h3>
            <p className="text-sm text-gray-500 mt-1">
              Shared by every formulation in your account. Renaming updates every step that uses it.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto -mx-1 px-1">
          {isLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-400">
              No equipment yet. Add some from a process step’s <b>Equipment</b> box.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {rows.map(row => (
                <li key={row.id} className="py-2">
                  {editingId === row.id ? (
                    <form
                      className="flex items-center gap-2"
                      onSubmit={e => {
                        e.preventDefault()
                        const name = nameEdit.trim()
                        if (name) renameMutation.mutate({ id: row.id, name })
                      }}
                    >
                      <input
                        autoFocus
                        value={nameEdit}
                        maxLength={120}
                        onChange={e => setNameEdit(e.target.value)}
                        onKeyDown={e => e.key === 'Escape' && setEditingId(null)}
                        className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button type="submit" disabled={!nameEdit.trim() || renameMutation.isPending}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                        Save
                      </button>
                      <button type="button" onClick={() => setEditingId(null)}
                        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700">
                        Cancel
                      </button>
                    </form>
                  ) : confirmDeleteId === row.id ? (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-700">
                        Remove <b>{row.name}</b>?{' '}
                        {row.stepCount
                          ? `${row.stepCount} process step${row.stepCount === 1 ? '' : 's'} use${row.stepCount === 1 ? 's' : ''} it and will show no equipment.`
                          : 'No process steps use it.'}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => deleteMutation.mutate(row.id)}
                          disabled={deleteMutation.isPending}
                          className="px-3 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                        >
                          Remove
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50 text-gray-600">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-gray-800">{row.name}</span>
                      <span className="text-xs text-gray-400">
                        {row.stepCount ?? 0} step{row.stepCount === 1 ? '' : 's'}
                      </span>
                      <button
                        onClick={() => { setEditingId(row.id); setNameEdit(row.name); setConfirmDeleteId(null) }}
                        title="Rename" aria-label={`Rename ${row.name}`}
                        className="p-1 text-gray-400 hover:text-gray-700 rounded"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => { setConfirmDeleteId(row.id); setEditingId(null) }}
                        title="Remove" aria-label={`Remove ${row.name}`}
                        className="p-1 text-gray-400 hover:text-red-600 rounded"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
