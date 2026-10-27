'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FileText, Link, Loader2, Upload, X } from 'lucide-react'
import { readErrorMessage } from '@/lib/utils'
import { discardStaged, uploadStaged } from '@/lib/upload-file'
import { Term } from '@/components/term'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  sourceType: z.enum(['manual', 'supplier']),
  naturallyDerived: z.boolean(),
  notes: z.string().max(2000).optional(),
  defaultCostPerKg: z.string().optional(),
  moisturePct: z.string().optional(),
  labelName: z.string().max(500).optional(),
  brandName: z.string().max(255).optional(),
  supplierName: z.string().max(255).optional(),
  itemCode: z.string().max(100).optional(),
})

type FormData = z.infer<typeof schema>

type ParsedNutrient = { name: string; amountPer100g: number; unit: string }

/** Nutrition read from an attached document, editable before saving (per 100 g, in the nutrient's unit) */
type DocNutrientRow = { nutrientId: string; name: string; unit: string; value: string }

type AttachedDoc = {
  file: File
  label: string
  /** Set once the upload has finished; the file waits in staging until the ingredient is saved */
  stagedPath: string | null
  status: 'uploading' | 'reading' | 'read' | 'failed'
  message: string | null
}

const docLabelFrom = (fileName: string) =>
  fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 255) || 'Spec sheet'

/** Nutrients the server left out because their unit couldn't be converted to the stored one. */
function warnUnconvertible(names: string[] | undefined) {
  if (names?.length) toast.warning(`Not saved — unit couldn't be converted: ${names.join(', ')}`)
}

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
  const [doc, setDoc] = useState<AttachedDoc | null>(null)
  const [docNutrients, setDocNutrients] = useState<DocNutrientRow[]>([])
  // Ignores a document's results once another one has been picked
  const docRun = useRef(0)

  const {
    register,
    handleSubmit,
    getValues,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      sourceType: 'manual',
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
      setDoc(null)
      setDocNutrients([])
    }
  }, [open, initialName, setValue])

  /** Close without saving: the staged document isn't needed any more */
  function cancel() {
    docRun.current++
    if (doc?.stagedPath) discardStaged(doc.stagedPath)
    setDoc(null)
    setDocNutrients([])
    onClose()
  }

  // Upload the document straight away and read its nutrition while the rest of the form is filled in
  async function attachDoc(file: File) {
    if (doc?.stagedPath) discardStaged(doc.stagedPath)
    const run = ++docRun.current
    const update = (patch: Partial<AttachedDoc>) => {
      if (docRun.current === run) setDoc(prev => (prev ? { ...prev, ...patch } : prev))
    }
    setDoc({ file, label: docLabelFrom(file.name), stagedPath: null, status: 'uploading', message: null })
    setDocNutrients([])

    let stagedPath: string
    try {
      stagedPath = await uploadStaged(file)
    } catch (err) {
      update({ status: 'failed', message: err instanceof Error ? err.message : 'Upload failed' })
      return
    }
    if (docRun.current !== run) { discardStaged(stagedPath); return }
    update({ stagedPath, status: 'reading' })

    try {
      const r = await fetch('/api/ingredients/parse-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stagedPath, ingredientName: getValues('name') ?? '', keep: true }),
      })
      const data = await r.json().catch(() => ({}))
      if (docRun.current !== run) return
      if (!r.ok) {
        const why = typeof data.error === 'string' ? data.error : 'Could not read the document'
        update({ status: 'read', message: `${why}. It will still be attached.` })
        return
      }
      const found: Array<{ nutrientId: string; name: string; unit: string; amountPer100g: number }> = data.nutrients ?? []
      setDocNutrients(found.map(n => ({ nutrientId: n.nutrientId, name: n.name, unit: n.unit, value: String(n.amountPer100g) })))
      setValue('sourceType', 'supplier')
      update({ status: 'read', message: null })
    } catch {
      update({ status: 'read', message: 'Could not read the document. It will still be attached.' })
    }
  }

  function removeDoc() {
    docRun.current++
    if (doc?.stagedPath) discardStaged(doc.stagedPath)
    setDoc(null)
    setDocNutrients([])
  }

  const docBusy = doc?.status === 'uploading' || doc?.status === 'reading'
  const docValues = docNutrients
    .filter(n => n.value.trim() !== '' && Number.isFinite(Number(n.value)) && Number(n.value) >= 0)
    .map(n => ({ nutrientId: n.nutrientId, amountPer100g: Number(n.value) }))


  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const r = await fetch('/api/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          defaultCostPerKg: data.defaultCostPerKg ? parseFloat(data.defaultCostPerKg) : undefined,
          moisturePct: data.moisturePct ? parseFloat(data.moisturePct) : undefined,
        }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Failed to add ingredient'))
      const { id } = (await r.json()) as { id: string }

      // The ingredient exists now; anything below that fails is reported but doesn't undo it
      const missed: string[] = []
      const label = doc ? doc.label.trim() || docLabelFrom(doc.file.name) : ''
      if (doc?.stagedPath) {
        const d = await fetch(`/api/ingredients/${id}/docs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stagedPath: doc.stagedPath, label }),
        }).catch(() => null)
        if (!d?.ok) missed.push('the document')
      }
      if (docValues.length > 0) {
        const n = await fetch(`/api/ingredients/${id}/nutrients`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: docValues.map(v => ({ ...v, sourceRef: `Parsed from: ${label}` })) }),
        }).catch(() => null)
        if (!n?.ok) missed.push('the nutrition')
      }
      return { id, missed, nutrientCount: missed.includes('the nutrition') ? 0 : docValues.length }
    },
    onSuccess: ({ id, missed, nutrientCount }) => {
      if (missed.length > 0) {
        toast.warning(`Ingredient added, but ${missed.join(' and ')} couldn’t be saved. Add ${missed.length > 1 ? 'them' : 'it'} on the ingredient’s page.`)
      } else {
        toast.success(nutrientCount > 0
          ? `Ingredient added with ${nutrientCount} nutrient value${nutrientCount === 1 ? '' : 's'}`
          : 'Ingredient added')
      }
      reset()
      // The staged file now belongs to the ingredient, so there's nothing to discard
      setDoc(null)
      setDocNutrients([])
      onCreated(id)
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
      warnUnconvertible(result.unconvertible)
      setUrlInput('')
      setUrlName('')
      setParsedNutrients(null)
      onCreated(result.ingredientId)
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
          <button onClick={cancel} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-gray-200 shrink-0">
          <button
            onClick={() => setMode('manual')}
            data-tip="Type the ingredient’s details in yourself. Attach a spec sheet or COA to read its nutrition, or add nutrition afterwards on its page."
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
            data-tip="Reads the main label nutrients from a supplier’s product web page."
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
                placeholder="e.g. Organic Rolled Oats"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.name && (
                <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
              )}
            </div>

            {/* Deck name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preferred name on <Term t="labelName">ingredient deck</Term>
              </label>
              <input
                {...register('labelName')}
                placeholder="e.g. Rolled Oats"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                How this ingredient should read on the label. Leave blank to use the name above.
              </p>
            </div>

            {/* Brand / supplier / item code */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand name</label>
                <input
                  {...register('brandName')}
                  placeholder="e.g. Supro"
                  data-tip="Part of what makes this entry unique: name, brand, supplier and item code together can’t match another ingredient."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <input
                  {...register('supplierName')}
                  placeholder="e.g. Univar"
                  data-tip="Plain text that helps tell this entry apart from others. To record a supplier’s price and pack size, link one on the ingredient’s Suppliers tab."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Item code</label>
                <input
                  {...register('itemCode')}
                  placeholder="Supplier SKU / item #"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Spec sheet / COA: attached to the ingredient and read for nutrition */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Spec sheet or COA <span className="font-normal text-gray-400">(optional)</span>
              </label>
              {!doc ? (
                <label
                  data-tip="Attach a spec sheet, COA or nutrition panel (PDF or image, up to 20 MB). It’s saved on the ingredient’s Documents and its nutrition is read for you to check."
                  className="flex items-center justify-center gap-2 px-3 py-3 text-sm text-gray-600 border border-dashed border-gray-300 rounded-md cursor-pointer hover:bg-gray-50"
                >
                  <Upload size={14} /> Attach a document and read its nutrition
                  <input
                    type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) attachDoc(f); e.target.value = '' }}
                  />
                </label>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
                    <FileText size={14} className="text-gray-400 shrink-0" />
                    <input
                      value={doc.label}
                      onChange={e => setDoc({ ...doc, label: e.target.value })}
                      aria-label="Document label"
                      data-tip="The name the document is saved under on the ingredient’s Documents tab."
                      className="flex-1 min-w-0 px-2 py-1 text-sm bg-white border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button type="button" onClick={removeDoc} aria-label="Remove document" data-tip="Don’t attach this document"
                      className="p-1 text-gray-400 hover:text-gray-700 shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                  {docBusy ? (
                    <p className="flex items-center gap-2 px-3 py-3 text-xs text-gray-500">
                      <Loader2 size={13} className="animate-spin" />
                      {doc.status === 'uploading' ? 'Uploading…' : 'Reading the nutrition…'}
                    </p>
                  ) : doc.status === 'failed' ? (
                    <p className="px-3 py-3 text-xs text-red-600">{doc.message} Remove it and try again.</p>
                  ) : docNutrients.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-gray-500">{doc.message ?? 'No nutrition found. The document will still be attached.'}</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 px-3 pt-2">
                        <span className="text-xs font-semibold text-gray-600">{docNutrients.length} nutrients found. Check them before saving.</span>
                        <span className="text-xs text-gray-400 shrink-0"><Term t="per100g">per 100 g</Term></span>
                      </div>
                      <div className="max-h-56 overflow-y-auto px-3 py-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                        {docNutrients.map((n, i) => (
                          <div key={n.nutrientId} className="flex items-center gap-2">
                            <label htmlFor={`doc-n-${i}`} className="text-xs text-gray-700 flex-1 min-w-0 truncate">{n.name}</label>
                            <input
                              id={`doc-n-${i}`}
                              type="number" inputMode="decimal" min="0" step="any"
                              value={n.value}
                              onChange={e => setDocNutrients(prev => prev.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
                              placeholder="—"
                              className="w-20 px-2 py-1 text-xs text-right border border-gray-200 rounded tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-xs text-gray-400 w-8 shrink-0">{n.unit}</span>
                          </div>
                        ))}
                      </div>
                      <p className="px-3 pb-2 text-xs text-gray-400">Clear a value to leave that nutrient out.</p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Source type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1"><Term t="source">Source type</Term></label>
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
              <label className="flex items-center gap-2.5 cursor-pointer" data-tip="Comes from a natural source. Formulations containing anything not naturally derived get flagged as synthetic.">
                <input type="checkbox" {...register('naturallyDerived')} className="rounded" />
                <span className="text-sm text-gray-700">Naturally derived</span>
              </label>
            </div>

            {/* Optional fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Term t="costPerKg">Cost / kg</Term> ($)
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
                <label className="block text-sm font-medium text-gray-700 mb-1"><Term t="moisturePct">Moisture %</Term></label>
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
                onClick={cancel}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={mutation.isPending || docBusy}
                data-tip={docBusy
                  ? 'Wait until the document has been read.'
                  : docValues.length > 0
                    ? 'Adds it to your ingredient library as Unverified, with the nutrition above and the document attached.'
                    : 'Adds it to your ingredient library as Unverified. Add its nutrition afterwards on its Nutrients tab.'}
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
                placeholder="e.g. Organic Rolled Oats"
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
                  aria-label="Supplier product URL"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleFetch}
                  disabled={!urlInput.trim() || fetching}
                  data-tip={!urlInput.trim() ? 'Paste a product page URL first.' : 'Reads the nutrition from that page for you to check. Some sites block this.'}
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
                  <span className="text-xs text-gray-400"><Term t="per100g">per 100 g</Term></span>
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
                onClick={cancel}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => urlMutation.mutate()}
                disabled={!urlName.trim() || !parsedNutrients || parsedNutrients.length === 0 || urlMutation.isPending}
                data-tip={!urlName.trim() ? 'Enter an ingredient name first.' : !parsedNutrients || parsedNutrients.length === 0 ? 'Fetch nutrition from a URL first.' : 'Adds it to your library with these nutrients, citing the page as their source.'}
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
