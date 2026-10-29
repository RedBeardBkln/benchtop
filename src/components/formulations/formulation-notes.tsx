'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, NotebookPen, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { FormulationNote } from '@/lib/types'
import { readErrorMessage } from '@/lib/utils'

export const formulationNotesKey = (formulationId: string) => ['formulation-notes', formulationId]

export function useFormulationNotes(formulationId: string, enabled = true) {
  return useQuery<FormulationNote[]>({
    queryKey: formulationNotesKey(formulationId),
    queryFn: () => fetch(`/api/formulations/${formulationId}/notes`).then(r => {
      if (!r.ok) throw new Error('Failed to load notes')
      return r.json()
    }),
    enabled,
  })
}

export function formatNoteDate(value: Date | string) {
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

/** Edited more than a moment after it was written */
export function noteWasEdited(n: Pick<FormulationNote, 'createdAt' | 'updatedAt'>) {
  return new Date(n.updatedAt).getTime() - new Date(n.createdAt).getTime() > 1000
}

async function send(url: string, method: string, body?: unknown) {
  const r = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(await readErrorMessage(r, 'Failed to save note'))
  return r.json()
}

const TEXTAREA = `w-full px-3 py-2 text-sm text-gray-800 border border-gray-200 rounded-md resize-y
                  focus:outline-none focus:ring-2 focus:ring-blue-500`

/**
 * Dated log of findings and conclusions on this iteration, newest first. Saves straight away,
 * independent of the grid's Save button, and stays open on locked iterations (notes aren't formulation data).
 * View-only members can read the log but not add to it.
 */
export function FormulationNotes({ formulationId, version, readOnly = false }: {
  formulationId: string
  version: number
  readOnly?: boolean
}) {
  const queryClient = useQueryClient()
  const { data: notes = [], isLoading, error } = useFormulationNotes(formulationId)
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const base = `/api/formulations/${formulationId}/notes`
  const refresh = () => queryClient.invalidateQueries({ queryKey: formulationNotesKey(formulationId) })
  const onError = (err: Error) => toast.error(err.message)

  const addMutation = useMutation({
    mutationFn: (body: string) => send(base, 'POST', { body }),
    onSuccess: () => { setDraft(''); refresh() },
    onError,
  })
  const editMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => send(`${base}/${id}`, 'PATCH', { body }),
    onSuccess: () => { setEditingId(null); refresh() },
    onError,
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => send(`${base}/${id}`, 'DELETE'),
    onSuccess: () => { setDeletingId(null); refresh() },
    onError,
  })

  function add() {
    const body = draft.trim()
    if (body && !addMutation.isPending) addMutation.mutate(body)
  }

  return (
    <div className="mt-6 print:hidden">
      <div className="flex items-center gap-2 mb-3">
        <NotebookPen size={14} className="text-gray-400" />
        <span className="text-sm font-medium text-gray-700">Notes</span>
        <span className="text-xs text-gray-400">
          Findings and conclusions on v{version}{notes.length > 0 ? ` · ${notes.length}` : ''}
        </span>
      </div>

      {!readOnly && <div className="space-y-2">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); add() } }}
          maxLength={10000}
          rows={2}
          placeholder="Record a finding or conclusion: what you tried, what you measured, what to change next"
          aria-label="New note"
          className={TEXTAREA}
        />
        <div className="flex items-center justify-end gap-3">
          <span className="text-xs text-gray-400">Ctrl+Enter to add</span>
          <button
            onClick={add}
            disabled={!draft.trim() || addMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {addMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            Add note
          </button>
        </div>
      </div>}

      {isLoading ? (
        <p className="mt-3 text-sm text-gray-400">Loading…</p>
      ) : error ? (
        <p className="mt-3 text-sm text-red-500">Could not load notes.</p>
      ) : notes.length === 0 ? (
        <p className={`${readOnly ? '' : 'mt-3 '}text-sm text-gray-400`}>No notes on this iteration yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100 border border-gray-100 rounded-lg">
          {notes.map(n => (
            <li key={n.id} className="group px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-400">
                <span>{formatNoteDate(n.createdAt)}</span>
                {n.authorEmail && <span>· {n.authorEmail}</span>}
                {noteWasEdited(n) && <span title={`Edited ${formatNoteDate(n.updatedAt)}`}>· edited</span>}
                {n.mine && !readOnly && editingId !== n.id && (
                  deletingId === n.id ? (
                    <span className="ml-auto flex items-center gap-2">
                      <span className="text-gray-600">Delete this note?</span>
                      <button
                        onClick={() => deleteMutation.mutate(n.id)}
                        disabled={deleteMutation.isPending}
                        className="text-red-600 hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                      <button onClick={() => setDeletingId(null)} className="text-gray-500 hover:underline">
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <span className="ml-auto flex items-center gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        onClick={() => { setEditingId(n.id); setEditText(n.body); setDeletingId(null) }}
                        title="Edit note"
                        aria-label="Edit note"
                        className="text-gray-400 hover:text-gray-700"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeletingId(n.id)}
                        title="Delete note"
                        aria-label="Delete note"
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 size={13} />
                      </button>
                    </span>
                  )
                )}
              </div>
              {editingId === n.id ? (
                <div className="mt-1.5 space-y-2">
                  <textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    maxLength={10000}
                    rows={3}
                    aria-label="Edit note"
                    autoFocus
                    className={TEXTAREA}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1 text-sm border border-gray-200 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => editMutation.mutate({ id: n.id, body: editText.trim() })}
                      disabled={!editText.trim() || editMutation.isPending}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap break-words">{n.body}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
