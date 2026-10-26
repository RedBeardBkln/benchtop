'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  X, ExternalLink, Check, ArrowLeftRight,
  ChevronRight, Sparkles,
} from 'lucide-react'
import type { IngredientDetail, Nutrient } from '@/lib/types'
import { readErrorMessage } from '@/lib/utils'
import { nutrientSourceFor, type NutrientEditSource } from '@/lib/nutrient-source'
import { GLOSSARY } from '@/lib/glossary'
import { Term } from '@/components/term'

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

type NutrientEdit = NutrientEditSource & {
  rowId?: string
}

export type IngredientProperties = { moisturePct?: number | null; densityGPerMl?: number | null }

const propInput = 'w-20 px-2 py-1 text-sm text-right border border-gray-200 rounded-md bg-white tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500'

/**
 * Moisture % and density, editable right in the panel: they drive dry-basis targets and volume
 * units in the formula. Each saves when you leave the box or press Enter.
 */
function PropertyFields({ moisturePct, densityGPerMl, disabledReason, saving, onSave }: {
  moisturePct: string | null
  densityGPerMl: string | null
  disabledReason: string | null
  saving: boolean
  onSave: (patch: IngredientProperties) => void
}) {
  const shown = (v: string | null) => (v != null ? String(parseFloat(v)) : '')
  const [moisture, setMoisture] = useState(shown(moisturePct))
  const [density, setDensity] = useState(shown(densityGPerMl))
  useEffect(() => { setMoisture(shown(moisturePct)) }, [moisturePct])
  useEffect(() => { setDensity(shown(densityGPerMl)) }, [densityGPerMl])

  const moistureVal = moisture.trim() === '' ? null : Number(moisture)
  const moistureBad = moistureVal != null && !(moistureVal >= 0 && moistureVal <= 100)
  const densityVal = density.trim() === '' ? null : Number(density)
  const densityBad = densityVal != null && !(densityVal > 0 && densityVal <= 100)

  function commit(field: 'moisture' | 'density') {
    if (field === 'moisture') {
      if (moistureBad) { setMoisture(shown(moisturePct)); toast.error('Moisture must be from 0 to 100%'); return }
      if (moistureVal !== (moisturePct != null ? parseFloat(moisturePct) : null)) onSave({ moisturePct: moistureVal })
    } else {
      if (densityBad) { setDensity(shown(densityGPerMl)); toast.error('Density must be greater than 0, up to 100 g/mL'); return }
      if (densityVal !== (densityGPerMl != null ? parseFloat(densityGPerMl) : null)) onSave({ densityGPerMl: densityVal })
    }
  }

  const disabled = !!disabledReason || saving
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-2.5 border-b border-gray-100 bg-gray-50/60">
      <label className="flex items-center gap-1.5 text-xs text-gray-500">
        <Term t="moisturePct">Moisture</Term>
        <input
          inputMode="decimal" value={moisture} disabled={disabled} placeholder="—"
          onChange={e => setMoisture(e.target.value)}
          onBlur={() => commit('moisture')}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          aria-label="Moisture %"
          data-tip={disabledReason ?? 'Water, as a % of the ingredient’s weight. Needed for dry-basis targets. Saves to the ingredient when you leave the box.'}
          className={`${propInput} ${moistureBad ? 'border-red-300' : moisturePct == null ? 'border-amber-300' : ''}`}
        />
        <span>%</span>
      </label>
      <label className="flex items-center gap-1.5 text-xs text-gray-500">
        <Term t="density">Density</Term>
        <input
          inputMode="decimal" value={density} disabled={disabled} placeholder="—"
          onChange={e => setDensity(e.target.value)}
          onBlur={() => commit('density')}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          aria-label="Density in g per mL"
          data-tip={disabledReason ?? 'Grams per millilitre (water is 1). Needed to show this ingredient in mL, cups or other volume units. Saves to the ingredient when you leave the box.'}
          className={`${propInput} ${densityBad ? 'border-red-300' : ''}`}
        />
        <span>g/mL</span>
      </label>
    </div>
  )
}

// fetch(...).then(okOrThrow('…')) — a refused change shows its error instead of looking like it worked
const okOrThrow = (fallback: string) => async (r: Response) => {
  if (!r.ok) throw new Error(await readErrorMessage(r, fallback))
}

export function IngredientSidePanel({
  ingredientId,
  lineKey,
  formulationLocked,
  canEditLibrary,
  onNutrientsSaved,
  onPropertiesSaved,
  onClose,
  onSwap,
}: {
  ingredientId: string
  lineKey: string
  formulationLocked: boolean
  /** Nutrient, allergen, cert and verification edits change the shared library ingredient */
  canEditLibrary: boolean
  /** Called after nutrients are saved, so the open formulation can pick up the new values */
  onNutrientsSaved?: (ingredientId: string) => void
  /** Called after moisture % or density is saved, so the open formulation can use it straight away */
  onPropertiesSaved?: (ingredientId: string, patch: IngredientProperties) => void
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
        ? {
            amount: String(parseFloat(existing.amountPer100g)),
            sourceRef: existing.sourceRef,
            originalAmount: String(parseFloat(existing.amountPer100g)),
            rowId: existing.id,
          }
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
      }).then(okOrThrow('Could not update verification')),
    onSuccess: () => { invalidate(); toast.success('Verification updated') },
    onError: (err: Error) => toast.error(err.message),
  })

  const savePropertiesMutation = useMutation({
    mutationFn: (patch: IngredientProperties) =>
      fetch(`/api/ingredients/${ingredientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }).then(okOrThrow('Could not save')),
    onSuccess: (_r, patch) => {
      invalidate()
      onPropertiesSaved?.(ingredientId, patch)
      toast.success('moisturePct' in patch ? 'Moisture saved' : 'Density saved')
    },
    onError: (err: Error) => toast.error(err.message),
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
      onNutrientsSaved?.(ingredientId)
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
      }).then(okOrThrow('Failed to update allergen')),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast.error(err.message),
  })

  const removeAllergenMutation = useMutation({
    mutationFn: (allergenId: string) =>
      fetch(`/api/ingredients/${ingredientId}/allergens/${allergenId}`, { method: 'DELETE' })
        .then(okOrThrow('Failed to update allergen')),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast.error(err.message),
  })

  const addCertMutation = useMutation({
    mutationFn: (cert: string) =>
      fetch(`/api/ingredients/${ingredientId}/certs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cert }),
      }).then(okOrThrow('Failed to update certification')),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast.error(err.message),
  })

  const removeCertMutation = useMutation({
    mutationFn: (certId: string) =>
      fetch(`/api/ingredients/${ingredientId}/certs/${certId}`, { method: 'DELETE' })
        .then(okOrThrow('Failed to update certification')),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast.error(err.message),
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
        const sourceRef = nutrientSourceFor(edit, globalSource)
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
                    <span className="text-gray-300"><Term t="labelName">Label</Term>: </span>{data.labelName}
                  </p>
                )}
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                  {data && (
                    <span data-tip={data.verification === 'verified' ? GLOSSARY.verified : GLOSSARY.unverified} className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
                      data.verification === 'verified'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {data.verification === 'verified' ? '✓ Verified' : '⚠ Unverified'}
                    </span>
                  )}
                  {data?.sourceType && (
                    <span data-tip={GLOSSARY.source} className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500 uppercase">
                      {data.sourceType}
                    </span>
                  )}
                  {data?.fdcId && (
                    <a
                      href={`https://fdc.nal.usda.gov/food-details/${data.fdcId}/nutrients`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-xs text-blue-500 hover:underline"
                      data-tip="Opens this food’s USDA FoodData Central page in a new tab."
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
                aria-label="Open full ingredient page"
                data-tip="Opens this ingredient’s full page in a new tab, with documents, suppliers, cost and stock."
                className="p-1.5 text-gray-400 hover:text-blue-500 rounded hover:bg-gray-100 transition-colors"
              >
                <ExternalLink size={15} />
              </a>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {data && (
          <PropertyFields
            moisturePct={data.moisturePct}
            densityGPerMl={data.densityGPerMl}
            disabledReason={!canEditLibrary ? 'You can view this but not edit the ingredient library.' : null}
            saving={savePropertiesMutation.isPending}
            onSave={patch => savePropertiesMutation.mutate(patch)}
          />
        )}

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
                          Default <Term t="sourceRef">source reference</Term> <span className="text-gray-400">(applies to all)</span>
                        </label>
                        <input
                          value={globalSource}
                          onChange={e => setGlobalSource(e.target.value)}
                          placeholder="e.g. USDA FDC 123456 / COA 2024-01"
                          data-tip="Saved with every value you add or change. Values you don’t touch keep the source they already had."
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
                                        aria-label={`${n.name} per 100 g (${n.unit})`}
                                        data-tip={`Amount per 100 g of the ingredient, in ${n.unit}. Clear it to remove the value.`}
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
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3"><Term t="allergen">Allergens</Term></h3>
                    <div className="flex flex-wrap gap-2">
                      {STANDARD_ALLERGENS.map(a => {
                        const active = activeAllergenNames.has(a)
                        return (
                          <button
                            key={a}
                            onClick={() => toggleAllergen(a)}
                            disabled={!canEditLibrary}
                            data-tip={!canEditLibrary
                              ? 'You have view-only access to the ingredient library.'
                              : active ? `Removes ${a} from this ingredient’s allergens.` : `Marks this ingredient as containing ${a}. It feeds the allergen statement.`}
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
                            {canEditLibrary && <button onClick={() => removeAllergenMutation.mutate(a.id)} aria-label={`Remove ${a.allergen}`} data-tip={`Removes ${a.allergen} from this ingredient’s allergens.`} className="ml-0.5 hover:text-red-900">×</button>}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3"><Term t="certification">Certifications</Term></h3>
                    <div className="flex flex-wrap gap-2">
                      {STANDARD_CERTS.map(c => {
                        const active = activeCertNames.has(c)
                        return (
                          <button
                            key={c}
                            onClick={() => toggleCert(c)}
                            disabled={!canEditLibrary}
                            data-tip={!canEditLibrary
                              ? 'You have view-only access to the ingredient library.'
                              : active ? `Removes the ${c} certification.` : `Records that this ingredient is ${c}.`}
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
                        <div className="text-xs text-gray-400 mb-0.5"><Term t="labelName">Label statement</Term></div>
                        <div className="text-xs font-medium text-gray-800">{data.labelName}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5"><Term t="source">Source type</Term></div>
                      <div className="font-medium text-gray-800 uppercase text-xs">{data.sourceType}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5"><Term tip="Whether someone has checked this ingredient’s data against a reliable source.">Verification</Term></div>
                      <div className={`text-xs font-medium ${data.verification === 'verified' ? 'text-green-600' : 'text-yellow-600'}`}>
                        {data.verification === 'verified' ? '✓ Verified' : '⚠ Unverified'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5"><Term t="naturallyDerived">Naturally derived</Term></div>
                      <div className="text-xs font-medium text-gray-700">{data.naturallyDerived ? 'Yes' : 'No'}</div>
                    </div>
                    {data.fdcId && (
                      <div>
                        <div className="text-xs text-gray-400 mb-0.5"><Term t="fdcId">USDA FDC ID</Term></div>
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
                        <div className="text-xs text-gray-400 mb-0.5"><Term tip="The manually entered price per kg. A supplier price chosen on the Cost tab overrides it.">Cost / kg</Term></div>
                        <div className="text-xs font-medium text-gray-700">${parseFloat(data.defaultCostPerKg).toFixed(2)}</div>
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
                      <div className="text-xs text-gray-400 mb-1"><Term t="subIngredients">Sub-ingredients</Term></div>
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
                              {s.isPreferred && <span className="ml-1 text-yellow-500" data-tip={GLOSSARY.preferredSupplier} aria-label="Preferred supplier">★</span>}
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
                        data-tip="Opens the ingredient’s full page in a new tab, where you can link suppliers and prices."
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
                            <span className="text-yellow-400 text-xs" data-tip={GLOSSARY.preferredSupplier} aria-label="Preferred supplier">★</span>
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
                              <span className="text-gray-400"><Term t="packSize">Pack size</Term></span>
                              <div className="font-medium text-gray-700">{parseFloat(s.packSize)} {s.packUnit}</div>
                            </div>
                          )}
                          {s.costPerUnit && (
                            <div>
                              <span className="text-gray-400"><Term tip="The price for one unit (such as per kg or per bag), not for the whole pack.">Cost / unit</Term></span>
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
          {tab === 'nutrients' && !editingNutrients && !formulationLocked && canEditLibrary && (
            <button
              onClick={() => setEditingNutrients(true)}
              data-tip="Edit this ingredient’s nutrition per 100 g. Changes update the library ingredient everywhere it’s used."
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
                data-tip="Saves the values to the library ingredient. Every formulation that uses it picks up the change."
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
          {!editingNutrients && data && canEditLibrary && (
            <button
              onClick={() => verifyMutation.mutate()}
              disabled={verifyMutation.isPending}
              data-tip={data.verification === 'verified'
                ? 'Marks the data as not yet checked, so it shows ⚠ in formulations.'
                : 'Confirms you’ve checked this ingredient’s data against a reliable source, such as its spec sheet.'}
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
              data-tip="Replaces this ingredient in the formulation with a different one."
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
