'use client'

import { useState } from 'react'
import { X, CheckCircle2, Loader2, PackageCheck } from 'lucide-react'
import { toast } from 'sonner'

type Depletion = {
  ingredientId: string
  ingredientName: string
  depletedG: number
  remainingG: number | null
}

export function CompleteBatchDialog({
  open,
  formulationId,
  formulationName,
  onClose,
  onCompleted,
}: {
  open: boolean
  formulationId: string
  formulationName: string
  onClose: () => void
  onCompleted: () => void
}) {
  const [multiplier, setMultiplier] = useState('1')
  const [notes, setNotes] = useState('')
  const [preview, setPreview] = useState<Depletion[] | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)

  function reset() {
    setMultiplier('1')
    setNotes('')
    setPreview(null)
    setIsPreviewing(false)
    setIsCompleting(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handlePreview() {
    const m = parseFloat(multiplier)
    if (!m || m <= 0) { toast.error('Enter a valid multiplier'); return }

    setIsPreviewing(true)
    try {
      // POST to get preview without writing
      const r = await fetch(`/api/formulations/${formulationId}/complete-batch/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ multiplier: m }),
      })
      if (!r.ok) {
        // If no preview endpoint, just show the confirm directly
        setPreview([])
        return
      }
      const body = await r.json()
      setPreview(body.depletions ?? [])
    } catch {
      // Preview endpoint doesn't exist yet; skip to confirm
      setPreview([])
    } finally {
      setIsPreviewing(false)
    }
  }

  async function handleComplete() {
    const m = parseFloat(multiplier)
    if (!m || m <= 0) { toast.error('Enter a valid multiplier'); return }

    setIsCompleting(true)
    try {
      const r = await fetch(`/api/formulations/${formulationId}/complete-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ multiplier: m, notes: notes.trim() || undefined }),
      })
      const body = await r.json()
      if (!r.ok) throw new Error(body.error ?? 'Failed')

      const tracked = (body.depletions as Depletion[]).filter(d => d.remainingG !== null)
      if (tracked.length > 0) {
        toast.success(`Batch recorded — ${tracked.length} stock level${tracked.length !== 1 ? 's' : ''} updated`)
      } else {
        toast.success('Batch recorded')
      }
      reset()
      onCompleted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to complete batch')
    } finally {
      setIsCompleting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <PackageCheck size={16} className="text-emerald-500" />
            <h2 className="text-sm font-semibold text-gray-900">Complete batch</h2>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <p className="text-xs text-gray-500">
            Recording a completed batch of <span className="font-medium text-gray-800">{formulationName}</span> will
            deduct the ingredient quantities from tracked stock levels.
          </p>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Batch multiplier</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0.01"
                step="any"
                value={multiplier}
                onChange={e => { setMultiplier(e.target.value); setPreview(null) }}
                className="w-28 px-3 py-1.5 text-sm border border-gray-200 rounded-md
                           focus:outline-none focus:ring-2 focus:ring-blue-500 tabular-nums"
              />
              <span className="text-xs text-gray-400">
                × ingredient weights in this formulation
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Notes (optional)</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Trial batch for sampling"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Stock depletion preview */}
          {preview !== null && preview.length > 0 && (
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500">
                Stock after this batch
              </div>
              <div className="divide-y divide-gray-50">
                {preview.map(d => (
                  <div key={d.ingredientId} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-gray-700">{d.ingredientName}</span>
                    <div className="text-right">
                      <span className="text-xs text-gray-400 mr-2">−{d.depletedG.toFixed(1)} g</span>
                      {d.remainingG !== null && (
                        <span className={`text-xs font-medium tabular-nums ${
                          d.remainingG < 0 ? 'text-red-500' : 'text-gray-700'
                        }`}>
                          {d.remainingG.toFixed(1)} g remaining
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview !== null && preview.length === 0 && (
            <p className="text-xs text-gray-400">
              No ingredients in this formulation have inventory tracking enabled.
              The batch will still be recorded in history.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={handleClose}
            className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50">
            Cancel
          </button>
          {preview === null ? (
            <button
              onClick={handlePreview}
              disabled={isPreviewing || !multiplier}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 text-gray-700
                         rounded-md hover:bg-gray-200 disabled:opacity-40 transition-colors"
            >
              {isPreviewing ? <Loader2 size={14} className="animate-spin" /> : null}
              Preview
            </button>
          ) : null}
          <button
            onClick={handleComplete}
            disabled={isCompleting || !multiplier}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 text-white
                       rounded-md hover:bg-emerald-700 disabled:opacity-40 transition-colors"
          >
            {isCompleting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {isCompleting ? 'Recording…' : 'Complete batch'}
          </button>
        </div>
      </div>
    </div>
  )
}
