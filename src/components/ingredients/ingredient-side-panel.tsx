'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  X, ExternalLink, Check, AlertTriangle, ArrowLeftRight,
  ChevronRight, Sparkles,
} from 'lucide-react'
import type { IngredientDetail, Nutrient } from '@/lib/types'
import { readErrorMessage } from '@/lib/utils'

const CATEGORY_ORDER = ['macros', 'vitamins', 'minerals', 'other'] as const

const STANDARD_ALLERGENS = [
  'Milk', 'Eggs', 'Fish', 'Shellfish', 'Tree Nuts',
  'Peanuts', 'Wheat', 'Soybeans', 'Sesame', 'Gluten',
]

const STANDARD_CERTS = [
  'Organic', 'Non-GMO', 'IP Non-GMO', 'Kosher', 'Halal',
  'Vegan', 'Gluten-Free', 'Fair Trade',
]

type SidePanelTab = 'nutrients' | 'allergens' | 'info' | 'suppliers'

type NutrientEdit = {
  amount: string
  sourceRef: string
  rowId?: string
}

export function IngredientSidePanel({
  ingredientId,
  lineKey,
  formulationLocked,
  onClose,
  onSwap,
}: {
  ingredientId: string
  lineKey: string
  formulationLocked: boolean
  onClose: () => void
  onSwap: (lineKey: string, ingredientName: string) => void
}) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<SidePanelTab>('nutrients')
  const [editingNutrients, setEditingNutrients] = useState(false)
  const [globalSource, setGlobalSource] = useState('')
  const [nutrientEdits, setNutrientEdits] = useState<Record<string, NutrientEdit>>({})
  const initDoneRef = useRef(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useQuery<IngredientDetail>({
    queryKey: ['ingredient', ingredientId],
    queryFn: () =>
      fetch(`/api/ingredients/${ingredientId}`).then(r => {
        if (!r.ok) throw new Error('Not found')
        return r.json()
      }),
  })

  const { data: allNutrients } = useQuery<Nutrient[]>({
    queryKey: ['nutrients-all'],
    queryFn: () => fetch('/api/nutrients').then(r => r.json()),
    enabled: editingNutrients,
    staleTime: Infinity,
  })

  useEffect(() => {
    if (!editingNutrients || !allNutrients || !data || initDoneRef.current) return
    initDoneRef.current = true
    const edits: Record<string, NutrientEdit> = {}
    for (const n of allNutrients) {
      const existing = data.nutrients.find(row => row.nutrientId === n.id)
      edits[n.id] = existing
        ? { amount: String(parseFloat(existing.amountPer100g)), sourceRef: existing.sourceRef, rowId: existing.id }
        : { amount: '', sourceRef: '' }
    }
    setNutrientEdits(edits)
    setGlobalSource('')
  }, [editingNutrients, allNutrients, data])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['ingredient', ingredientId] })
    queryClient.invalidateQueries({ queryKey: ['ingredients'] })
  }

  const verifyMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/ingredients/${ingredientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verification: data?.verification === 'verified' ? 'unverified' : 'verified' }),
      }).then(r => r.json()),
    onSuccess: () => { invalidate(); toast.success('Verification updated') },
  })

  const saveNutrientsMutation = useMutation({
    mutationFn: (payload: {
      values: Array<{ nutrientId: string; amountPer100g: number; sourceRef: string }>
      deleteIds: string[]
    }) =>
      fetch(`/api/ingredients/${ingredientId}/nutrients`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(async r => {
        if (!r.ok) throw new Error(await readErrorMessage(r, 'Save failed'))
      }),
    onSuccess: () => {
      invalidate()
      setEditingNutrients(false)
      initDoneRef.current = false
      toast.success('Nutrients saved')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const addAllergenMutation = useMutation({
    mutationFn: (allergen: string) =>
      fetch(`/api/ingredients/${ingredientId}/allergens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allergen }),
      }).then(r => r.json()),
    onSuccess: () => invalidate(),
    onError: () => toast.error('Failed to update allergen'),
  })

  const removeAllergenMutation = useMutation({
    mutationFn: (allergenId: string) =>
      fetch(`/api/ingredients/${ingredientId}/allergens/${allergenId}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(),
    onError: () => toast.error('Failed to update allergen'),
  })

  const addCertMutation = useMutation({
    mutationFn: (cert: string) =>
      fetch(`/api/ingredients/${ingredientId}/certs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cert }),
      }).then(r => r.json()),
    onSuccess: () => invalidate(),
    onError: () => toast.error('Failed to update certification'),
  })

  const removeCertMutation = useMutation({
    mutationFn: (certId: string) =>
      fetch(`/api/ingredients/${ingredientId}/certs/${certId}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(),
    onError: () => toast.error('Failed to update certification'),
  })

  function toggleAllergen(allergen: string) {
    const existing = data?.allergens.find(a => a.allergen === allergen)
    if (existing) removeAllergenMutation.mutate(existing.id)
    else addAllergenMutation.mutate(allergen)
  }

  function toggleCert(cert: string) {
    const existing = data?.certs.find(c => c.cert === cert)
    if (existing) removeCertMutation.mutate(existing.id)
    else addCertMutation.mutate(cert)
  }

  function handleSaveNutrients() {
    const values: Array<{ nutrientId: string; amountPer100g: number; sourceRef: string }> = []
    const deleteIds: string[] = []
    for (const [nutrientId, edit] of Object.entries(nutrientEdits)) {
      if (edit.amount === '') {
        if (edit.rowId) deleteIds.push(edit.rowId)
      } else {
        const amount = parseFloat(edit.amount)
        if (isNaN(amount) || amount < 0) continue
        const sourceRef = edit.sourceRef || globalSource
        if (!sourceRef) { toast.error('Enter a source reference before saving'); return }
        values.push({ nutrientId, amountPer100g: amount, sourceRef })
      }
    }
    saveNutrientsMutation.mutate({ values, deleteIds })
  }

  function cancelEditNutrients() {
    setEditingNutrients(false)
    initDoneRef.current = false
  }

  const nutrientsByCategory = data
    ? CATEGORY_ORDER.map(cat => ({
        category: cat,
        nutrients: data.nutrients.filter(n => n.nutrient.category === cat),
      })).filter(g => g.nutrients.length > 0)
    : []

  const activeAllergenNames = new Set(data?.allergens.map(a => a.allergen) ?? [])
  const activeCertNames = new Set(data?.certs.map(c => c.cert) ?? [])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[420px] bg-white shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="h-5 w-48 bg-gray-100 rounded animate-pulse" />
            ) : (
              <>
                <h2 className="text-base font-semibold text-gray-900 leading-tight truncate">{data?.name}</h2>
                {data?.labelName && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    <span className="text-gray-300">Label: </span>{data.labelName}
                  </p>
                )}
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                  {data && (
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
                      data.verification === 'verified'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {data.verification === 'verified' ? '✓ Verified' : '⚠ Unverified'}
                    </span>
                  )}
                  {data?.sourceType && (
                    <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500 uppercase">
                      {data.sourceType}
                    </span>
                  )}
                  {data?.isAbSpi && (
                    <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">AB SPI</span>
                  )}
                  {data?.isIsolateOrConcentrate && !data.isAbSpi && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                      <AlertTriangle size={9} /> Isolate
                    </span>
                  )}
                  {data?.fdcId && (
                    <a
                      href={`https://fdc.nal.usda.gov/food-details/${data.fdcId}/nutrients`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-xs text-blue-500 hover:underline"
                    >
                      FDC {data.fdcId} <ExternalLink size={9} />
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {data && (
              <a
                href={`/ingredients/${ingredientId}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Open full ingredient page"
                className="p-1.5 text-gray-400 hover:text-blue-500 rounded hover:bg-gray-100 transition-colors"
              >
                <ExternalLink size={15} />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-5">
          {([
            ['nutrients', `Nutrients${data ? ` (${data.nutrients.length})` : ''}`],
            ['allergens', `Allergens & Certs`],
            ['suppliers', `Suppliers${data ? ` (${data.suppliers?.length ?? 0})` : ''}`],
            ['info', 'Info'],
          ] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-0 py-2.5 text-xs font-medium border-b-2 mr-5 transition-colors ${
                tab === t
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-5 space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + (i % 3) * 15}%` }} />
              ))}
            </div>
          ) : !data ? (
            <div className="p-5 text-sm text-red-500">Failed to load ingredient.</div>
          ) : (

            <>
              {/* ── Nutrients tab ── */}
              {tab === 'nutrients' && (
                <div className="flex flex-col h-full">
                  {!editingNutrients ? (
                    <>
                      {/* Read mode */}
                      {nutrientsByCategory.length === 0 ? (
                        <div className="p-5 text-sm text-gray-400">No nutrient data recorded yet.</div>
                      ) : (
                        <div className="divide-y divide-gray-50">
                          {nutrientsByCategory.map(group => (
                            <div key={group.category}>
                              <div className="px-5 pt-3 pb-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                                  {group.category}
                                </span>
                              </div>
                              <table className="w-full text-sm">
                                <tbody className="divide-y divide-gray-50">
                                  {group.nutrients.map(n => (
                                    <tr key={n.nutrientId} className="hover:bg-gray-50/50">
                                      <td className="px-5 py-1.5 text-gray-700">{n.nutrient.name}</td>
                                      <td className="px-5 py-1.5 text-right tabular-nums text-gray-600 font-medium">
                                        {parseFloat(n.amountPer100g).toFixed(
                                          n.nutrient.unit === 'kcal' || n.nutrient.unit === 'g' ? 1 : 2
                                        )}
                                      </td>
                                      <td className="pr-5 py-1.5 text-xs text-gray-400 w-10">{n.nutrient.unit}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    /* Edit mode */
                    <div className="p-4 space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Default source reference <span className="text-gray-400">(applies to all)</span>
                        </label>
                        <input
                          value={globalSource}
                          onChange={e => setGlobalSource(e.target.value)}
                          placeholder="e.g. USDA FDC 123456 / COA 2024-01"
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      {allNutrients ? (
                        CATEGORY_ORDER.map(cat => {
                          const catNutrients = allNutrients.filter(n => n.category === cat)
                          if (!catNutrients.length) return null
                          return (
                            <div key={cat}>
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">{cat}</div>
                              <div className="space-y-1">
                                {catNutrients.map(n => {
                                  const edit = nutrientEdits[n.id] ?? { amount: '', sourceRef: '' }
                                  return (
                                    <div key={n.id} className="flex items-center gap-2">
                                      <label className="flex-1 text-xs text-gray-600 truncate">{n.name}</label>
                                      <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={edit.amount}
                                        onChange={e => setNutrientEdits(prev => ({
                                          ...prev,
                                          [n.id]: { ...prev[n.id] ?? {}, amount: e.target.value },
                                        }))}
                                        placeholder="—"
                                        className="w-20 px-2 py-0.5 text-xs text-right border border-gray-200 rounded tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      />
                                      <span className="text-xs text-gray-400 w-8 shrink-0">{n.unit}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="text-xs text-gray-400">Loading nutrients…</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Allergens & Certs tab ── */}
              {tab === 'allergens' && (
                <div className="p-5 space-y-6">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Allergens</h3>
                    <div className="flex flex-wrap gap-2">
                      {STANDARD_ALLERGENS.map(a => {
                        const active = activeAllergenNames.has(a)
                        return (
                          <button
                            key={a}
                            onClick={() => toggleAllergen(a)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                              active
                                ? 'bg-red-100 border-red-200 text-red-700'
                                : 'bg-white border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-600'
                            }`}
                          >
                            {active && '✓ '}{a}
                          </button>
                        )
                      })}
                    </div>
                    {data.allergens.filter(a => !STANDARD_ALLERGENS.includes(a.allergen)).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {data.allergens.filter(a => !STANDARD_ALLERGENS.includes(a.allergen)).map(a => (
                          <span key={a.id} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 border border-red-200 text-red-700">
                            {a.allergen}
                            <button onClick={() => removeAllergenMutation.mutate(a.id)} className="ml-0.5 hover:text-red-900">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Certifications</h3>
                    <div className="flex flex-wrap gap-2">
                      {STANDARD_CERTS.map(c => {
                        const active = activeCertNames.has(c)
                        return (
                          <button
                            key={c}
                            onClick={() => toggleCert(c)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                              active
                                ? 'bg-green-100 border-green-200 text-green-700'
                                : 'bg-white border-gray-200 text-gray-500 hover:border-green-200 hover:text-green-600'
                            }`}
                          >
                            {active && '✓ '}{c}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Info tab ── */}
              {tab === 'info' && (
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    {data.labelName && (
                      <div className="col-span-2">
                        <div className="text-xs text-gray-400 mb-0.5">Label statement</div>
                        <div className="text-xs font-medium text-gray-800">{data.labelName}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5">Source type</div>
                      <div className="font-medium text-gray-800 uppercase text-xs">{data.sourceType}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5">Verification</div>
                      <div className={`text-xs font-medium ${data.verification === 'verified' ? 'text-green-600' : 'text-yellow-600'}`}>
                        {data.verification === 'verified' ? '✓ Verified' : '⚠ Unverified'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5">Naturally derived</div>
                      <div className="text-xs font-medium text-gray-700">{data.naturallyDerived ? 'Yes' : 'No'}</div>
                    </div>
                    {data.fdcId && (
                      <div>
                        <div className="text-xs text-gray-400 mb-0.5">USDA FDC ID</div>
                        <a
                          href={`https://fdc.nal.usda.gov/food-details/${data.fdcId}/nutrients`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline inline-flex items-center gap-0.5"
                        >
                          {data.fdcId} <ExternalLink size={9} />
                        </a>
                      </div>
                    )}
                    {data.defaultCostPerKg && (
                      <div>
                        <div className="text-xs text-gray-400 mb-0.5">Cost / kg</div>
                        <div className="text-xs font-medium text-gray-700">${parseFloat(data.defaultCostPerKg).toFixed(2)}</div>
                      </div>
                    )}
                    {data.moisturePct && (
                      <div>
                        <div className="text-xs text-gray-400 mb-0.5">Moisture %</div>
                        <div className="text-xs font-medium text-gray-700">{parseFloat(data.moisturePct).toFixed(2)}%</div>
                      </div>
                    )}
                  </div>
                  {data.notes && (
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Notes</div>
                      <p className="text-sm text-gray-700 leading-relaxed">{data.notes}</p>
                    </div>
                  )}
                  {(data.subIngredients?.length ?? 0) > 0 && (
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Sub-ingredients</div>
                      <p className="text-sm text-gray-700">{data.subIngredients!.map(s => s.name).join(', ')}</p>
                    </div>
                  )}
                  {(data.docs?.length ?? 0) > 0 && (
                    <div>
                      <div className="text-xs text-gray-400 mb-2">Documents</div>
                      <div className="space-y-1">
                        {data.docs!.map(doc => (
                          <div key={doc.id} className="flex items-center gap-2 text-xs text-gray-600">
                            <ChevronRight size={10} className="text-gray-300" />
                            {doc.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(data.suppliers?.length ?? 0) > 0 && (
                    <div>
                      <div className="text-xs text-gray-400 mb-2">Suppliers</div>
                      <div className="space-y-2">
                        {data.suppliers!.map((s: { id: string; supplierName: string; packSize: string | null; packUnit: string | null; costPerUnit: string | null; supplierWebsiteUrl: string | null; isPreferred: boolean }) => (
                          <div key={s.id} className="flex items-start gap-2 text-xs text-gray-700">
                            <ChevronRight size={10} className="text-gray-300 mt-0.5 shrink-0" />
                            <div>
                              <span className="font-medium">{s.supplierName}</span>
                              {s.isPreferred && <span className="ml-1 text-yellow-500">★</span>}
                              {(s.packSize || s.costPerUnit) && (
                                <div className="text-gray-400 mt-0.5">
                                  {s.packSize && s.packUnit && `${parseFloat(s.packSize)} ${s.packUnit}`}
                                  {s.packSize && s.costPerUnit && ' · '}
                                  {s.costPerUnit && `$${parseFloat(s.costPerUnit).toFixed(2)} / ${s.packUnit || 'unit'}`}
                                </div>
                              )}
                              {s.supplierWebsiteUrl && (
                                <a href={s.supplierWebsiteUrl} target="_blank" rel="noopener noreferrer"
                                  className="text-blue-500 hover:underline flex items-center gap-0.5 mt-0.5">
                                  <ExternalLink size={9} />
                                  {new URL(s.supplierWebsiteUrl).hostname.replace(/^www\./, '')}
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Suppliers tab ── */}
              {tab === 'suppliers' && (
                <div className="p-5 space-y-3">
                  {(data.suppliers?.length ?? 0) === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-400 mb-1">No suppliers linked yet.</p>
                      <a
                        href={`/ingredients/${ingredientId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline"
                      >
                        Add on the ingredient page →
                      </a>
                    </div>
                  ) : (
                    data.suppliers!.map((s: { id: string; supplierName: string; packSize: string | null; packUnit: string | null; costPerUnit: string | null; supplierWebsiteUrl: string | null; isPreferred: boolean }) => (
                      <div key={s.id} className="border border-gray-100 rounded-lg px-4 py-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm font-medium text-gray-800">{s.supplierName}</span>
                          {s.isPreferred && (
                            <span className="text-yellow-400 text-xs">★</span>
                          )}
                          {s.supplierWebsiteUrl && (
                            <a
                              href={s.supplierWebsiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-auto flex items-center gap-0.5 text-xs text-blue-500 hover:underline"
                            >
                              <ExternalLink size={10} />
                              {new URL(s.supplierWebsiteUrl).hostname.replace(/^www\./, '')}
                            </a>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 mt-1.5">
                          {s.packSize && s.packUnit && (
                            <div>
                              <span className="text-gray-400">Pack size</span>
                              <div className="font-medium text-gray-700">{parseFloat(s.packSize)} {s.packUnit}</div>
                            </div>
                          )}
                          {s.costPerUnit && (
                            <div>
                              <span className="text-gray-400">Cost / unit</span>
                              <div className="font-medium text-green-700">${parseFloat(s.costPerUnit).toFixed(2)}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  <a
                    href={`/ingredients/${ingredientId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition-colors mt-1"
                  >
                    <ExternalLink size={10} /> Manage suppliers on ingredient page
                  </a>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-gray-100 px-5 py-3 flex items-center gap-2 bg-gray-50/50">
          {tab === 'nutrients' && !editingNutrients && !formulationLocked && (
            <button
              onClick={() => setEditingNutrients(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-md text-gray-600 hover:bg-white hover:border-blue-200 hover:text-blue-600 transition-colors"
            >
              <Sparkles size={11} /> Edit nutrients
            </button>
          )}
          {tab === 'nutrients' && editingNutrients && (
            <>
              <button
                onClick={handleSaveNutrients}
                disabled={saveNutrientsMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saveNutrientsMutation.isPending ? 'Saving…' : 'Save nutrients'}
              </button>
              <button
                onClick={cancelEditNutrients}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-md text-gray-600 hover:bg-white transition-colors"
              >
                Cancel
              </button>
            </>
          )}
          {!editingNutrients && data && (
            <button
              onClick={() => verifyMutation.mutate()}
              disabled={verifyMutation.isPending}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors ${
                data.verification === 'verified'
                  ? 'border-green-200 text-green-700 hover:bg-green-50'
                  : 'border-yellow-200 text-yellow-700 hover:bg-yellow-50'
              }`}
            >
              <Check size={11} />
              {data.verification === 'verified' ? 'Mark unverified' : 'Mark verified'}
            </button>
          )}
          <div className="flex-1" />
          {!formulationLocked && data && (
            <button
              onClick={() => onSwap(lineKey, data.name)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <ArrowLeftRight size={11} /> Swap ingredient
            </button>
          )}
        </div>
      </div>
    </>
  )
}
