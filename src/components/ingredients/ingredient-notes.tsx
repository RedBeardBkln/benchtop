'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Edit2, Save } from 'lucide-react'
import { readErrorMessage } from '@/lib/utils'

const MAX_NOTES = 2000

/** Shows an ingredient's notes and, for members who can edit the library, lets them be edited in place. */
export function IngredientNotes({
  ingredientId,
  notes,
  canEdit,
  showLabel = false,
}: {
  ingredientId: string
  notes: string | null
  canEdit: boolean
  showLabel?: boolean
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const saveMutation = useMutation({
    mutationFn: (value: string | null) =>
      fetch(`/api/ingredients/${ingredientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: value }),
      }).then(async r => {
        if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not save the notes'))
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredient', ingredientId] })
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      setEditing(false)
      toast.success('Notes saved')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function startEditing() {
    setDraft(notes ?? '')
    setEditing(true)
  }

  function save() {
    const value = draft.trim()
    if (value === (notes ?? '').trim()) { setEditing(false); return }
    saveMutation.mutate(value || null)
  }

  if (!canEdit && !notes) return null

  if (editing && canEdit) {
    return (
      <div>
        {showLabel && <div className="text-xs text-gray-400 mb-1">Notes</div>}
        <textarea
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEditing(false) }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save() }
          }}
          maxLength={MAX_NOTES}
          rows={3}
          aria-label="Ingredient notes"
          placeholder="Supplier info, lot number, grade, etc."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                     focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
        <div className="mt-1.5 flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saveMutation.isPending}
            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={11} /> Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="px-2.5 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <span className="ml-auto text-xs text-gray-400 tabular-nums">{draft.length}/{MAX_NOTES}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="group/notes">
      {showLabel && <div className="text-xs text-gray-400 mb-1">Notes</div>}
      {notes ? (
        <div className="flex items-start gap-1.5">
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap break-words">{notes}</p>
          {canEdit && <button
            type="button"
            onClick={startEditing}
            className="shrink-0 mt-0.5 p-0.5 text-gray-400 hover:text-gray-700 rounded"
            data-tip="Edit this ingredient’s notes."
            aria-label="Edit notes"
          >
            <Edit2 size={11} />
          </button>}
        </div>
      ) : (
        <button
          type="button"
          onClick={startEditing}
          className="text-xs text-gray-400 hover:text-blue-600 hover:underline"
          data-tip="Add notes such as supplier info, lot number or grade."
        >
          + Add notes
        </button>
      )}
    </div>
  )
}
