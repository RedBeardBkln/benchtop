'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, Upload, X } from 'lucide-react'
import { formatIngredientName } from '@/lib/ingredient-name'
import { categoryOptions, subcategoryOptions, microCategoryOptions } from '@/lib/ingredient-categories'
import { TaxonomyField, useTaxonomy } from '@/components/ingredients/taxonomy-field'

// Nutrients offered for typing in by hand (per 100 g)
export const MANUAL_NUTRIENTS = [
  { name: 'Energy',             unit: 'kcal' },
  { name: 'Protein',            unit: 'g'    },
  { name: 'Total Fat',          unit: 'g'    },
  { name: 'Total Carbohydrate', unit: 'g'    },
  { name: 'Dietary Fiber',      unit: 'g'    },
  { name: 'Total Sugars',       unit: 'g'    },
  { name: 'Sodium',             unit: 'mg'   },
] as const

/** What /api/ingredients/from-external returns for a new ingredient */
export type CreatedIngredient = {
  ingredientId: string
  ingredientName: string
  nutrients: Array<{ nutrientId: string; name: string; unit: string; category: string; amountPer100g: number }>
}

type NutrientRow = { name: string; unit: string; value: string }

const inputClass = 'w-full px-3 py-2.5 sm:py-1.5 text-base sm:text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-violet-500'
const labelClass = 'block text-xs font-medium text-gray-500 mb-1'

type ExistingMatch = { id: string; name: string }

/**
 * Adds a material that's in the lab but not yet in the library, then hands it back so the caller can link it.
 * Nutrients are typed in or read from a spec sheet / COA; the solver needs at least one. When the library
 * already has it (same name, brand and supplier), offers to link that one instead.
 */
export function NewLibraryIngredientPanel({ rawName, onCreated, onLinkExisting, onClose }: {
  rawName: string
  onCreated: (ingredient: CreatedIngredient) => void
  onLinkExisting: (ingredient: ExistingMatch) => void
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const taxonomy = useTaxonomy()
  const [name, setName] = useState(() => formatIngredientName(rawName))
  const [brandName, setBrandName] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [microCategory, setMicroCategory] = useState('')
  const [onHand, setOnHand] = useState(true)
  const [stockG, setStockG] = useState('')
  const [rows, setRows] = useState<NutrientRow[]>(() => MANUAL_NUTRIENTS.map(n => ({ name: n.name, unit: n.unit, value: '' })))
  const [fromDoc, setFromDoc] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [existing, setExisting] = useState<ExistingMatch | null>(null)

  function setValue(i: number, value: string) {
    setRows(prev => prev.map((r, j) => (j === i ? { ...r, value } : r)))
  }

  // Fill the nutrient fields from a spec sheet or COA; values it finds replace typed ones
  async function fillFromDoc(file: File) {
    setIsParsing(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('ingredientName', name || rawName)
      const r = await fetch('/api/ingredients/parse-doc', { method: 'POST', body: fd })
      const data = await r.json()
      if (!r.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not read the document')
      const found: Array<{ name: string; amountPer100g: number; unit: string }> = data.nutrients ?? []
      if (found.length === 0) { toast.error('No nutrition values found in that document'); return }
      setRows(prev => {
        const next = [...prev]
        for (const n of found) {
          const i = next.findIndex(r => r.name.toLowerCase() === n.name.toLowerCase())
          if (i >= 0) next[i] = { ...next[i], value: String(n.amountPer100g), unit: n.unit || next[i].unit }
          else next.push({ name: n.name, unit: n.unit, value: String(n.amountPer100g) })
        }
        return next
      })
      setFromDoc(true)
      toast.success(`Read ${found.length} nutrient value${found.length === 1 ? '' : 's'} — check them before saving`)
      if (data.unconvertible?.length) toast.warning(`Skipped — unit couldn't be converted: ${data.unconvertible.join(', ')}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setIsParsing(false)
    }
  }

  async function save() {
    if (!name.trim()) { toast.error('Enter a name'); return }
    const nutrients = rows
      .filter(r => r.value.trim() !== '' && Number.isFinite(Number(r.value)) && Number(r.value) >= 0)
      .map(r => ({ name: r.name, amountPer100g: Number(r.value), unit: r.unit }))
    if (nutrients.length === 0) {
      toast.error('Enter at least one nutrient value, or fill them from a spec sheet')
      return
    }
    const stock = stockG.trim() === '' ? undefined : Number(stockG)
    setExisting(null)
    setIsSaving(true)
    try {
      const r = await fetch('/api/ingredients/from-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          sourceType: fromDoc ? 'ai_extracted' : 'manual',
          nutrients,
          brandName: brandName.trim() || undefined,
          supplierName: supplierName.trim() || undefined,
          category: category.trim() || undefined,
          subcategory: category.trim() ? subcategory.trim() || undefined : undefined,
          microCategory: category.trim() ? microCategory.trim() || undefined : undefined,
          onHand,
          stockG: stock != null && Number.isFinite(stock) && stock >= 0 ? stock : undefined,
        }),
      })
      const data = await r.json()
      if (r.status === 409 && data.existing?.id) {
        setExisting({ id: data.existing.id, name: data.existing.name })
        return
      }
      if (!r.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not add the ingredient')
      if (data.unconvertible?.length) toast.warning(`Skipped — unit couldn't be converted: ${data.unconvertible.join(', ')}`)
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      onCreated(data as CreatedIngredient)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mt-2 bg-white border border-violet-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-violet-50 border-b border-violet-100">
        <span className="text-xs font-medium text-violet-700">Add to library &amp; link</span>
        <button type="button" onClick={onClose} aria-label="Close" className="p-1 -m-1 text-gray-400 hover:text-gray-600">
          <X size={14} />
        </button>
      </div>
      <div className="p-3 space-y-3">
        <div>
          <label className={labelClass}>Name</label>
          <input value={name} onChange={e => setName(e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Brand (optional)</label>
            <input value={brandName} onChange={e => setBrandName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Supplier (optional)</label>
            <input value={supplierName} onChange={e => setSupplierName(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Category</label>
          <TaxonomyField
            label="Category" value={category} onChange={setCategory}
            options={categoryOptions(taxonomy)} placeholder="New category" noneLabel="Uncategorized"
          />
        </div>
        {category.trim() && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Subcategory</label>
              <TaxonomyField
                label="Subcategory" value={subcategory} onChange={setSubcategory}
                options={subcategoryOptions(taxonomy, category)} placeholder="e.g. Tapioca"
              />
            </div>
            <div>
              <label className={labelClass}>Micro category</label>
              <TaxonomyField
                label="Micro category" value={microCategory} onChange={setMicroCategory}
                options={microCategoryOptions(taxonomy, category, subcategory)} placeholder="e.g. Native"
              />
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <label className="flex items-center gap-2 py-2 text-sm text-gray-700">
            <input type="checkbox" checked={onHand} onChange={e => setOnHand(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
            On hand in the lab
          </label>
          <div>
            <label className={labelClass}>Stock on hand (g, optional)</label>
            <input
              type="number" inputMode="decimal" min="0" step="any"
              value={stockG} onChange={e => setStockG(e.target.value)} placeholder="—"
              className={`${inputClass} tabular-nums`}
            />
          </div>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-medium text-gray-500">Nutrition per 100 g</p>
            <label className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-md cursor-pointer ${
              isParsing ? 'border-violet-200 text-violet-400' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
              {isParsing
                ? <div className="w-3 h-3 border border-violet-400 border-t-transparent rounded-full animate-spin" />
                : <Upload size={12} />}
              {isParsing ? 'Reading…' : 'Fill from spec sheet'}
              <input
                type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" disabled={isParsing}
                onChange={e => { const f = e.target.files?.[0]; if (f) fillFromDoc(f); e.target.value = '' }}
              />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {rows.map((r, i) => (
              <div key={r.name} className="flex items-center gap-2">
                <label htmlFor={`new-ing-n-${i}`} className="text-sm sm:text-xs text-gray-600 flex-1 min-w-0">{r.name}</label>
                <input
                  id={`new-ing-n-${i}`}
                  type="number" inputMode="decimal" min="0" step="any"
                  value={r.value} onChange={e => setValue(i, e.target.value)} placeholder="—"
                  className="w-24 px-2 py-2 sm:py-1 text-base sm:text-xs text-right border border-gray-200 rounded tabular-nums focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
                <span className="text-xs text-gray-400 w-8 shrink-0">{r.unit}</span>
              </div>
            ))}
          </div>
        </div>

        {existing && (
          <div className="p-3 rounded-md border border-amber-200 bg-amber-50 text-sm text-amber-900 space-y-2">
            <p>
              <span className="font-medium">{existing.name}</span> is already in your library
              {brandName.trim() || supplierName.trim() ? ' with this brand and supplier' : ''}.
            </p>
            <button
              type="button"
              onClick={() => onLinkExisting(existing)}
              className="w-full sm:w-auto px-3 py-2 sm:py-1 text-sm sm:text-xs bg-white border border-amber-300 rounded-md hover:bg-amber-100"
            >
              Link that one instead
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={save}
          disabled={isSaving || isParsing}
          className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {isSaving ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 size={13} />}
          Add to library &amp; link
        </button>
      </div>
    </div>
  )
}
