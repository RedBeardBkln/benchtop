'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Save } from 'lucide-react'
import { toast } from 'sonner'

interface EditIngredientDialogProps {
  open: boolean
  ingredientId: string | null
  currentName: string
  currentStockG: string | null
  onClose: () => void
}

export function EditIngredientDialog({
  open, ingredientId, currentName, currentStockG, onClose,
}: EditIngredientDialogProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(currentName)
  const [stockG, setStockG] = useState(
    currentStockG != null ? parseFloat(currentStockG).toFixed(0) : ''
  )

  useEffect(() => {
    if (open) {
      setName(currentName)
      setStockG(currentStockG != null ? parseFloat(currentStockG).toFixed(0) : '')
    }
  }, [open, currentName, currentStockG])

  const patchMutation = useMutation({
    mutationFn: (fields: { name?: string; stockG?: number | null }) =>
      fetch(`/api/ingredients/${ingredientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      }).then(r => {
        if (!r.ok) throw new Error('Failed to update ingredient')
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      if (ingredientId) queryClient.invalidateQueries({ queryKey: ['ingredient', ingredientId] })
      toast.success('Ingredient updated')
      onClose()
    },
    onError: () => toast.error('Failed to update ingredient'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const stockVal = stockG.trim() === '' ? null : parseFloat(stockG)
    patchMutation.mutate({ name: trimmed, stockG: stockVal })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
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
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
              required
            />
          </div>
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
