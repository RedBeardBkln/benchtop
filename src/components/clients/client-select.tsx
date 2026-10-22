'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { readErrorMessage } from '@/lib/utils'

// Picks a project's client from the account's client records. Owners and admins can also add a
// client on the spot; everyone else sees only the clients they may put projects under.

export type ClientOptions = {
  clients: Array<{ id: string; name: string }>
  canManage: boolean
  canChooseNone: boolean
}

const NEW = '__new__'

const fieldCls =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

export function useClientOptions() {
  return useQuery<ClientOptions>({
    queryKey: ['client-options'],
    queryFn: async () => {
      const r = await fetch('/api/clients/options')
      if (!r.ok) throw new Error('Could not load clients')
      return r.json()
    },
  })
}

export function ClientSelect({
  value,
  onChange,
  current,
  id,
  autoFocus,
}: {
  value: string | null
  onChange: (clientId: string | null) => void
  /** The project's current client, kept selectable even when it isn't in the caller's list */
  current?: { id: string; name: string } | null
  id?: string
  autoFocus?: boolean
}) {
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useClientOptions()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const create = useMutation({
    mutationFn: async (name: string) => {
      const r = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not add client'))
      return (await r.json()) as { id: string; name: string }
    },
    onSuccess: c => {
      queryClient.invalidateQueries({ queryKey: ['client-options'] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      onChange(c.id)
      setAdding(false)
      setNewName('')
      toast.success(`Client "${c.name}" added`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const options = [...(data?.clients ?? [])]
  if (current && !options.some(o => o.id === current.id)) options.unshift(current)

  if (adding) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); if (newName.trim()) create.mutate(newName.trim()) }
            if (e.key === 'Escape') { e.preventDefault(); setAdding(false) }
          }}
          placeholder="New client name"
          aria-label="New client name"
          className={fieldCls}
        />
        <button
          type="button"
          onClick={() => newName.trim() && create.mutate(newName.trim())}
          disabled={!newName.trim() || create.isPending}
          className="shrink-0 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {create.isPending ? 'Adding…' : 'Add'}
        </button>
        <button
          type="button"
          onClick={() => setAdding(false)}
          className="shrink-0 px-3 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <select
      id={id}
      autoFocus={autoFocus}
      value={value ?? ''}
      disabled={isLoading}
      onChange={e => {
        if (e.target.value === NEW) setAdding(true)
        else onChange(e.target.value || null)
      }}
      className={fieldCls}
    >
      {isLoading && <option value="">Loading clients…</option>}
      {isError && <option value="">Could not load clients</option>}
      {!isLoading && (data?.canChooseNone || value === null) && <option value="">No client</option>}
      {options.map(c => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
      {data?.canManage && <option value={NEW}>+ New client…</option>}
    </select>
  )
}
