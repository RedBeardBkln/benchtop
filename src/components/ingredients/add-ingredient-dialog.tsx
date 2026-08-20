'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, Link, Loader2, X } from 'lucide-react'
import { readErrorMessage } from '@/lib/utils'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  sourceType: z.enum(['manual', 'supplier']),
  isAbSpi: z.boolean(),
  isIsolateOrConcentrate: z.boolean(),
  naturallyDerived: z.boolean(),
  notes: z.string().max(2000).optional(),
  defaultCostPerKg: z.string().optional(),
  moisturePct: z.string().optional(),
})

type FormData = z.infer<typeof schema>

type ParsedNutrient = { name: string; amountPer100g: number; unit: string }

export function AddIngredientDialog({
  open,
  onClose,
  onCreated,
  initialName = '',
}: {
  open: boolean
  onClose: () => void
  onCreated: (id?: string) => void
  initialName?: string
}) {
  const [mode, setMode] = useState<'manual' | 'url'>('manual')
  const [urlInput, setUrlInput] = useState('')
  const [urlName, setUrlName] = useState('')
  const [parsedNutrients, setParsedNutrients] = useState<ParsedNutrient[] | null>(null)
  const [fetching, setFetching] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      sourceType: 'manual',
      isAbSpi: false,
      isIsolateOrConcentrate: false,
      naturallyDerived: true,
    },
  })

  useEffect(() => {
    if (open) {
      setValue('name', initialName)
      setUrlName(initialName)
      setMode('manual')
      setUrlInput('')
      setParsedNutrients(null)
    }
  }, [open, initialName, setValue])

  const isConcentrate = watch('isIsolateOrConcentrate')
  const isAbSpi = watch('isAbSpi')

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      fetch('/api/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          defaultCostPerKg: data.defaultCostPerKg ? parseFloat(data.defaultCostPerKg) : undefined,
          moisturePct: data.moisturePct ? parseFloat(data.moisturePct) : undefined,
        }),
      }).then(async r => {
        if (!r.ok) throw new Error(await readErrorMessage(r, 'Failed to add ingredient'))
        return r.json()
      }),
    onSuccess: (result) => {
      toast.success('Ingredient added')
      reset()
      onCreated(result.id)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const urlMutation = useMutation({
    mutationFn: () =>
      fetch('/api/ingredients/from-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: urlName.trim(),
          sourceType: 'supplier',
          sourceUrl: urlInput.trim(),
          nutrients: parsedNutrients,
        }),
      }).then(async r => {
        if (!r.ok) throw new Error(await readErrorMessage(r, 'Failed to add ingredient'))
        return r.json()
      }),
    onSuccess: (result) => {
      toast.success('Ingredient added from URL')
      setUrlInput('')
      setUrlName('')
      setParsedNutrients(null)
      onCreated(result.id)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  async function handleFetch() {
    if (!urlInput.trim()) return
    setFetching(true)
    setParsedNutrients(null)
    try {
      const res = await fetch('/api/ingredients/parse-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim(), ingredientName: urlName.trim() || undefined }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Failed to parse URL')
      setParsedNutrients(body.nutrients ?? [])
      if (body.nutrients?.length === 0) toast.warning('No nutrients found at that URL')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch URL')
    } finally {
      setFetching(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Add ingredient</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-gray-200 shrink-0">
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              mode === 'manual'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Manual entry
          </button>
          <button
            onClick={() => setMode('url')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              mode === 'url'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Link size={13} />
            From supplier URL
          </button>
        </div>

        {mode === 'manual' ? (
          <form
            onSubmit={handleSubmit(data => mutation.mutate(data))}
            className="px-6 py-5 space-y-4 overflow-y-auto"
          >
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                {...register('name')}
                placeholder="e.g. Soy Protein Isolate (AB SPI)"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.name && (
                <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
              )}
            </div>

            {/* Source type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source type</label>
              <select
                {...register('sourceType')}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                           focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="manual">Manual (user-entered)</option>
                <option value="supplier">Supplier (COA / spec sheet)</option>
              </select>
            </div>

            {/* Flags */}
            <div className="space-y-2.5">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" {...register('isAbSpi')} className="rounded" />
                <span className="text-sm text-gray-700">
                  This is <strong>AB Soy Protein Isolate</strong>
                </span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" {...register('isIsolateOrConcentrate')} className="rounded" />
                <span className="text-sm text-gray-700">Isolate or concentrate (non-AB)</span>
              </label>

              {isConcentrate && !isAbSpi && (
                <div className="flex items-start gap-2 bg-red-50 text-red-700 text-xs rounded-md p-3">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>
                    Non-AB isolates/concentrates are blocked by formulation validation. You can add
                    this ingredient but it will trigger a warning in any formulation that uses it.
                  </span>
                </div>
              )}

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" {...register('naturallyDerived')} className="rounded" />
                <span className="text-sm text-gray-700">Naturally derived</span>
              </label>
            </div>

            {/* Optional fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cost / kg ($)
                </label>
                <input
                  {...register('defaultCostPerKg')}
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Moisture %</label>
                <input
                  {...register('moisturePct')}
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                {...register('notes')}
                rows={2}
                placeholder="Optional — supplier info, lot number, grade, etc."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                           focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md
                           hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {mutation.isPending ? 'Adding…' : 'Add ingredient'}
              </button>
            </div>
          </form>
        ) : (
          <div className="px-6 py-5 space-y-4 overflow-y-auto">
            {/* Ingredient name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ingredient name <span className="text-red-500">*</span>
              </label>
              <input
                value={urlName}
                onChange={e => setUrlName(e.target.value)}
                placeholder="e.g. Pea Protein Isolate"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* URL input + fetch */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier product URL
              </label>
              <div className="flex gap-2">
                <input
                  value={urlInput}
                  onChange={e => { setUrlInput(e.target.value); setParsedNutrients(null) }}
                  placeholder="https://supplier.com/product/pea-protein"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleFetch}
                  disabled={!urlInput.trim() || fetching}
                  className="px-3 py-2 text-sm bg-gray-800 text-white rounded-md
                             hover:bg-gray-700 disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1.5"
                >
                  {fetching ? <Loader2 size={13} className="animate-spin" /> : null}
                  {fetching ? 'Fetching…' : 'Fetch nutrition'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                Claude will extract nutrition data from the page automatically.
              </p>
            </div>

            {/* Parsed nutrients preview */}
            {parsedNutrients !== null && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600">
                    {parsedNutrients.length} nutrients found
                  </span>
                  <span className="text-xs text-gray-400">per 100 g</span>
                </div>
                {parsedNutrients.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                    {parsedNutrients.map((n, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-1.5">
                        <span className="text-xs text-gray-700">{n.name}</span>
                        <span className="text-xs text-gray-500 tabular-nums">
                          {n.amountPer100g} {n.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="px-3 py-3 text-xs text-gray-400">
                    No nutrition data found. Try a different URL or use manual entry.
                  </p>
                )}
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => urlMutation.mutate()}
                disabled={!urlName.trim() || !parsedNutrients || parsedNutrients.length === 0 || urlMutation.isPending}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md
                           hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {urlMutation.isPending ? 'Adding…' : 'Add ingredient'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
