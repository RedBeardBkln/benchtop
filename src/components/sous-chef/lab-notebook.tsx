'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Archive, ArchiveRestore, Pencil, Plus, Trash2, X } from 'lucide-react'
import { readErrorMessage } from '@/lib/utils'
import { NOTE_KIND_KEYS, NOTE_MAX_CHARS, SOUS_CHEF_NOTE_KINDS, type SousChefNoteKind } from '@/lib/sous-chef'

// The team's lab notebook: what Sous Chef applies in every conversation. Anyone can add a note;
// the person who recorded one, and owners and admins, can change, retire or delete it.

export type NotebookNote = {
  id: string
  kind: SousChefNoteKind
  content: string
  projectId: string | null
  projectName: string | null
  formulationId: string | null
  formulationName: string | null
  retiredAt: string | null
  createdAt: string
  createdByName: string | null
  canEdit: boolean
}

export const NOTES_KEY = ['sous-chef-notes']

export function useNotebook() {
  return useQuery<NotebookNote[]>({
    queryKey: NOTES_KEY,
    queryFn: async () => {
      const r = await fetch('/api/sous-chef/notes')
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not load the lab notebook'))
      return r.json()
    },
  })
}

const KIND_STYLE: Record<SousChefNoteKind, string> = {
  decision: 'bg-blue-50 text-blue-700',
  preference: 'bg-violet-50 text-violet-700',
  learning: 'bg-emerald-50 text-emerald-700',
  constraint: 'bg-amber-50 text-amber-800',
}

export function KindBadge({ kind }: { kind: SousChefNoteKind }) {
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium ${KIND_STYLE[kind]}`}>
      {SOUS_CHEF_NOTE_KINDS[kind].label}
    </span>
  )
}

const fieldCls =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

function NoteForm({ initial, onSave, onCancel, saving }: {
  initial?: { kind: SousChefNoteKind; content: string }
  onSave: (v: { kind: SousChefNoteKind; content: string }) => void
  onCancel: () => void
  saving: boolean
}) {
  const [kind, setKind] = useState<SousChefNoteKind>(initial?.kind ?? 'decision')
  const [content, setContent] = useState(initial?.content ?? '')
  return (
    <form
      className="space-y-2 p-3 rounded-md border border-gray-200 bg-gray-50"
      onSubmit={e => { e.preventDefault(); if (content.trim()) onSave({ kind, content: content.trim() }) }}
    >
      <select className={fieldCls} value={kind} onChange={e => setKind(e.target.value as SousChefNoteKind)} aria-label="Kind of note">
        {NOTE_KIND_KEYS.map(k => <option key={k} value={k}>{SOUS_CHEF_NOTE_KINDS[k].label}: {SOUS_CHEF_NOTE_KINDS[k].hint.toLowerCase()}</option>)}
      </select>
      <textarea
        className={`${fieldCls} min-h-20`} value={content} maxLength={NOTE_MAX_CHARS} autoFocus
        placeholder="e.g. Client X wants no gums on the label; use citrus fiber for body instead."
        onChange={e => setContent(e.target.value)} aria-label="Note"
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm rounded-md text-gray-700 hover:bg-gray-100">Cancel</button>
        <button type="submit" disabled={saving || !content.trim()} className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          Save
        </button>
      </div>
    </form>
  )
}

export function LabNotebook({ onClose }: { onClose?: () => void }) {
  const qc = useQueryClient()
  const { data: notes = [], isLoading, error } = useNotebook()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [showRetired, setShowRetired] = useState(false)

  const call = async (url: string, method: string, body?: unknown) => {
    const r = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
    })
    if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not save the note'))
  }
  const mutate = useMutation({
    mutationFn: (a: { url: string; method: string; body?: unknown }) => call(a.url, a.method, a.body),
    onSuccess: () => { setAdding(false); setEditing(null); qc.invalidateQueries({ queryKey: NOTES_KEY }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const live = notes.filter(n => !n.retiredAt)
  const retired = notes.filter(n => n.retiredAt)

  const row = (n: NotebookNote) => editing === n.id ? (
    <li key={n.id}>
      <NoteForm
        initial={n} saving={mutate.isPending} onCancel={() => setEditing(null)}
        onSave={v => mutate.mutate({ url: `/api/sous-chef/notes/${n.id}`, method: 'PATCH', body: v })}
      />
    </li>
  ) : (
    <li key={n.id} className={`group p-3 rounded-md border border-gray-200 bg-white ${n.retiredAt ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <KindBadge kind={n.kind} />
            {(n.formulationName || n.projectName) && (
              <span className="text-[11px] text-gray-500 truncate">
                {n.formulationName && n.formulationId
                  ? <a href={`/formulations/${n.formulationId}`} className="hover:underline">{n.formulationName}</a>
                  : n.projectId && <a href={`/projects/${n.projectId}`} className="hover:underline">{n.projectName}</a>}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{n.content}</p>
          <p className="text-[11px] text-gray-400 mt-1">
            {new Date(n.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
            {n.createdByName && ` · ${n.createdByName}`}
            {n.retiredAt && ' · retired'}
          </p>
        </div>
        {n.canEdit && (
          <div className="flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            {!n.retiredAt && (
              <button onClick={() => setEditing(n.id)} className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100" aria-label="Edit note" title="Edit">
                <Pencil size={14} />
              </button>
            )}
            <button
              onClick={() => mutate.mutate({ url: `/api/sous-chef/notes/${n.id}`, method: 'PATCH', body: { retired: !n.retiredAt } })}
              className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              aria-label={n.retiredAt ? 'Bring back' : 'Retire'}
              title={n.retiredAt ? 'Bring back: Sous Chef applies it again' : 'Retire: keep it on record, but Sous Chef stops applying it'}
            >
              {n.retiredAt ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            </button>
            <button
              onClick={() => { if (window.confirm('Delete this note for good?')) mutate.mutate({ url: `/api/sous-chef/notes/${n.id}`, method: 'DELETE' }) }}
              className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50" aria-label="Delete note" title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </li>
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900 flex-1">Lab notebook</h2>
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md text-blue-700 hover:bg-blue-50">
          <Plus size={14} /> Add note
        </button>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded text-gray-500 hover:bg-gray-100" aria-label="Close lab notebook">
            <X size={16} />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <p className="text-xs text-gray-500">
          Decisions, preferences, learnings and constraints Sous Chef applies in every conversation, on every project.
          It records them as you work; you can add your own.
        </p>
        {adding && (
          <NoteForm saving={mutate.isPending} onCancel={() => setAdding(false)}
            onSave={v => mutate.mutate({ url: '/api/sous-chef/notes', method: 'POST', body: v })} />
        )}
        {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}
        {!isLoading && live.length === 0 && !adding && (
          <p className="text-sm text-gray-500 italic">Nothing recorded yet.</p>
        )}
        <ul className="space-y-2">{live.map(row)}</ul>
        {retired.length > 0 && (
          <div>
            <button onClick={() => setShowRetired(s => !s)} className="text-xs text-gray-500 hover:text-gray-700">
              {showRetired ? 'Hide' : 'Show'} {retired.length} retired note{retired.length === 1 ? '' : 's'}
            </button>
            {showRetired && <ul className="space-y-2 mt-2">{retired.map(row)}</ul>}
          </div>
        )}
      </div>
    </div>
  )
}
