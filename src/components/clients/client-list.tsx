'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Building2, Plus, Search, X } from 'lucide-react'
import { readErrorMessage } from '@/lib/utils'
import { Term } from '@/components/term'

type ClientRow = {
  id: string
  name: string
  website: string | null
  projectCount: number
  primaryContact: { name: string; email: string | null } | null
}

function NewClientDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')

  const create = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not add client'))
      return (await r.json()) as { id: string; name: string }
    },
    onSuccess: c => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['client-options'] })
      toast.success(`Client "${c.name}" added`)
      router.push(`/clients/${c.id}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">New client</h3>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <form
          className="px-5 py-4 space-y-4"
          onSubmit={e => { e.preventDefault(); if (name.trim()) create.mutate() }}
        >
          <div>
            <label htmlFor="new-client-name" className="block text-xs font-medium text-gray-600 mb-1">
              Client name <span className="text-red-400">*</span>
            </label>
            <input
              id="new-client-name"
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Acme Foods"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">You can add contacts, accounting and shipping details next.</p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || create.isPending}
              data-tip={name.trim() ? 'Adds the client and opens its record so you can fill in the rest. Names must be unique.' : 'Type the client’s name first.'}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {create.isPending ? 'Adding…' : 'Add client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function ClientList() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [query, setQuery] = useState('')

  const { data, isLoading, isError } = useQuery<{ clients: ClientRow[] }>({
    queryKey: ['clients'],
    queryFn: async () => {
      const r = await fetch('/api/clients')
      if (!r.ok) throw new Error('Could not load clients')
      return r.json()
    },
  })

  const q = query.trim().toLowerCase()
  const rows = (data?.clients ?? []).filter(c =>
    !q || c.name.toLowerCase().includes(q) || c.primaryContact?.name.toLowerCase().includes(q),
  )

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-5xl">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">Contacts, accounting and shipping details for the people you formulate for.</p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          data-tip="Add a customer you formulate for. Link projects to them from each project’s page."
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors shrink-0"
        >
          <Plus size={14} /> New client
        </button>
      </div>

      {(data?.clients.length ?? 0) > 5 && (
        <div className="relative mb-4 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search clients or contacts"
            aria-label="Search clients"
            data-tip="Finds clients by their name or their primary contact’s name"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : isError ? (
        <p className="text-sm text-red-500">Could not load clients.</p>
      ) : (data?.clients.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white p-10 text-center">
          <Building2 size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">No clients yet.</p>
          <button onClick={() => setDialogOpen(true)} className="mt-2 text-sm text-blue-600 hover:underline">
            Add your first client →
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left font-medium"><Term t="client">Client</Term></th>
                <th className="hidden sm:table-cell px-4 py-3 text-left font-medium">
                  <Term tip="The main person to talk to at this client (or the first contact listed). Change it with the star on a contact card.">Primary contact</Term>
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  <Term tip="How many projects are linked to this client, including archived ones">Projects</Term>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/clients/${c.id}`} className="font-medium text-gray-900 hover:text-blue-700 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-gray-500">
                    {c.primaryContact ? (
                      <>
                        {c.primaryContact.name}
                        {c.primaryContact.email && <span className="text-gray-400"> · {c.primaryContact.email}</span>}
                      </>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 tabular-nums">{c.projectCount}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-400">No clients match “{query}”.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {dialogOpen && <NewClientDialog onClose={() => setDialogOpen(false)} />}
    </div>
  )
}
