'use client'

import { useState, useMemo } from 'react'
import { X, Download, Printer, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { NfpPanel } from './nfp-panel'
import type { ExtraNutrient } from './nfp-panel'
import type { NutrientResult } from '@/lib/formulation-calc'

type Format = 'png' | 'jpg' | 'pdf'

// Names already displayed in the standard NFP block — exclude from extras picker
const STANDARD_NFP_NAMES = new Set([
  'Energy',
  'Total Fat', 'Saturated Fat', 'Trans Fat', 'Polyunsaturated Fat', 'Monounsaturated Fat',
  'Cholesterol', 'Sodium',
  'Total Carbohydrate', 'Dietary Fiber', 'Total Sugars', 'Added Sugars',
  'Protein',
  'Vitamin D', 'Calcium', 'Iron', 'Potassium',
])

// FDA 2020 Daily Values for extended nutrients
const EXTENDED_DV: Record<string, number> = {
  'Vitamin A': 900,
  'Vitamin C': 90,
  'Vitamin E': 15,
  'Vitamin K': 120,
  'Thiamin': 1.2,
  'Riboflavin': 1.3,
  'Niacin': 16,
  'Vitamin B6': 1.7,
  'Folate': 400,
  'Vitamin B12': 2.4,
  'Biotin': 30,
  'Pantothenic Acid': 5,
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

type Props = {
  formName: string
  servingSizeG: number | undefined
  batchSizeG: number
  results: NutrientResult[]
  defaultIngredients: string
  onClose: () => void
}

export function NfpDialog({
  formName,
  servingSizeG,
  batchSizeG,
  results,
  defaultIngredients,
  onClose,
}: Props) {
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

  // Build the extras array that gets passed to the panel
  const extraNutrientsForPanel = useMemo((): ExtraNutrient[] => {
    return availableExtras
      .filter(r => selectedExtras.has(r.name))
      .map(r => {
        const value = usePerServing ? (r.perServing ?? 0) : r.perFinished100g
        const dv = EXTENDED_DV[r.name]
        return {
          name: r.name,
          value,
          unit: r.unit,
          dvPct: dv != null ? `${Math.round((value / dv) * 100)}%` : undefined,
        }
      })
  }, [availableExtras, selectedExtras, usePerServing])

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
      const canvas = drawNfpToCanvas({
        servingSizeG,
        servingsPerContainer,
        results,
        hideZeros,
        extraNutrients: showExtras ? extraNutrientsForPanel : undefined,
        allergenStatement: includeAllergen ? allergenText : undefined,
        ingredientStatement: includeIngredients ? ingredientText : undefined,
      })

      const slug = formName.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')
      const fileName = `${slug}_NFP`

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
            <p className="text-xs text-gray-400 mt-0.5">FDA 2020 standard format</p>
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
                Hide nutrients with zero value
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
                              const dv = EXTENDED_DV[r.name]
                              const dvStr = dv != null ? ` · ${Math.round((v / dv) * 100)}% DV` : ''
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
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                <Printer size={14} />
                Print
              </button>
            </div>
          </div>

          {/* Right: live preview */}
          <div className="shrink-0 print:mx-auto">
            <p className="text-xs text-gray-400 mb-3 print:hidden">Preview</p>
            <div>
              <NfpPanel
                servingSizeG={servingSizeG}
                servingsPerContainer={servingsPerContainer}
                results={results}
                hideZeros={hideZeros}
                extraNutrients={showExtras ? extraNutrientsForPanel : undefined}
                allergenStatement={includeAllergen ? allergenText : undefined}
                ingredientStatement={includeIngredients ? ingredientText : undefined}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
