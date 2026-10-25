'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Archive, ArchiveRestore, X } from 'lucide-react'
import { readErrorMessage } from '@/lib/utils'

// Archived ingredients or suppliers (archived along with a client): a link under the list that opens them,
// each with its own Restore button. Shows nothing while none are archived.

type Kind = 'ingredients' | 'suppliers'
type Row = { id: string; name: string; archivedAt: string }

const LABEL: Record<Kind, { one: string; many: string }> = {
  ingredients: { one: 'ingredient', many: 'ingredients' },
  suppliers: { one: 'supplier', many: 'suppliers' },
}

/** Restores one archived ingredient or supplier. */
export function useRestoreRecord(kind: Kind) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (row: { id: string; name: string }) => {
      const r = await fetch(`/api/${kind}/${row.id}/restore`, { method: 'POST' })
      if (!r.ok) throw new Error(await readErrorMessage(r, `Could not restore ${LABEL[kind].one}`))
      return row
    },
    onSuccess: row => {
      queryClient.invalidateQueries({ queryKey: [kind] })
      queryClient.invalidateQueries({ queryKey: [kind === 'ingredients' ? 'ingredient' : 'supplier', row.id] })
      toast.success(`${row.name} restored`)
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function ArchivedRecords({ kind, canEdit }: { kind: Kind; canEdit: boolean }) {
  const [open, setOpen] = useState(false)
  const restore = useRestoreRecord(kind)
  const { data: rows = [] } = useQuery<Row[]>({
    queryKey: [kind, 'archived'],
    queryFn: () => fetch(`/api/${kind}?archived=1`).then(r => (r.ok ? r.json() : [])),
  })
  if (rows.length === 0) return null

  const { one, many } = LABEL[kind]
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-tip={`${many[0].toUpperCase()}${many.slice(1)} archived along with a client. They’re hidden from lists and pickers until restored.`}
        className="mt-3 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <Archive size={14} /> Archived {many} ({rows.length})
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Archived {many}</h3>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <p className="px-5 pt-3 text-xs text-gray-500">
              Restoring an {one} brings back just that {one}. Formulations that use it keep working while it’s archived.
            </p>
            <ul className="px-5 py-3 divide-y divide-gray-100 overflow-y-auto">
              {rows.map(r => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <Link href={`/${kind}/${r.id}`} className="text-sm text-gray-900 hover:text-blue-700 hover:underline">{r.name}</Link>
                    <div className="text-xs text-gray-400">Archived {new Date(r.archivedAt).toLocaleDateString()}</div>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => restore.mutate(r)}
                      disabled={restore.isPending}
                      data-tip={`Puts this ${one} back in your ${many} list and pickers`}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 shrink-0"
                    >
                      <ArchiveRestore size={12} /> Restore
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}

/** Banner for an archived ingredient's or supplier's own page, with a Restore button. */
export function ArchivedBanner({ kind, record, canEdit }: {
  kind: Kind
  record: { id: string; name: string; archivedAt: string | null }
  canEdit: boolean
}) {
  const restore = useRestoreRecord(kind)
  if (!record.archivedAt) return null
  const { one, many } = LABEL[kind]
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <span>
        Archived on {new Date(record.archivedAt).toLocaleDateString()}. This {one} is hidden from your {many} list and pickers.
      </span>
      {canEdit && (
        <button
          type="button"
          onClick={() => restore.mutate(record)}
          disabled={restore.isPending}
          data-tip={`Puts this ${one} back in your ${many} list and pickers`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-amber-300 rounded-md hover:bg-amber-100 disabled:opacity-50"
        >
          <ArchiveRestore size={14} /> {restore.isPending ? 'Restoring…' : 'Restore'}
        </button>
      )}
    </div>
  )
}
