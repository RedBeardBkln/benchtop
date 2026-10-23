'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Save } from 'lucide-react'
import { toast } from 'sonner'
import { readErrorMessage } from '@/lib/utils'
import { categoryOptions, subcategoryOptions, microCategoryOptions } from '@/lib/ingredient-categories'
import { TaxonomyField, useTaxonomy } from './taxonomy-field'

export type EditableIngredient = {
  id: string
  name: string
  stockG: string | null
  category: string | null
  subcategory: string | null
  microCategory: string | null
  onHand: boolean
}

interface EditIngredientDialogProps {
  ingredient: EditableIngredient | null
  onClose: () => void
}

const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400'

export function EditIngredientDialog({ ingredient, onClose }: EditIngredientDialogProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [stockG, setStockG] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [microCategory, setMicroCategory] = useState('')
  const [onHand, setOnHand] = useState(false)
  const taxonomy = useTaxonomy(!!ingredient)

  useEffect(() => {
    if (!ingredient) return
    setName(ingredient.name)
    setStockG(ingredient.stockG != null ? parseFloat(ingredient.stockG).toFixed(0) : '')
    setCategory(ingredient.category ?? '')
    setSubcategory(ingredient.subcategory ?? '')
    setMicroCategory(ingredient.microCategory ?? '')
    setOnHand(ingredient.onHand)
  }, [ingredient])

  const patchMutation = useMutation({
    mutationFn: (fields: Record<string, unknown>) =>
      fetch(`/api/ingredients/${ingredient?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      }).then(async r => {
        if (!r.ok) throw new Error(await readErrorMessage(r, 'Failed to update ingredient'))
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      if (ingredient) queryClient.invalidateQueries({ queryKey: ['ingredient', ingredient.id] })
      toast.success('Ingredient updated')
      onClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    patchMutation.mutate({
      name: trimmed,
      stockG: stockG.trim() === '' ? null : parseFloat(stockG),
      category: category.trim() || null,
      subcategory: category.trim() ? subcategory.trim() || null : null,
      microCategory: category.trim() ? microCategory.trim() || null : null,
      onHand,
    })
  }

  if (!ingredient) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 max-h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">Edit Ingredient</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Name</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Category</label>
            <TaxonomyField
              key={`cat-${ingredient.id}`}
              label="Category"
              value={category}
              onChange={setCategory}
              options={categoryOptions(taxonomy)}
              placeholder="New category"
              noneLabel="Uncategorized"
            />
          </div>
          {category.trim() && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Subcategory</label>
                <TaxonomyField
                  key={`sub-${ingredient.id}`}
                  label="Subcategory"
                  value={subcategory}
                  onChange={setSubcategory}
                  options={subcategoryOptions(taxonomy, category)}
                  placeholder="e.g. Tapioca"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Micro category</label>
                <TaxonomyField
                  key={`micro-${ingredient.id}`}
                  label="Micro category"
                  value={microCategory}
                  onChange={setMicroCategory}
                  options={microCategoryOptions(taxonomy, category, subcategory)}
                  placeholder="e.g. Native"
                />
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={onHand} onChange={e => setOnHand(e.target.checked)} className="rounded border-gray-300" />
            On hand in the lab
          </label>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Stock on hand (g)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                value={stockG}
                onChange={e => setStockG(e.target.value)}
                placeholder="—"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
              />
              <span className="text-sm text-gray-400">g</span>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || patchMutation.isPending}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save size={13} />
              {patchMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
