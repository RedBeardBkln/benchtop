'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Search, X, Download, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
import type { FdcFood, FdcSearchResult } from '@/lib/types'

const DATA_TYPE_META: Record<string, { label: string; className: string }> = {
  'Foundation':    { label: 'Foundation', className: 'bg-green-100 text-green-700' },
  'SR Legacy':     { label: 'SR Legacy',  className: 'bg-blue-100 text-blue-700'  },
  'Survey (FNDDS)':{ label: 'Survey',     className: 'bg-gray-100 text-gray-500'  },
  'Branded':       { label: 'Branded',    className: 'bg-orange-100 text-orange-600' },
}

export function UsdaSearchDialog({
  open,
  onClose,
  onImported,
  initialQuery = '',
}: {
  open: boolean
  onClose: () => void
  onImported: (id?: string) => void
  initialQuery?: string
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [results, setResults] = useState<FdcSearchResult | null>(null)
  const [selected, setSelected] = useState<FdcFood | null>(null)
  const [nameOverride, setNameOverride] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const doSearch = useCallback(async (q: string, pageNum = 1) => {
    setIsSearching(true)
    setSearchError(null)
    setPage(pageNum)
    try {
      const r = await fetch(`/api/usda/search?q=${encodeURIComponent(q)}&page=${pageNum}`)
      const body = await r.json()
      if (!r.ok) throw new Error(body?.error ?? `API error ${r.status}`)
      setResults(body)
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed')
      setResults(null)
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Focus input whenever the dialog opens
  useEffect(() => {
    if (open) setTimeout(() => searchInputRef.current?.focus(), 20)
  }, [open])

  // Sync query from initialQuery prop on open; reset all state on close
  useEffect(() => {
    if (open) {
      setQuery(initialQuery.trim())
      setSearchError(null)
    } else {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      setQuery('')
      setResults(null)
      setSelected(null)
      setNameOverride('')
      setPage(1)
      setSearchError(null)
    }
  }, [open, initialQuery])

  // Debounced search — fires automatically whenever query changes
  useEffect(() => {
    if (!query.trim()) { setResults(null); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, doSearch])

  // Page change
  useEffect(() => {
    if (!query.trim() || page === 1) return
    doSearch(query, page)
  }, [page, query, doSearch])

  const importMutation = useMutation({
    mutationFn: (food: FdcFood) =>
      fetch('/api/ingredients/import-usda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fdcId: food.fdcId,
          nameOverride: nameOverride.trim() || undefined,
          fallbackFood: {
            description: food.description,
            foodNutrients: food.foodNutrients ?? [],
          },
        }),
      }).then(async r => {
        const body = await r.json()
        // 409 = already imported; treat as success so it auto-adds to formulation
        if (r.status === 409 && body.existingId) {
          return { id: body.existingId, name: body.existingName, nutrientCount: null, alreadyImported: true }
        }
        if (!r.ok) throw new Error(body.error ?? 'Import failed')
        return body
      }),
    onSuccess: data => {
      if (data.alreadyImported) {
        toast.success(`"${data.name}" is already in your library — added to formulation`)
      } else if (data.repaired) {
        toast.success(`"${data.name}" nutrients updated — ${data.nutrientCount} nutrients mapped`)
      } else {
        toast.success(`Imported "${data.name}" — ${data.nutrientCount} nutrients mapped`)
      }
      setQuery('')
      setResults(null)
      setSelected(null)
      setNameOverride('')
      onImported(data.id)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function handleClose() {
    setQuery('')
    setResults(null)
    setSelected(null)
    setNameOverride('')
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Search USDA FoodData Central</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Nutrients imported per 100 g. Prefer{' '}
              <span className="text-green-600 font-medium">Foundation</span> or{' '}
              <span className="text-blue-600 font-medium">SR Legacy</span> results — most complete and reliable.
            </p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Search input */}
        <div className="px-6 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="e.g. soy protein, oat flour, sunflower oil…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row flex-1 sm:min-h-0 overflow-auto sm:overflow-hidden">
          {/* Results list */}
          <div className="w-full sm:w-1/2 border-b sm:border-b-0 sm:border-r border-gray-100 flex flex-col max-h-48 sm:max-h-none overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {isSearching && (
                <div className="p-4 text-center text-xs text-gray-400">Searching…</div>
              )}
              {!isSearching && searchError && (
                <div className="p-4 text-center text-xs text-red-500">
                  {searchError}
                </div>
              )}
              {!isSearching && !searchError && results && results.foods.length === 0 && (
                <div className="p-4 text-center text-xs text-gray-400">No results</div>
              )}
              {!isSearching && !searchError && !results && query.trim() === '' && (
                <div className="p-6 text-center text-xs text-gray-400">
                  Type to search the USDA database
                </div>
              )}
              {results?.foods.map(food => (
                <button
                  key={food.fdcId}
                  onClick={() => { setSelected(food); setNameOverride('') }}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    selected?.fdcId === food.fdcId ? 'bg-blue-50 border-blue-100' : ''
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900 leading-snug">
                    {food.description}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400 font-mono">#{food.fdcId}</span>
                    {(() => {
                      const meta = DATA_TYPE_META[food.dataType]
                      return (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${meta?.className ?? 'bg-gray-100 text-gray-500'}`}>
                          {meta?.label ?? food.dataType}
                        </span>
                      )
                    })()}
                    {food.brandOwner && (
                      <span className="text-xs text-gray-400 truncate">{food.brandOwner}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Pagination */}
            {results && results.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 shrink-0">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs text-gray-400">
                  {page} / {results.totalPages} ({results.totalHits.toLocaleString()} hits)
                </span>
                <button
                  disabled={page >= results.totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Selected preview + import */}
          <div className="w-full sm:w-1/2 flex flex-col">
            {selected ? (
              <>
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{selected.description}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono text-gray-400">FDC {selected.fdcId}</span>
                      <a
                        href={`https://fdc.nal.usda.gov/food-details/${selected.fdcId}/nutrients`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline flex items-center gap-0.5"
                        onClick={e => e.stopPropagation()}
                      >
                        View on USDA <ExternalLink size={10} />
                      </a>
                    </div>
                    {selected.brandOwner && (
                      <div className="text-xs text-gray-400 mt-0.5">{selected.brandOwner}</div>
                    )}
                  </div>

                  {/* Name override */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Import as (leave blank to use USDA name)
                    </label>
                    <input
                      value={nameOverride}
                      onChange={e => setNameOverride(e.target.value)}
                      placeholder={selected.description}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md
                                 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <p className="text-xs text-gray-400">
                    Nutrients will be imported per 100 g. Source reference will be recorded as
                    "USDA FDC {selected.fdcId}". Status: <strong>Verified</strong>.
                  </p>
                </div>

                <div className="px-5 py-3 border-t border-gray-100 shrink-0">
                  <button
                    onClick={() => importMutation.mutate(selected)}
                    disabled={importMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm
                               bg-blue-600 text-white rounded-md hover:bg-blue-700
                               disabled:opacity-50 transition-colors"
                  >
                    <Download size={14} />
                    {importMutation.isPending ? 'Importing…' : 'Import ingredient'}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-gray-400 p-6 text-center">
                Select a result on the left to preview it before importing.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
