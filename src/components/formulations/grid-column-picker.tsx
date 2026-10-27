'use client'

import { useMemo, useState } from 'react'
import { Columns3 } from 'lucide-react'
import type { Nutrient } from '@/lib/types'
import { CATEGORY_ORDER } from '@/lib/target-validation'

/**
 * Checkbox list of every nutrient, for choosing which ones the formula grid shows as columns.
 * Nutrients none of the formula's ingredients carry are still offered, just grayed.
 */
export function GridColumnPicker({
  allNutrients,
  selectedIds,
  presentIds,
  isDefault,
  onChange,
  onReset,
}: {
  allNutrients: Nutrient[]
  selectedIds: string[]
  /** Nutrients at least one ingredient in the formula has a value for */
  presentIds: Set<string>
  isDefault: boolean
  onChange: (ids: string[]) => void
  onReset: () => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = useMemo(() => new Set(selectedIds), [selectedIds])

  const q = query.trim().toLowerCase()
  const visible = q ? allNutrients.filter(n => n.name.toLowerCase().includes(q)) : allNutrients

  // Columns always follow the nutrients' display order, whatever order they were ticked in
  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(allNutrients.filter(n => next.has(n.id)).map(n => n.id))
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        data-tip="Choose which nutrients show as columns in the grid. Saved for this version."
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
      >
        <Columns3 size={11} /> Nutrient columns ({selectedIds.length})
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-lg shadow-lg">
            <div className="p-2 border-b border-gray-100 space-y-2">
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Escape' && setOpen(false)}
                placeholder="Filter nutrients…"
                className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Saved for this formulation</span>
                <button
                  type="button"
                  onClick={onReset}
                  disabled={isDefault}
                  data-tip={isDefault ? 'Already showing the default columns' : 'Back to Energy, Protein, Total Fat, Carbs and Dietary Fiber'}
                  className="text-blue-600 hover:underline disabled:text-gray-300 disabled:no-underline"
                >
                  Reset to default
                </button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto py-1">
              {CATEGORY_ORDER.map(cat => {
                const rows = visible.filter(n => n.category === cat)
                if (rows.length === 0) return null
                return (
                  <div key={cat}>
                    <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{cat}</div>
                    {rows.map(n => {
                      const present = presentIds.has(n.id)
                      return (
                        <label
                          key={n.id}
                          className="flex items-center gap-2 px-3 py-1 text-sm cursor-pointer hover:bg-gray-50"
                          data-tip={present ? undefined : 'No ingredient in this formulation has a value for this nutrient'}
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(n.id)}
                            onChange={() => toggle(n.id)}
                            className="rounded border-gray-300"
                          />
                          <span className={present ? 'text-gray-800' : 'text-gray-400'}>{n.name}</span>
                          <span className="ml-auto text-xs text-gray-400">{n.unit}</span>
                        </label>
                      )
                    })}
                  </div>
                )
              })}
              {visible.length === 0 && <div className="px-3 py-2 text-xs text-gray-400">No nutrients match</div>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
