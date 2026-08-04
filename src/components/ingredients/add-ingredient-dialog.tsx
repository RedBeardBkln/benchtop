'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, X } from 'lucide-react'

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
    if (open) setValue('name', initialName)
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
        if (!r.ok) throw new Error((await r.json()).error ?? 'Failed')
        return r.json()
      }),
    onSuccess: (result) => {
      toast.success('Ingredient added')
      reset()
      onCreated(result.id)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Add ingredient manually</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

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
      </div>
    </div>
  )
}
