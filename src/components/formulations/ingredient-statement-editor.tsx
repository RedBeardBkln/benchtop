'use client'

import { useState } from 'react'
import { ArrowDownWideNarrow, CornerUpLeft, GripVertical, Pencil, RotateCcw, Ungroup } from 'lucide-react'
import {
  combineItems, isDescendingByWeight, moveItem, removeFromGroup, renameItem, separateGroup, setSubIngredients,
  sortByWeight, splitIngredientList, type StatementItem,
} from '@/lib/label-statements'
import { Term } from '@/components/term'

// Arrange the NFP ingredient statement: drag an entry near the top or bottom edge of another to move it,
// or onto the middle of another to combine them into a parenthetical group ("Almond Milk (Water, Almonds)").

type Zone = 'before' | 'after' | 'combine'

const rowsFor = (text: string) => Math.min(4, Math.max(1, Math.ceil(text.length / 45)))
const fieldCls =
  'block w-full px-1.5 py-1 text-sm border border-blue-300 rounded resize-y focus:outline-none focus:ring-2 focus:ring-blue-500'

function NameEditor({ item, editing, onEdit, onRename, onSubs, onDone }: {
  item: StatementItem
  editing: boolean
  onEdit: () => void
  onRename: (name: string) => void
  onSubs: (subs: string[]) => void
  onDone: () => void
}) {
  // The typed list is kept as text so separators can be typed freely; the entry gets the parsed list
  const [subsDraft, setSubsDraft] = useState(item.subs.join(', '))
  const [wasEditing, setWasEditing] = useState(editing)
  if (editing !== wasEditing) {
    setWasEditing(editing)
    if (editing) setSubsDraft(item.subs.join(', '))
  }

  if (editing) {
    const finishKeys = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); onDone() }
    }
    // Full width and wrapping, so long names stay readable while they're edited.
    // Editing ends when focus leaves both fields, not when it moves between them.
    return (
      <div
        className="space-y-1"
        onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onDone() }}
      >
        <textarea
          autoFocus
          value={item.name}
          rows={rowsFor(item.name)}
          onChange={e => onRename(e.target.value.replace(/\n/g, ' '))}
          onFocus={e => e.target.select()}
          onKeyDown={finishKeys}
          placeholder={item.children.length > 0 ? 'Name this ingredient' : 'Label name'}
          aria-label="Name on the label"
          className={fieldCls}
        />
        {item.children.length === 0 && (
          <div>
            <textarea
              value={subsDraft}
              rows={rowsFor(subsDraft)}
              onChange={e => {
                const v = e.target.value.replace(/\n/g, ' ')
                setSubsDraft(v)
                onSubs(splitIngredientList(v))
              }}
              onKeyDown={finishKeys}
              placeholder="Ingredients in parentheses, separated by commas (optional)"
              aria-label={`Ingredients in parentheses after ${item.name || 'this ingredient'}`}
              className={`${fieldCls} text-xs`}
            />
            <p className="mt-0.5 text-[11px] text-gray-400">In parentheses, separated by commas. Changes this label only.</p>
          </div>
        )}
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onEdit}
      data-tip="Edit how this entry is written on this label only. The ingredient library isn’t changed."
      className="group/name max-w-full text-left text-sm text-gray-900 hover:text-blue-700 break-words"
    >
      <span className={item.name.trim() ? '' : 'italic text-gray-400'}>
        {item.name.trim() || 'Unnamed'}
      </span>
      <Pencil size={11} className="inline ml-1 align-baseline text-gray-300 group-hover/name:text-blue-500" />
    </button>
  )
}

export function IngredientStatementEditor({ items, onChange, onReset }: {
  items: StatementItem[]
  onChange: (next: StatementItem[]) => void
  onReset: () => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [hover, setHover] = useState<{ id: string; zone: Zone } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const total = items.reduce((s, i) => s + i.weightG, 0)
  const pct = (w: number) => (total > 0 ? `${((w / total) * 100).toFixed(w / total < 0.01 ? 2 : 1)}%` : '')
  const descending = isDescendingByWeight(items)

  function zoneFor(e: React.DragEvent<HTMLElement>): Zone {
    const r = e.currentTarget.getBoundingClientRect()
    const y = (e.clientY - r.top) / r.height
    return y < 0.3 ? 'before' : y > 0.7 ? 'after' : 'combine'
  }

  function drop(targetId: string, zone: Zone) {
    if (!dragId || dragId === targetId) return
    if (zone === 'combine') {
      const target = items.find(i => i.id === targetId)
      const newId = `group-${crypto.randomUUID()}`
      onChange(combineItems(items, dragId, targetId, newId, target?.name ?? ''))
      // A new group starts with the target's name; let the user name it straight away
      if (target && target.children.length === 0) setEditingId(newId)
    } else {
      onChange(moveItem(items, dragId, targetId, zone))
    }
  }

  const rename = (id: string) => (name: string) => onChange(renameItem(items, id, name))
  const editSubs = (id: string) => (subs: string[]) => onChange(setSubIngredients(items, id, subs))

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        Drag an ingredient above or below another to reorder, or onto another to combine them in parentheses.
      </p>

      <ul className="border border-gray-200 rounded-md divide-y divide-gray-100 bg-white">
        {items.map(item => {
          const isGroup = item.children.length > 0
          const isTarget = hover?.id === item.id && dragId !== null && dragId !== item.id
          return (
            <li
              key={item.id}
              draggable={editingId === null}
              onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragId(item.id) }}
              onDragOver={e => {
                if (!dragId || dragId === item.id) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                const zone = zoneFor(e)
                if (hover?.id !== item.id || hover.zone !== zone) setHover({ id: item.id, zone })
              }}
              onDragLeave={() => setHover(h => (h?.id === item.id ? null : h))}
              onDrop={e => { e.preventDefault(); drop(item.id, zoneFor(e)); setHover(null) }}
              onDragEnd={() => { setDragId(null); setHover(null) }}
              className={`relative px-2 py-1.5 transition-colors ${
                dragId === item.id ? 'opacity-40' :
                isTarget && hover?.zone === 'combine' ? 'bg-green-50 ring-2 ring-inset ring-green-400' :
                isTarget && hover?.zone === 'before' ? 'border-t-2 !border-t-blue-500' :
                isTarget && hover?.zone === 'after' ? 'border-b-2 !border-b-blue-500' : ''
              }`}
            >
              <div className="flex items-start gap-2">
                <span
                  className="shrink-0 mt-0.5 text-gray-300 cursor-grab active:cursor-grabbing"
                  data-tip="Drag to the top or bottom edge of another entry to move it, or onto its middle to group them."
                >
                  <GripVertical size={14} />
                </span>
                <div className="flex-1 min-w-0">
                  <NameEditor
                    item={item}
                    editing={editingId === item.id}
                    onEdit={() => setEditingId(item.id)}
                    onRename={rename(item.id)}
                    onSubs={editSubs(item.id)}
                    onDone={() => setEditingId(null)}
                  />
                  {!isGroup && item.subs.length > 0 && editingId !== item.id && (
                    <div className="text-xs text-gray-400 break-words">({item.subs.join(', ')})</div>
                  )}
                </div>
                {isTarget && hover?.zone === 'combine' && (
                  <span className="shrink-0 text-xs font-medium text-green-700">Combine</span>
                )}
                <span
                  className="shrink-0 font-mono text-xs text-gray-400 tabular-nums"
                  data-tip="This entry’s share of the total ingredient weight, which sets its place in the statement."
                >
                  {pct(item.weightG)}
                </span>
                {isGroup && (
                  <button
                    type="button"
                    onClick={() => onChange(separateGroup(items, item.id))}
                    data-tip="Splits this group back into separate entries, where the group was."
                    aria-label={`Separate ${item.name || 'group'}`}
                    className="shrink-0 p-1 text-gray-400 hover:text-blue-600"
                  >
                    <Ungroup size={14} />
                  </button>
                )}
              </div>

              {isGroup && (
                <ul className="mt-1 ml-6 pl-2 border-l-2 border-gray-100 space-y-0.5">
                  {item.children.map(child => (
                    <li key={child.id} className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <NameEditor
                          item={child}
                          editing={editingId === child.id}
                          onEdit={() => setEditingId(child.id)}
                          onRename={rename(child.id)}
                          onSubs={editSubs(child.id)}
                          onDone={() => setEditingId(null)}
                        />
                        {(child.children.length > 0 || child.subs.length > 0) && editingId !== child.id && (
                          <div className="text-xs text-gray-400 break-words">
                            ({(child.children.length > 0 ? child.children.map(c => c.name) : child.subs).join(', ')})
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-xs text-gray-400 tabular-nums">{pct(child.weightG)}</span>
                      <button
                        type="button"
                        onClick={() => onChange(removeFromGroup(items, item.id, child.id))}
                        data-tip="Takes this ingredient out of the group and lists it on its own, just after the group."
                        aria-label={`Take ${child.name} out of ${item.name || 'the group'}`}
                        className="shrink-0 p-1 text-gray-400 hover:text-blue-600"
                      >
                        <CornerUpLeft size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {!descending && (
          <span className="text-xs text-amber-700">
            Not in <Term tip="FDA rules list ingredients by weight, heaviest first (21 CFR 101.4).">descending order by weight</Term>.
          </span>
        )}
        {!descending && (
          <button
            type="button"
            onClick={() => onChange(sortByWeight(items))}
            data-tip="Reorders the entries heaviest first. Groups and names are kept."
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <ArrowDownWideNarrow size={12} /> Sort by weight
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          data-tip="Discards your reordering, groups and renamed entries and rebuilds the list from the formulation."
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 hover:underline"
        >
          <RotateCcw size={12} /> Reset from formulation
        </button>
      </div>
    </div>
  )
}
