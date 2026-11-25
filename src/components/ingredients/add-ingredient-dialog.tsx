'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FileText, Link, Loader2, Upload, X } from 'lucide-react'
import { readErrorMessage } from '@/lib/utils'
import { discardStaged, uploadStaged } from '@/lib/upload-file'
import { categoryOptions, subcategoryOptions, microCategoryOptions } from '@/lib/ingredient-categories'
import { TaxonomyField, useTaxonomy } from './taxonomy-field'
import { Term } from '@/components/term'

const optionalNumber = (check: (n: number) => boolean, message: string) =>
  z.string().optional().refine(v => !v?.trim() || (Number.isFinite(Number(v)) && check(Number(v))), message)

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  sourceType: z.enum(['manual', 'supplier']),
  naturallyDerived: z.boolean(),
  notes: z.string().max(2000).optional(),
  defaultCostPerKg: z.string().optional(),
  moisturePct: optionalNumber(n => n >= 0 && n <= 100, 'Enter a number from 0 to 100.'),
  densityGPerMl: optionalNumber(n => n > 0 && n <= 100, 'Enter a number greater than 0, up to 100.'),
  labelName: z.string().max(500).optional(),
  brandName: z.string().max(255).optional(),
  supplierName: z.string().max(255).optional(),
  itemCode: z.string().max(100).optional(),
  category: z.string().max(120),
  subcategory: z.string().max(120),
  microCategory: z.string().max(120),
  onHand: z.boolean(),
  stockG: optionalNumber(n => n >= 0, 'Enter 0 or more grams.'),
})

type FormData = z.infer<typeof schema>

type ParsedNutrient = { name: string; amountPer100g: number; unit: string }

type DocNutrient = { nutrientId: string; name: string; unit: string; amountPer100g: number }

/** What /api/ingredients/parse-doc reads about the ingredient itself; null where the document doesn't say */
type DocInfo = {
  name: string | null
  labelName: string | null
  brandName: string | null
  supplierName: string | null
  itemCode: string | null
  moisturePct: number | null
  densityGPerMl: number | null
  category: string | null
  subcategory: string | null
  microCategory: string | null
}

type AttachedDoc = {
  key: number
  file: File
  label: string
  /** Set once the upload has finished; the file waits in staging until the ingredient is saved */
  stagedPath: string | null
  status: 'uploading' | 'reading' | 'read' | 'failed'
  message: string | null
  nutrients: DocNutrient[]
  info: DocInfo | null
}

const MAX_DOCS = 3

/** Form fields a document can fill in, with how they're named to the user */
const FILLABLE = {
  name: 'Name',
  labelName: 'Deck name',
  brandName: 'Brand',
  supplierName: 'Supplier',
  itemCode: 'Item code',
  moisturePct: 'Moisture',
  densityGPerMl: 'Density',
  category: 'Category',
  subcategory: 'Subcategory',
  microCategory: 'Micro category',
} as const satisfies Partial<Record<keyof FormData, string>>
type FillableField = keyof typeof FILLABLE

/** Which document filled a field, and with what, so removing that document can take it back out */
type Filled = Partial<Record<FillableField, { key: number; value: string }>>

const docLabelFrom = (fileName: string) =>
  fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 255) || 'Spec sheet'

const num = (v: string | undefined) => (v?.trim() ? Number(v) : undefined)

/** Nutrients the server left out because their unit couldn't be converted to the stored one. */
function warnUnconvertible(names: string[] | undefined) {
  if (names?.length) toast.warning(`Not saved — unit couldn't be converted: ${names.join(', ')}`)
}

const inputClass = `w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                    focus:outline-none focus:ring-2 focus:ring-blue-500`
const sectionClass = 'text-xs font-semibold uppercase tracking-wide text-gray-400'

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
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'manual' | 'url'>('manual')
  const [urlInput, setUrlInput] = useState('')
  const [urlName, setUrlName] = useState('')
  const [parsedNutrients, setParsedNutrients] = useState<ParsedNutrient[] | null>(null)
  const [fetching, setFetching] = useState(false)
  const [docs, setDocs] = useState<AttachedDoc[]>([])
  /** Nutrient values the user changed (or cleared), by nutrient id */
  const [nutrientEdits, setNutrientEdits] = useState<Record<string, string>>({})
  const [filled, setFilled] = useState<Filled>({})
  // Documents still attached; a removed one's results are ignored when they arrive
  const activeDocs = useRef(new Set<number>())
  const nextKey = useRef(0)
  const taxonomy = useTaxonomy(open)

  const {
    register,
    handleSubmit,
    getValues,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      sourceType: 'manual',
      naturallyDerived: true,
      category: '',
      subcategory: '',
      microCategory: '',
      onHand: false,
    },
  })
  const category = watch('category')
  const subcategory = watch('subcategory')
  const microCategory = watch('microCategory')

  useEffect(() => {
    if (open) {
      reset()
      setValue('name', initialName)
      setUrlName(initialName)
      setMode('manual')
      setUrlInput('')
      setParsedNutrients(null)
      activeDocs.current.clear()
      setDocs([])
      setNutrientEdits({})
      setFilled({})
    }
  }, [open, initialName, reset, setValue])

  /** Drop every attached document, and its staged upload unless the ingredient now owns it */
  function clearDocs(discard: boolean) {
    if (discard) for (const d of docs) if (d.stagedPath) discardStaged(d.stagedPath)
    activeDocs.current.clear()
    setDocs([])
    setNutrientEdits({})
    setFilled({})
  }

  /** Close without saving: the staged documents aren't needed any more */
  function cancel() {
    clearDocs(true)
    onClose()
  }

  const updateDoc = (key: number, patch: Partial<AttachedDoc>) => {
    if (activeDocs.current.has(key)) setDocs(prev => prev.map(d => (d.key === key ? { ...d, ...patch } : d)))
  }

  /** Fill the fields that are still empty from what a document says; returns what it filled */
  function applyInfo(key: number, info: DocInfo): Filled {
    const out: Filled = {}
    const fill = (f: FillableField, v: string | number | null) => {
      if (v == null || String(v).trim() === '') return
      const value = String(v)
      setValue(f, value)
      out[f] = { key, value }
    }
    const empty = (f: FillableField) => !String(getValues(f) ?? '').trim()
    for (const f of ['name', 'labelName', 'brandName', 'supplierName', 'itemCode', 'moisturePct', 'densityGPerMl'] as const) {
      if (empty(f)) fill(f, info[f])
    }
    // The classification goes in as a whole, and only when none has been picked yet
    if (empty('category') && info.category) {
      setValue('subcategory', '')
      setValue('microCategory', '')
      fill('category', info.category)
      fill('subcategory', info.subcategory)
      fill('microCategory', info.microCategory)
    }
    return out
  }

  // Upload each document straight away and read it while the rest of the form is filled in
  async function readDoc(key: number, file: File) {
    let stagedPath: string
    try {
      stagedPath = await uploadStaged(file)
    } catch (err) {
      updateDoc(key, { status: 'failed', message: err instanceof Error ? err.message : 'Upload failed' })
      return
    }
    if (!activeDocs.current.has(key)) { discardStaged(stagedPath); return }
    updateDoc(key, { stagedPath, status: 'reading' })

    try {
      const r = await fetch('/api/ingredients/parse-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stagedPath, ingredientName: getValues('name') ?? '', keep: true, info: true }),
      })
      const data = await r.json().catch(() => ({}))
      if (!activeDocs.current.has(key)) return
      if (!r.ok) {
        const why = typeof data.error === 'string' ? data.error.replace(/\.\s*$/, '') : 'Could not read the document'
        updateDoc(key, { status: 'read', message: `${why}. It will still be attached.` })
        return
      }
      const nutrients: DocNutrient[] = data.nutrients ?? []
      const info: DocInfo | null = data.info ?? null
      const got = info ? applyInfo(key, info) : {}
      setFilled(prev => ({ ...prev, ...got }))
      setValue('sourceType', 'supplier')
      updateDoc(key, { status: 'read', nutrients, info, message: null })
      if (nutrients.length > 0) warnUnconvertible(data.unconvertible)
    } catch {
      if (activeDocs.current.has(key)) updateDoc(key, { status: 'read', message: 'Could not read the document. It will still be attached.' })
    }
  }

  function attachDocs(files: File[]) {
    const room = MAX_DOCS - docs.length
    if (files.length > room) toast.warning(`Up to ${MAX_DOCS} documents. ${room > 0 ? `Only the first ${room} ${room === 1 ? 'was' : 'were'} added.` : ''}`.trim())
    const added = files.slice(0, Math.max(room, 0)).map(file => ({
      key: nextKey.current++, file, label: docLabelFrom(file.name),
      stagedPath: null, status: 'uploading' as const, message: null, nutrients: [], info: null,
    }))
    for (const d of added) activeDocs.current.add(d.key)
    setDocs(prev => [...prev, ...added])
    for (const d of added) readDoc(d.key, d.file)
  }

  function removeDoc(key: number) {
    const doc = docs.find(d => d.key === key)
    if (!doc) return
    activeDocs.current.delete(key)
    if (doc.stagedPath) discardStaged(doc.stagedPath)
    const remaining = docs.filter(d => d.key !== key)
    setDocs(remaining)

    // Take back what it filled in, unless it has been changed since; then let the others fill the gaps
    const next: Filled = {}
    for (const [f, src] of Object.entries(filled) as Array<[FillableField, NonNullable<Filled[FillableField]>]>) {
      if (src.key !== key) next[f] = src
      else if (String(getValues(f) ?? '') === src.value) setValue(f, '')
    }
    for (const d of remaining) if (d.info) Object.assign(next, applyInfo(d.key, d.info))
    setFilled(next)

    // Its nutrients drop out of the table (another document's reading of the same one shows instead)
    const supplied = new Set(nutrientRows.filter(n => n.docKey === key).map(n => n.nutrientId))
    setNutrientEdits(prev => Object.fromEntries(Object.entries(prev).filter(([id]) => !supplied.has(id))))
  }

  // One row per nutrient; the first document (in attach order) that has it supplies the value
  const nutrientRows = useMemo(() => {
    const seen = new Map<string, DocNutrient & { docKey: number }>()
    for (const d of docs) for (const n of d.nutrients) if (!seen.has(n.nutrientId)) seen.set(n.nutrientId, { ...n, docKey: d.key })
    return [...seen.values()].map(n => ({ ...n, value: nutrientEdits[n.nutrientId] ?? String(n.amountPer100g) }))
  }, [docs, nutrientEdits])

  const docBusy = docs.some(d => d.status === 'uploading' || d.status === 'reading')
  const docValues = nutrientRows
    .filter(n => n.value.trim() !== '' && Number.isFinite(Number(n.value)) && Number(n.value) >= 0)
    .map(n => ({ nutrientId: n.nutrientId, amountPer100g: Number(n.value), docKey: n.docKey }))
  const filledNames = (Object.keys(FILLABLE) as FillableField[]).filter(f => filled[f]).map(f => FILLABLE[f])

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const cat = data.category.trim()
      const r = await fetch('/api/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          sourceType: data.sourceType,
          naturallyDerived: data.naturallyDerived,
          notes: data.notes,
          labelName: data.labelName,
          brandName: data.brandName,
          supplierName: data.supplierName,
          itemCode: data.itemCode,
          defaultCostPerKg: data.defaultCostPerKg ? parseFloat(data.defaultCostPerKg) : undefined,
          moisturePct: num(data.moisturePct),
          densityGPerMl: num(data.densityGPerMl),
          stockG: num(data.stockG),
          onHand: data.onHand,
          category: cat || undefined,
          subcategory: cat ? data.subcategory.trim() || undefined : undefined,
          microCategory: cat ? data.microCategory.trim() || undefined : undefined,
        }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Failed to add ingredient'))
      const { id } = (await r.json()) as { id: string }

      // The ingredient exists now; anything below that fails is reported but doesn't undo it
      const missed: string[] = []
      const labels = new Map(docs.map(d => [d.key, d.label.trim() || docLabelFrom(d.file.name)]))
      const attached = await Promise.all(docs.filter(d => d.stagedPath).map(async d => {
        const res = await fetch(`/api/ingredients/${id}/docs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stagedPath: d.stagedPath, label: labels.get(d.key) }),
        }).catch(() => null)
        // It's added again from the ingredient's page, so the staged copy isn't needed
        if (!res?.ok) discardStaged(d.stagedPath!)
        return !!res?.ok
      }))
      const failedDocs = attached.filter(ok => !ok).length
      if (failedDocs > 0) missed.push(failedDocs === 1 ? 'a document' : `${failedDocs} documents`)
      if (docValues.length > 0) {
        const n = await fetch(`/api/ingredients/${id}/nutrients`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            values: docValues.map(({ docKey, ...v }) => ({ ...v, sourceRef: `Parsed from: ${labels.get(docKey)}` })),
          }),
        }).catch(() => null)
        if (!n?.ok) missed.push('the nutrition')
      }
      return { id, missed, nutrientCount: missed.includes('the nutrition') ? 0 : docValues.length }
    },
    onSuccess: ({ id, missed, nutrientCount }) => {
      if (missed.length > 0) {
        toast.warning(`Ingredient added, but ${missed.join(' and ')} couldn’t be saved. Add ${missed.length > 1 || missed[0].endsWith('documents') ? 'them' : 'it'} on the ingredient’s page.`)
      } else {
        toast.success(nutrientCount > 0
          ? `Ingredient added with ${nutrientCount} nutrient value${nutrientCount === 1 ? '' : 's'}`
          : 'Ingredient added')
      }
      // A new category or subcategory becomes an option
      queryClient.invalidateQueries({ queryKey: ['ingredients', 'taxonomy'] })
      reset()
      // The staged files now belong to the ingredient, so there's nothing to discard
      clearDocs(false)
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
      // Documents attached on the Manual tab aren't used by an ingredient added from a URL
      clearDocs(true)
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

  /** What a read document contributed, for its row */
  function docSummary(d: AttachedDoc) {
    const details = (Object.keys(FILLABLE) as FillableField[]).filter(f => filled[f]?.key === d.key).length
    const nutrients = nutrientRows.filter(n => n.docKey === d.key).length
    const parts = [
      details > 0 && `filled ${details} field${details === 1 ? '' : 's'}`,
      nutrients > 0 && `${nutrients} nutrient${nutrients === 1 ? '' : 's'}`,
    ].filter(Boolean)
    if (parts.length > 0) return `Read: ${parts.join(', ')}.`
    if (d.nutrients.length > 0 || d.info) return 'Read. Nothing new beyond the other documents.'
    return 'Nothing found to fill in. It will still be attached.'
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
            data-tip="Type the ingredient’s details in yourself, or attach its spec sheet, COA or nutrition panel to fill them in for you."
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
            {/* Documents: attached to the ingredient and read to fill in the form */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Spec sheets, COAs or nutrition panels <span className="font-normal text-gray-400">(optional, up to {MAX_DOCS})</span>
              </label>
              {docs.length > 0 && (
                <div className="mb-2 border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {docs.map(d => (
                    <div key={d.key} className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-gray-400 shrink-0" />
                        <input
                          value={d.label}
                          onChange={e => setDocs(prev => prev.map(x => (x.key === d.key ? { ...x, label: e.target.value } : x)))}
                          aria-label="Document label"
                          data-tip="The name the document is saved under on the ingredient’s Documents tab."
                          className="flex-1 min-w-0 px-2 py-1 text-sm bg-white border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button type="button" onClick={() => removeDoc(d.key)} aria-label="Remove document"
                          data-tip="Don’t attach this document. Fields it filled in are cleared unless you’ve changed them."
                          className="p-1 text-gray-400 hover:text-gray-700 shrink-0">
                          <X size={14} />
                        </button>
                      </div>
                      <p className={`mt-1 pl-6 text-xs ${d.status === 'failed' ? 'text-red-600' : 'text-gray-500'} flex items-center gap-1.5`}>
                        {d.status === 'uploading' || d.status === 'reading' ? (
                          <><Loader2 size={12} className="animate-spin" />{d.status === 'uploading' ? 'Uploading…' : 'Reading…'}</>
                        ) : d.status === 'failed' ? (
                          `${d.message} Remove it and try again.`
                        ) : (
                          d.message ?? docSummary(d)
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {docs.length < MAX_DOCS && (
                <label
                  data-tip={`Attach up to ${MAX_DOCS} documents (PDF or image, up to 20 MB each). They’re saved on the ingredient’s Documents tab, and read to fill in its name, supplier, item code, category and nutrition for you to check.`}
                  className="flex items-center justify-center gap-2 px-3 py-3 text-sm text-gray-600 border border-dashed border-gray-300 rounded-md cursor-pointer hover:bg-gray-50"
                >
                  <Upload size={14} />
                  {docs.length === 0 ? 'Attach documents to fill in the form' : 'Attach another document'}
                  <input
                    type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                    onChange={e => { const fs = Array.from(e.target.files ?? []); if (fs.length) attachDocs(fs); e.target.value = '' }}
                  />
                </label>
              )}
              {filledNames.length > 0 && (
                <p className="mt-1.5 text-xs text-blue-600">
                  Filled in from the documents: {filledNames.join(', ')}. Check them before saving.
                </p>
              )}
            </div>

            <p className={sectionClass}>Details</p>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input {...register('name')} placeholder="e.g. Organic Rolled Oats" className={inputClass} />
              {errors.name && (
                <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
              )}
            </div>

            {/* Deck name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preferred name on <Term t="labelName">ingredient deck</Term>
              </label>
              <input {...register('labelName')} placeholder="e.g. Rolled Oats" className={inputClass} />
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
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <input
                  {...register('supplierName')}
                  placeholder="e.g. Univar"
                  data-tip="Plain text that helps tell this entry apart from others. To record a supplier’s price and pack size, link one on the ingredient’s Suppliers tab."
                  className={inputClass}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Item code</label>
                <input {...register('itemCode')} placeholder="Supplier SKU / item #" className={inputClass} />
              </div>
            </div>

            <p className={`${sectionClass} pt-1`}>Classification and stock</p>

            {/* Category / subcategory / micro category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1"><Term t="category">Category</Term></label>
              <TaxonomyField
                label="Category"
                value={category}
                onChange={v => setValue('category', v)}
                options={categoryOptions(taxonomy)}
                placeholder="New category"
                noneLabel="Uncategorized"
              />
            </div>
            {category.trim() && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
                  <TaxonomyField
                    label="Subcategory"
                    value={subcategory}
                    onChange={v => setValue('subcategory', v)}
                    options={subcategoryOptions(taxonomy, category)}
                    placeholder="e.g. Tapioca"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Micro category</label>
                  <TaxonomyField
                    label="Micro category"
                    value={microCategory}
                    onChange={v => setValue('microCategory', v)}
                    options={microCategoryOptions(taxonomy, category, subcategory)}
                    placeholder="e.g. Native"
                  />
                </div>
              </div>
            )}

            {/* On hand / stock */}
            <div className="grid grid-cols-2 gap-3 items-end">
              <label className="flex items-center gap-2.5 cursor-pointer pb-2" data-tip="You physically have this ingredient in the lab. On-hand ingredients are listed first and suggested as swaps.">
                <input type="checkbox" {...register('onHand')} className="rounded" />
                <span className="text-sm text-gray-700">On hand in the lab</span>
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1"><Term t="stock">Stock on hand</Term> (g)</label>
                <input
                  {...register('stockG')}
                  type="number" step="0.1" min="0" placeholder="—"
                  data-tip="Grams you have now. Leave blank if you don’t track stock. Completing a batch subtracts what it used."
                  className={inputClass}
                />
              </div>
            </div>
            {errors.stockG && <p className="text-xs text-red-500 -mt-2">{errors.stockG.message}</p>}

            <p className={`${sectionClass} pt-1`}>Properties</p>

            {/* Source type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1"><Term t="source">Source type</Term></label>
              <select {...register('sourceType')} className={`${inputClass} bg-white`}>
                <option value="manual">Manual (user-entered)</option>
                <option value="supplier">Supplier (COA / spec sheet)</option>
              </select>
            </div>

            {/* Flags */}
            <label className="flex items-center gap-2.5 cursor-pointer" data-tip="Comes from a natural source. Formulations containing anything not naturally derived get flagged as synthetic.">
              <input type="checkbox" {...register('naturallyDerived')} className="rounded" />
              <span className="text-sm text-gray-700">Naturally derived</span>
            </label>

            {/* Cost / moisture / density */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Term t="costPerKg">Cost / kg</Term> ($)
                </label>
                <input {...register('defaultCostPerKg')} type="number" step="0.0001" min="0" placeholder="0.00" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1"><Term t="moisturePct">Moisture %</Term></label>
                <input {...register('moisturePct')} type="number" step="any" min="0" max="100" placeholder="0.00" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1"><Term t="density">Density</Term></label>
                <input
                  {...register('densityGPerMl')}
                  type="number" step="any" min="0" placeholder="g/mL"
                  data-tip="Grams per milliliter. Needed to show this ingredient’s amount in a formula in mL, cups, tsp or other volume units. Water is 1."
                  className={inputClass}
                />
              </div>
            </div>
            {(errors.moisturePct || errors.densityGPerMl) && (
              <p className="text-xs text-red-500 -mt-2">
                {errors.moisturePct ? `Moisture: ${errors.moisturePct.message}` : `Density: ${errors.densityGPerMl?.message}`}
              </p>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                {...register('notes')}
                rows={2}
                placeholder="Optional — supplier info, lot number, grade, etc."
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Nutrition read from the documents, editable before saving (per 100 g, in each nutrient's unit) */}
            {nutrientRows.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-600">
                    {nutrientRows.length} nutrients found. Check them before saving.
                  </span>
                  <span className="text-xs text-gray-400 shrink-0"><Term t="per100g">per 100 g</Term></span>
                </div>
                <div className="max-h-56 overflow-y-auto px-3 py-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                  {nutrientRows.map(n => (
                    <div key={n.nutrientId} className="flex items-center gap-2">
                      <label htmlFor={`doc-n-${n.nutrientId}`} className="text-xs text-gray-700 flex-1 min-w-0 truncate"
                        data-tip={docs.length > 1 ? `From ${docs.find(d => d.key === n.docKey)?.label ?? 'a document'}` : undefined}>
                        {n.name}
                      </label>
                      <input
                        id={`doc-n-${n.nutrientId}`}
                        type="number" inputMode="decimal" min="0" step="any"
                        value={n.value}
                        onChange={e => setNutrientEdits(prev => ({ ...prev, [n.nutrientId]: e.target.value }))}
                        placeholder="—"
                        className="w-20 px-2 py-1 text-xs text-right border border-gray-200 rounded tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-400 w-8 shrink-0">{n.unit}</span>
                    </div>
                  ))}
                </div>
                <p className="px-3 pb-2 text-xs text-gray-400">
                  Clear a value to leave that nutrient out.{docs.length > 1 ? ' Where documents disagree, the first one attached is used.' : ''}
                </p>
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
                type="submit"
                disabled={mutation.isPending || docBusy}
                data-tip={docBusy
                  ? 'Wait until the documents have been read.'
                  : docValues.length > 0
                    ? 'Adds it to your ingredient library as Unverified, with the nutrition above and the documents attached.'
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
                className={inputClass}
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
