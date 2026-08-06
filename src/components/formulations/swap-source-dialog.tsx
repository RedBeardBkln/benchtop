'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, Database, PenLine, Search, X } from 'lucide-react'
import type { IngredientListRow } from '@/lib/types'

const SOURCE_LABELS: Record<string, string> = {
  usda: 'USDA',
  manual: 'Manual',
  supplier: 'Supplier',
  ai_extracted: 'AI',
}

interface SwapSourceDialogProps {
  open: boolean
  ingredientName: string
  onClose: () => void
  onLibrary: () => void
  onUsda: () => void
  onManual: () => void
}

export function SwapSourceDialog({
  open, ingredientName, onClose, onLibrary, onUsda, onManual,
}: SwapSourceDialogProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Swap Ingredient</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Replace <span className="font-medium text-gray-700">{ingredientName}</span> with:
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onLibrary}
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 transition-colors text-left"
          >
            <BookOpen size={18} className="text-emerald-600 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-gray-900">Ingredient Library</div>
              <div className="text-xs text-gray-500">Choose from existing ingredients</div>
            </div>
          </button>
          <button
            onClick={onUsda}
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
          >
            <Database size={18} className="text-blue-600 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-gray-900">USDA Database</div>
              <div className="text-xs text-gray-500">Search and import from FoodData Central</div>
            </div>
          </button>
          <button
            onClick={onManual}
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-violet-400 hover:bg-violet-50 transition-colors text-left"
          >
            <PenLine size={18} className="text-violet-600 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-gray-900">Add Manually</div>
              <div className="text-xs text-gray-500">Create a new ingredient by hand</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

interface LibraryPickerDialogProps {
  open: boolean
  excludeId?: string | null
  onClose: () => void
  onSelect: (id: string) => void
}

export function LibraryPickerDialog({
  open, excludeId, onClose, onSelect,
}: LibraryPickerDialogProps) {
  const [query, setQuery] = useState('')

  const { data: ingredients = [] } = useQuery<IngredientListRow[]>({
    queryKey: ['ingredients'],
    queryFn: () => fetch('/api/ingredients').then(r => r.json()),
    enabled: open,
  })

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return ingredients
      .filter(i => i.id !== excludeId && i.name.toLowerCase().includes(q))
      .slice(0, 60)
  }, [ingredients, query, excludeId])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-base font-semibold text-gray-900">Choose from Library</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pb-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              type="text"
              placeholder="Search ingredients…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No ingredients found</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {filtered.map(ing => (
                <button
                  key={ing.id}
                  onClick={() => onSelect(ing.id)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left w-full group"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 group-hover:text-emerald-700 truncate">
                      {ing.name}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {SOURCE_LABELS[ing.sourceType] ?? ing.sourceType}
                      {ing.verification === 'verified' && (
                        <span className="ml-1.5 text-green-500">✓</span>
                      )}
                    </div>
                  </div>
                  {ing.stockG != null && (
                    <span className="text-xs text-gray-400 tabular-nums ml-4 flex-shrink-0">
                      {parseFloat(ing.stockG as string).toFixed(0)} g
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
