'use client'

import { useState, useRef } from 'react'
import { X, Camera, Loader2, Check, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

type ParsedIngredient = {
  name: string
  labelName: string | null
  isIsolateOrConcentrate: boolean
  naturallyDerived: boolean
  moisturePct: number | null
  notes: string | null
  nutrients: Array<{ nutrientId: string; amountPer100g: number }>
  allergens: string[]
  certs: string[]
  subIngredients: Array<{ position: number; name: string }>
}

type Step = 'upload' | 'analyzing' | 'review'

export function PhotoIngredientDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [step, setStep] = useState<Step>('upload')
  const [labelPhoto, setLabelPhoto] = useState<File | null>(null)
  const [panelPhoto, setPanelPhoto] = useState<File | null>(null)
  const [deckPhoto, setDeckPhoto] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedIngredient | null>(null)
  const [stockG, setStockG] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const labelRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLInputElement>(null)
  const deckRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep('upload')
    setLabelPhoto(null)
    setPanelPhoto(null)
    setDeckPhoto(null)
    setParsed(null)
    setStockG('')
    setIsSaving(false)
    if (labelRef.current) labelRef.current.value = ''
    if (panelRef.current) panelRef.current.value = ''
    if (deckRef.current) deckRef.current.value = ''
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleAnalyze() {
    if (!labelPhoto && !panelPhoto && !deckPhoto) {
      toast.error('Attach at least one photo')
      return
    }

    setStep('analyzing')

    // Compress photos client-side before upload — phone camera shots can be 8-15 MB,
    // which exceeds Vercel's 4.5 MB serverless request body limit.
    const compress = (file: File): Promise<File> =>
      new Promise(resolve => {
        const img = new Image()
        const url = URL.createObjectURL(file)
        img.onload = () => {
          URL.revokeObjectURL(url)
          const MAX = 2048
          let { width, height } = img
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round((height * MAX) / width); width = MAX }
            else { width = Math.round((width * MAX) / height); height = MAX }
          }
          const canvas = document.createElement('canvas')
          canvas.width = width; canvas.height = height
          canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
          let quality = 0.88
          const tryBlob = () => {
            canvas.toBlob(blob => {
              if (!blob) { resolve(file); return }
              if (blob.size <= 1.4 * 1024 * 1024 || quality < 0.3) {
                resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
              } else { quality -= 0.15; tryBlob() }
            }, 'image/jpeg', quality)
          }
          tryBlob()
        }
        img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
        img.src = url
      })

    try {
      const [label, panel, deck] = await Promise.all([
        labelPhoto ? compress(labelPhoto) : null,
        panelPhoto ? compress(panelPhoto) : null,
        deckPhoto  ? compress(deckPhoto)  : null,
      ])
      const fd = new FormData()
      if (label) fd.append('label_photo', label)
      if (panel) fd.append('panel_photo', panel)
      if (deck)  fd.append('deck_photo', deck)

      const r = await fetch('/api/ingredients/parse-photos', { method: 'POST', body: fd })
      const text = await r.text()
      let body: Record<string, unknown>
      try { body = JSON.parse(text) }
      catch { throw new Error(r.status === 413 ? 'Photos too large — try fewer or smaller images' : `Server error ${r.status}`) }
      if (!r.ok) throw new Error((body.error as string) ?? 'Parsing failed')
      setParsed(body as unknown as ParsedIngredient)
      setStep('review')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Parsing failed')
      setStep('upload')
    }
  }

  async function handleCreate() {
    if (!parsed) return
    setIsSaving(true)
    try {
      const r = await fetch('/api/ingredients/from-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...parsed,
          stockG: stockG ? parseFloat(stockG) : null,
        }),
      })
      const body = await r.json()
      if (!r.ok) throw new Error(body.error ?? 'Save failed')
      toast.success(`"${body.name}" added to inventory`)
      reset()
      onCreated(body.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Camera size={16} className="text-orange-500" />
            <h2 className="text-sm font-semibold text-gray-900">
              {step === 'upload' && 'Scan product photos'}
              {step === 'analyzing' && 'Analyzing photos…'}
              {step === 'review' && 'Review & confirm'}
            </h2>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        {/* Upload step */}
        {step === 'upload' && (
          <div className="px-5 py-5 space-y-5">
            <p className="text-xs text-gray-500">
              Attach up to 3 photos. AI will extract the ingredient name, nutritional data, and sub-ingredients.
            </p>

            {[
              { label: 'Product Label', ref: labelRef, file: labelPhoto, set: setLabelPhoto, key: 'label' },
              { label: 'Nutrition Facts Panel', ref: panelRef, file: panelPhoto, set: setPanelPhoto, key: 'panel' },
              { label: 'Ingredient Deck', ref: deckRef, file: deckPhoto, set: setDeckPhoto, key: 'deck' },
            ].map(slot => (
              <div key={slot.key} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${slot.file ? 'bg-green-400' : 'bg-gray-200'}`} />
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">{slot.label}</label>
                  <input
                    ref={slot.ref}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={e => slot.set(e.target.files?.[0] ?? null)}
                    className="text-sm text-gray-600 file:mr-3 file:px-3 file:py-1 file:rounded-md
                               file:border-0 file:text-xs file:bg-gray-100 file:text-gray-700
                               hover:file:bg-gray-200 file:cursor-pointer"
                  />
                  {slot.file && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {slot.file.name} · {(slot.file.size / 1024).toFixed(0)} KB
                    </p>
                  )}
                </div>
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={handleClose}
                className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleAnalyze}
                disabled={!labelPhoto && !panelPhoto && !deckPhoto}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-orange-500 text-white
                           rounded-md hover:bg-orange-600 disabled:opacity-40 transition-colors"
              >
                <Camera size={14} /> Analyze with AI
              </button>
            </div>
          </div>
        )}

        {/* Analyzing step */}
        {step === 'analyzing' && (
          <div className="px-5 py-12 flex flex-col items-center gap-4">
            <Loader2 size={32} className="text-orange-500 animate-spin" />
            <p className="text-sm text-gray-600">Reading photos with AI…</p>
            <p className="text-xs text-gray-400">This usually takes 5–10 seconds</p>
          </div>
        )}

        {/* Review step */}
        {step === 'review' && parsed && (
          <div className="px-5 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Name */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Product name</label>
              <input
                value={parsed.name}
                onChange={e => setParsed(p => p ? { ...p, name: e.target.value } : p)}
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {parsed.labelName && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Label name</label>
                <input
                  value={parsed.labelName ?? ''}
                  onChange={e => setParsed(p => p ? { ...p, labelName: e.target.value || null } : p)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Flags */}
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={parsed.isIsolateOrConcentrate}
                  onChange={e => setParsed(p => p ? { ...p, isIsolateOrConcentrate: e.target.checked } : p)}
                  className="rounded border-gray-300 text-blue-600" />
                Isolate/Concentrate
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={parsed.naturallyDerived}
                  onChange={e => setParsed(p => p ? { ...p, naturallyDerived: e.target.checked } : p)}
                  className="rounded border-gray-300 text-blue-600" />
                Naturally derived
              </label>
            </div>

            {/* Opening stock */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Opening stock (g)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={stockG}
                onChange={e => setStockG(e.target.value)}
                placeholder="Leave blank to disable tracking"
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400">
                Set an opening stock to enable inventory tracking for this ingredient.
              </p>
            </div>

            {/* Nutrients summary */}
            {parsed.nutrients.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-100 rounded-lg">
                <Check size={13} className="text-green-500 shrink-0" />
                <span className="text-xs text-green-700">
                  {parsed.nutrients.length} nutrients extracted — review on the ingredient detail page
                </span>
              </div>
            )}

            {/* Allergens */}
            {parsed.allergens.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-100 rounded-lg">
                <AlertTriangle size={13} className="text-orange-500 shrink-0" />
                <span className="text-xs text-orange-700">
                  Contains: {parsed.allergens.join(', ')}
                </span>
              </div>
            )}

            {/* Sub-ingredients count */}
            {parsed.subIngredients.length > 0 && (
              <div className="text-xs text-gray-500">
                {parsed.subIngredients.length} sub-ingredient{parsed.subIngredients.length !== 1 ? 's' : ''} detected
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50"
              >
                Re-scan
              </button>
              <button
                onClick={handleCreate}
                disabled={!parsed.name.trim() || isSaving}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white
                           rounded-md hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {isSaving ? 'Saving…' : 'Add to inventory'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
