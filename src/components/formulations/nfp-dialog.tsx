'use client'

import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Download, Printer, ChevronDown, ChevronUp, Save, Trash2, Eye, Scale } from 'lucide-react'
import { toast } from 'sonner'
import { format as formatDate } from 'date-fns'
import { NfpPanel } from './nfp-panel'
import type { NutrientResult } from '@/lib/formulation-calc'
import { buildNfpModel, STANDARD_NFP_NAMES, type ExtraNutrientInput, type NfpModel, type NfpOptions } from '@/lib/nfp-model'
import { declareDvPct, isDvTiered, ruleReferences } from '@/lib/fda-rounding'
import { nfpFileName } from '@/lib/download-name'

type Format = 'png' | 'jpg' | 'pdf'

// FDA 2020 Daily Values for the extended nutrient set. The standard NFP block
// pulls DVs straight from the `nutrients.dailyValueAmount` column (via the
// NutrientResult passed to the panel/canvas), but the extras picker needs to
// look up DVs by name from the same results array, so this map is the single
// source of truth for the extra section. If a row exists in `results` with a
// non-null `dailyValueAmount`, that value wins; otherwise this fallback is
// used. Update both the DB seed AND this map if the FDA changes a DV.
const EXTENDED_DV: Record<string, number> = {
  'Vitamin A': 900,
  'Vitamin C': 90,
  'Vitamin E': 15,
  'Vitamin K': 120,
  'Thiamin (B1)': 1.2,
  'Riboflavin (B2)': 1.3,
  'Niacin (B3)': 16,
  'Vitamin B6': 1.7,
  'Folate': 400,
  'Vitamin B12': 2.4,
  'Biotin': 30,
  'Pantothenic Acid (B5)': 5,
  'Phosphorus': 1250,
  'Iodine': 150,
  'Magnesium': 420,
  'Zinc': 11,
  'Selenium': 55,
  'Copper': 0.9,
  'Manganese': 2.3,
  'Chromium': 35,
  'Molybdenum': 45,
  'Chloride': 2300,
  'Choline': 550,
}

const CATEGORY_LABEL: Record<string, string> = {
  vitamins: 'Vitamins',
  minerals: 'Minerals',
  macros: 'Other macros',
  other: 'Phyto & other',
}
const CATEGORY_ORDER = ['vitamins', 'minerals', 'macros', 'other']

function fmtPreview(value: number, unit: string): string {
  if (unit === 'g') return `${value.toFixed(1)}g`
  if (value < 0.1) return `${value.toFixed(2)}${unit}`
  if (value < 10) return `${value.toFixed(1)}${unit}`
  return `${Math.round(value)}${unit}`
}

/**
 * Resolve the DV for an extras-picker nutrient, preferring the DB-sourced
 * dailyValueAmount on the result row and falling back to the hardcoded
 * EXTENDED_DV map for nutrients that don't have one set in the DB.
 */
function resolveDv(result: NutrientResult, fallback: number | undefined): number | null {
  if (result.dailyValueAmount != null && result.dailyValueAmount > 0) return result.dailyValueAmount
  if (fallback != null && fallback > 0) return fallback
  return null
}

type SavedPanel = {
  id: string
  name: string
  rulesVersion: string
  servingSizeG: string | null
  options: NfpOptions
  model: NfpModel
  createdAt: string
}

type Props = {
  formulationId: string
  formName: string
  version: number
  clientName: string | null
  servingSizeG: number | undefined
  batchSizeG: number
  results: NutrientResult[]
  defaultIngredients: string
  onClose: () => void
}

export function NfpDialog({
  formulationId,
  formName,
  version,
  clientName,
  servingSizeG,
  batchSizeG,
  results,
  defaultIngredients,
  onClose,
}: Props) {
  const queryClient = useQueryClient()
  const panelsKey = ['nfp-panels', formulationId]
  const [viewing, setViewing] = useState<SavedPanel | null>(null)
  const [saveName, setSaveName] = useState('')
  const [rulesOpen, setRulesOpen] = useState(false)
  const [format, setFormat] = useState<Format>('png')
  const [includeAllergen, setIncludeAllergen] = useState(false)
  const [allergenText, setAllergenText] = useState('')
  const [includeIngredients, setIncludeIngredients] = useState(false)
  const [ingredientText, setIngredientText] = useState(defaultIngredients)
  const [hideZeros, setHideZeros] = useState(false)
  const [showExtras, setShowExtras] = useState(false)
  const [extrasOpen, setExtrasOpen] = useState(false)
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)

  const usePerServing = !!servingSizeG

  const servingsPerContainer =
    servingSizeG && servingSizeG > 0 && batchSizeG > 0
      ? batchSizeG / servingSizeG
      : undefined

  // Nutrients available for the extras picker: non-standard, have a value
  const availableExtras = useMemo(() => {
    return results
      .filter(r => !STANDARD_NFP_NAMES.has(r.name))
      .filter(r => {
        const v = usePerServing ? (r.perServing ?? 0) : r.perFinished100g
        return v > 0
      })
      .sort((a, b) => {
        const oi = (x: NutrientResult) => CATEGORY_ORDER.indexOf(x.category === '' ? 'other' : x.category)
        return oi(a) - oi(b) || a.name.localeCompare(b.name)
      })
  }, [results, usePerServing])

  // Group by category for the picker UI
  const extrasByCategory = useMemo(() => {
    const groups: Record<string, NutrientResult[]> = {}
    for (const r of availableExtras) {
      const cat = r.category || 'other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(r)
    }
    return groups
  }, [availableExtras])

  // Selected extras, with their %DV basis, handed to the model builder
  const extraInputs = useMemo((): ExtraNutrientInput[] => {
    return availableExtras
      .filter(r => selectedExtras.has(r.name))
      .map(r => ({
        name: r.name,
        value: usePerServing ? (r.perServing ?? 0) : r.perFinished100g,
        unit: r.unit,
        category: r.category,
        dailyValue: resolveDv(r, EXTENDED_DV[r.name]),
      }))
  }, [availableExtras, selectedExtras, usePerServing])

  const liveModel = useMemo(
    () => buildNfpModel({
      servingSizeG,
      servingsPerContainer,
      results,
      hideZeros,
      extras: showExtras ? extraInputs : undefined,
      allergenStatement: includeAllergen ? allergenText : undefined,
      ingredientStatement: includeIngredients ? ingredientText : undefined,
    }),
    [servingSizeG, servingsPerContainer, results, hideZeros, showExtras, extraInputs,
      includeAllergen, allergenText, includeIngredients, ingredientText],
  )
  const activeModel = viewing ? viewing.model : liveModel

  const currentOptions = (): NfpOptions => ({
    hideZeros, showExtras, selectedExtras: [...selectedExtras],
    includeAllergen, allergenText, includeIngredients, ingredientText,
  })

  function restoreOptions(o: NfpOptions) {
    setHideZeros(o.hideZeros)
    setShowExtras(o.showExtras)
    setExtrasOpen(false)
    setSelectedExtras(new Set(o.selectedExtras))
    setIncludeAllergen(o.includeAllergen)
    setAllergenText(o.allergenText)
    setIncludeIngredients(o.includeIngredients)
    setIngredientText(o.ingredientText)
  }

  const { data: saved, isError: savedError } = useQuery<{ panels: SavedPanel[] }>({
    queryKey: panelsKey,
    queryFn: async () => {
      const r = await fetch(`/api/formulations/${formulationId}/nfp-panels`)
      if (!r.ok) throw new Error('Could not load saved panels')
      return r.json()
    },
  })
  const savedPanels = saved?.panels ?? []

  const saveMutation = useMutation({
    mutationFn: async () => {
      const name = saveName.trim() || `${formName} v${version} — ${formatDate(new Date(), 'MMM d, yyyy h:mm a')}`
      const r = await fetch(`/api/formulations/${formulationId}/nfp-panels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, servingSizeG: servingSizeG ?? null, options: currentOptions(), model: liveModel }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body.error ?? 'Could not save panel')
      return body.panel as SavedPanel
    },
    onSuccess: () => {
      setSaveName('')
      queryClient.invalidateQueries({ queryKey: panelsKey })
      toast.success(`Panel saved to v${version}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (panelId: string) => {
      const r = await fetch(`/api/formulations/${formulationId}/nfp-panels/${panelId}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Could not delete panel')
      return panelId
    },
    onSuccess: panelId => {
      if (viewing?.id === panelId) setViewing(null)
      queryClient.invalidateQueries({ queryKey: panelsKey })
      toast.success('Saved panel deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function toggleExtra(name: string) {
    setSelectedExtras(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  function toggleAllInCategory(cat: string, select: boolean) {
    const names = (extrasByCategory[cat] ?? []).map(r => r.name)
    setSelectedExtras(prev => {
      const next = new Set(prev)
      names.forEach(n => select ? next.add(n) : next.delete(n))
      return next
    })
  }

  async function handleDownload() {
    setDownloading(true)
    try {
      const { drawNfpToCanvas } = await import('./nfp-canvas')
      const canvas = drawNfpToCanvas({ model: activeModel })

      // "NFP_<formulation name>_<iteration>_<client name>_<date>"
      const fileName = nfpFileName({ formulationName: formName, iteration: version, clientName })

      if (format === 'pdf') {
        const { jsPDF } = await import('jspdf')
        const imgData = canvas.toDataURL('image/png')
        const pxToMm = 25.4 / (96 * 3)
        const w = canvas.width * pxToMm
        const h = canvas.height * pxToMm
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [w, h] })
        pdf.addImage(imgData, 'PNG', 0, 0, w, h)
        pdf.save(`${fileName}.pdf`)
      } else {
        const mime = format === 'jpg' ? 'image/jpeg' : 'image/png'
        const url = canvas.toDataURL(mime, format === 'jpg' ? 0.95 : undefined)
        const a = document.createElement('a')
        a.href = url
        a.download = `${fileName}.${format}`
        a.click()
      }

      toast.success('NFP panel downloaded')
    } catch (err) {
      console.error(err)
      toast.error('Download failed — please try again')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8 px-4 print:static print:bg-white print:p-0 print:overflow-visible">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl print:shadow-none print:rounded-none print:max-w-none">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 print:hidden">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Nutrition Facts Panel</h2>
            <p className="text-xs text-gray-400 mt-0.5">FDA 2020 standard format · rounded per 21 CFR 101.9</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 p-4 sm:p-6">
          {/* Left: options — scrollable independently so the preview is never inside an overflow container */}
          <div className="flex-1 space-y-5 min-w-0 overflow-y-auto max-h-[80vh] pr-1 print:hidden">

            {/* Format selector */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Download format
              </label>
              <div className="flex gap-2">
                {(['png', 'jpg', 'pdf'] as Format[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`px-4 py-1.5 text-xs rounded-md border font-semibold uppercase tracking-wide transition-colors ${
                      format === f
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Hide zero-value nutrients */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hideZeros}
                onChange={e => setHideZeros(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700">
                Hide nutrients that round to zero
              </span>
            </label>

            {/* Additional micro / phyto nutrients */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showExtras}
                  onChange={e => {
                    setShowExtras(e.target.checked)
                    if (e.target.checked) setExtrasOpen(true)
                    else { setSelectedExtras(new Set()); setExtrasOpen(false) }
                  }}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">
                  Include additional nutrients
                </span>
                {showExtras && selectedExtras.size > 0 && (
                  <span className="text-xs text-blue-600 font-medium">
                    {selectedExtras.size} selected
                  </span>
                )}
              </label>

              {showExtras && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Collapsible header */}
                  <button
                    onClick={() => setExtrasOpen(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <span>
                      {availableExtras.length === 0
                        ? 'No additional nutrients with data'
                        : `${availableExtras.length} nutrients available`}
                    </span>
                    {extrasOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>

                  {extrasOpen && availableExtras.length > 0 && (
                    <div className="max-h-56 overflow-y-auto divide-y divide-gray-100">
                      {CATEGORY_ORDER.filter(cat => extrasByCategory[cat]?.length).map(cat => {
                        const items = extrasByCategory[cat]
                        const allChecked = items.every(r => selectedExtras.has(r.name))
                        const someChecked = items.some(r => selectedExtras.has(r.name))
                        return (
                          <div key={cat}>
                            {/* Category header with select-all */}
                            <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50/80">
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                {CATEGORY_LABEL[cat] ?? cat}
                              </span>
                              <button
                                onClick={() => toggleAllInCategory(cat, !allChecked)}
                                className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
                              >
                                {allChecked ? 'Deselect all' : someChecked ? 'Select all' : 'Select all'}
                              </button>
                            </div>
                            {/* Individual nutrient rows */}
                            {items.map(r => {
                              const v = usePerServing ? (r.perServing ?? 0) : r.perFinished100g
                              const dv = resolveDv(r, EXTENDED_DV[r.name])
                              const dvStr = dv != null ? ` · ${declareDvPct(v, dv, isDvTiered(r.name, r.category)).declared}% DV` : ''
                              return (
                                <label
                                  key={r.name}
                                  className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedExtras.has(r.name)}
                                    onChange={() => toggleExtra(r.name)}
                                    className="rounded border-gray-300 shrink-0"
                                  />
                                  <span className="text-xs text-gray-700 flex-1">{r.name}</span>
                                  <span className="text-xs text-gray-400 tabular-nums shrink-0">
                                    {fmtPreview(v, r.unit)}{dvStr}
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Allergen statement */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={includeAllergen}
                  onChange={e => setIncludeAllergen(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">
                  Include allergen statement
                </span>
              </label>
              {includeAllergen && (
                <textarea
                  value={allergenText}
                  onChange={e => setAllergenText(e.target.value)}
                  placeholder="e.g. Milk, Wheat, Soy. May contain traces of Tree Nuts and Peanuts."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
              )}
            </div>

            {/* Ingredient statement */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={includeIngredients}
                  onChange={e => setIncludeIngredients(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">
                  Include ingredient statement
                </span>
              </label>
              {includeIngredients && (
                <>
                  <textarea
                    value={ingredientText}
                    onChange={e => setIngredientText(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Pre-populated by weight (descending). Edit label names as needed.
                  </p>
                </>
              )}
            </div>

            {/* Serving size warning */}
            {!servingSizeG && (
              <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md">
                <span className="text-amber-600 text-xs mt-0.5">⚠</span>
                <p className="text-xs text-amber-700">
                  No serving size set. Values shown per 100g. Set a serving size in the
                  formulation to see per-serving values.
                </p>
              </div>
            )}

            {/* Download / Print */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Download size={14} />
                {downloading ? 'Generating…' : `Download ${format.toUpperCase()}`}
              </button>
              <button
                onClick={() => {
                  // "Save as PDF" in the print dialog proposes the page title as the file name
                  const prevTitle = document.title
                  document.title = nfpFileName({ formulationName: formName, iteration: version, clientName })
                  window.addEventListener('afterprint', () => { document.title = prevTitle }, { once: true })
                  window.print()
                }}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                <Printer size={14} />
                Print
              </button>
            </div>

            {/* Save to this iteration */}
            <div className="border-t border-gray-100 pt-4 space-y-3 print:hidden">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Saved to v{version}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Panels saved here belong to this iteration only and are kept exactly as shown, even if
                  ingredient data changes later.
                </p>
              </div>

              {viewing ? (
                <div className="flex items-start gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
                  <Eye size={14} className="text-blue-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-blue-800">
                      Viewing a saved panel (FDA rules {viewing.rulesVersion}). Download and Print use this version.
                    </p>
                    <div className="flex gap-3 mt-1">
                      <button onClick={() => setViewing(null)} className="text-xs font-medium text-blue-700 hover:underline">
                        Back to live panel
                      </button>
                      <button
                        onClick={() => { restoreOptions(viewing.options); setViewing(null) }}
                        className="text-xs font-medium text-blue-700 hover:underline"
                      >
                        Reuse these settings
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    maxLength={120}
                    placeholder={`Name (optional) — e.g. Retail label ${formatDate(new Date(), 'MMM yyyy')}`}
                    className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors shrink-0"
                  >
                    <Save size={14} />
                    {saveMutation.isPending ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )}

              {savedError && <p className="text-xs text-red-600">Could not load saved panels.</p>}
              {saved && savedPanels.length === 0 && (
                <p className="text-xs text-gray-400">No panels saved for this iteration yet.</p>
              )}
              {savedPanels.length > 0 && (
                <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                  {savedPanels.map(p => (
                    <li
                      key={p.id}
                      className={`flex items-center gap-2 px-3 py-2 ${viewing?.id === p.id ? 'bg-blue-50' : 'bg-white'}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{p.name}</p>
                        <p className="text-xs text-gray-400">
                          {formatDate(new Date(p.createdAt), 'MMM d, yyyy h:mm a')} · {p.model.calories} cal
                          {p.servingSizeG ? ` · ${p.model.servingSizeText} serving` : ' · per 100g'}
                        </p>
                      </div>
                      <button
                        onClick={() => setViewing(p)}
                        title="View this saved panel"
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete saved panel "${p.name}"?`)) deleteMutation.mutate(p.id)
                        }}
                        disabled={deleteMutation.isPending}
                        title="Delete this saved panel"
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* FDA rounding rules reference */}
            <div className="border border-gray-200 rounded-lg overflow-hidden print:hidden">
              <button
                onClick={() => setRulesOpen(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="flex items-center gap-2"><Scale size={13} /> FDA rounding rules applied to this panel</span>
                {rulesOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              {rulesOpen && (
                <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                  {ruleReferences().map(r => (
                    <div key={r.id} className="px-3 py-2">
                      <p className="text-xs font-semibold text-gray-700">{r.title}</p>
                      <p className="text-[11px] text-gray-400">{r.citation}</p>
                      <ul className="mt-1 space-y-0.5">
                        {r.lines.map(l => <li key={l} className="text-xs text-gray-600">• {l}</li>)}
                      </ul>
                      {r.note && <p className="text-[11px] text-gray-400 mt-1">{r.note}</p>}
                    </div>
                  ))}
                  <p className="px-3 py-2 text-[11px] text-gray-400">
                    Amounts exactly halfway between increments round up. Rounding guidance is a reference;
                    confirm against current FDA regulations before printing a commercial label.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right: live preview */}
          <div className="shrink-0 print:mx-auto">
            <p className="text-xs text-gray-400 mb-3 print:hidden">
              {viewing ? `Saved panel — ${viewing.name}` : 'Preview'}
            </p>
            <div>
              <NfpPanel model={activeModel} />
            </div>
            <p className="text-xs text-gray-400 mt-3 max-w-[340px] print:hidden">
              Values are FDA-rounded. Hover (or tab to) a dotted value to see the rule that was applied.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
