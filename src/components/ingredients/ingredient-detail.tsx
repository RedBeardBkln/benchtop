'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft, ExternalLink, Check, AlertTriangle,
  Plus, X, Edit2, Save, Upload, FileText, Trash2, Eye, Sparkles, Truck, Star,
} from 'lucide-react'
import type { IngredientDetail as IngredientDetailType, Nutrient, Supplier, IngredientSupplierWithName } from '@/lib/types'

const PACK_UNITS = ['kg', 'g', 'lb', 'oz', 'mt', 'case', 'bag', 'drum', 'pail', 'each', 'L', 'gal']

const CATEGORY_ORDER = ['macros', 'vitamins', 'minerals', 'other'] as const

const STANDARD_ALLERGENS = [
  'Milk', 'Eggs', 'Fish', 'Shellfish', 'Tree Nuts',
  'Peanuts', 'Wheat', 'Soybeans', 'Sesame', 'Gluten',
]

const STANDARD_CERTS = [
  'Organic', 'Non-GMO', 'IP Non-GMO', 'Kosher', 'Halal',
  'Vegan', 'Gluten-Free', 'Fair Trade',
]

type Tab = 'nutrients' | 'allergens' | 'certs' | 'subs' | 'docs' | 'formulations' | 'suppliers' | 'inventory'

type InventoryData = {
  id: string
  name: string
  stockG: string | null
  depletions: Array<{
    runId: string
    runAt: string
    formulationId: string
    formulationName: string
    batchMultiplier: number
    depletedG: number
    notes: string | null
  }>
}

type SupplierLinkForm = {
  supplierId: string       // uuid or '__new__'
  newName: string
  newWebsite: string
  packSize: string
  packUnit: string
  costPerUnit: string
  isPreferred: boolean
}

type NutrientEdit = {
  amount: string    // '' = no value / delete if rowId exists
  sourceRef: string // '' = will use globalSource on save
  rowId?: string    // existing ingredient_nutrient row id
}

export function IngredientDetail({ id }: { id: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('nutrients')

  // ── Nutrient editing ──────────────────────────────────────────────────
  const [editingNutrients, setEditingNutrients] = useState(false)
  const [globalSource, setGlobalSource] = useState('')
  const [nutrientEdits, setNutrientEdits] = useState<Record<string, NutrientEdit>>({})
  const [isParsing, setIsParsing] = useState(false)
  const [parseDocId, setParseDocId] = useState('')
  const initDoneRef = useRef(false)

  // ── Name / label name editing ─────────────────────────────────────────
  const [editingName, setEditingName] = useState(false)
  const [nameEdit, setNameEdit] = useState('')
  const [editingLabelName, setEditingLabelName] = useState(false)
  const [labelNameEdit, setLabelNameEdit] = useState('')

  // ── Allergens ─────────────────────────────────────────────────────────
  const [allergenInput, setAllergenInput] = useState('')

  // ── Certs ─────────────────────────────────────────────────────────────
  const [certInput, setCertInput] = useState('')

  // ── Sub-ingredients ───────────────────────────────────────────────────
  const [editingSubs, setEditingSubs] = useState(false)
  const [subsText, setSubsText] = useState('')

  // ── Documents ─────────────────────────────────────────────────────────
  const [docLabel, setDocLabel] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Inventory ─────────────────────────────────────────────────────────
  const [editingStock, setEditingStock] = useState(false)
  const [stockEdit, setStockEdit] = useState('')

  // ── Suppliers ─────────────────────────────────────────────────────────
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null)
  const defaultLinkForm = (): SupplierLinkForm => ({
    supplierId: '', newName: '', newWebsite: '', packSize: '', packUnit: 'kg', costPerUnit: '', isPreferred: false,
  })
  const [linkForm, setLinkForm] = useState<SupplierLinkForm>(defaultLinkForm)

  // ── Queries ───────────────────────────────────────────────────────────
  const { data: inventoryData, refetch: refetchInventory } = useQuery<InventoryData>({
    queryKey: ['ingredient-inventory', id],
    queryFn: () => fetch(`/api/ingredients/${id}/inventory`).then(r => r.json()),
    enabled: activeTab === 'inventory',
  })

  const { data: allSuppliers } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => fetch('/api/suppliers').then(r => r.json()),
    enabled: activeTab === 'suppliers',
    staleTime: 60_000,
  })

  const { data, isLoading, error } = useQuery<IngredientDetailType>({
    queryKey: ['ingredient', id],
    queryFn: () =>
      fetch(`/api/ingredients/${id}`).then(r => {
        if (!r.ok) throw new Error('Not found')
        return r.json()
      }),
  })

  const { data: allNutrients } = useQuery<Nutrient[]>({
    queryKey: ['nutrients-all'],
    queryFn: () => fetch('/api/nutrients').then(r => r.json()),
    enabled: editingNutrients,
    staleTime: Infinity,
  })

  // Initialize nutrient edit state once allNutrients + data are both available
  useEffect(() => {
    if (!editingNutrients || !allNutrients || !data || initDoneRef.current) return
    initDoneRef.current = true
    const edits: Record<string, NutrientEdit> = {}
    for (const n of allNutrients) {
      const existing = data.nutrients.find(row => row.nutrientId === n.id)
      edits[n.id] = existing
        ? {
            amount: String(parseFloat(existing.amountPer100g)),
            sourceRef: existing.sourceRef,
            rowId: existing.id,
          }
        : { amount: '', sourceRef: '' }
    }
    setNutrientEdits(edits)
    setGlobalSource('')
  // data is intentionally excluded — we snapshot it at the moment allNutrients loads
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingNutrients, allNutrients])

  function cancelEditNutrients() {
    setEditingNutrients(false)
    initDoneRef.current = false
  }

  // ── Mutations ─────────────────────────────────────────────────────────
  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['ingredient', id] })
    queryClient.invalidateQueries({ queryKey: ['ingredients'] })
  }

  const verifyMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/ingredients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verification: data?.verification === 'verified' ? 'unverified' : 'verified',
        }),
      }).then(r => r.json()),
    onSuccess: () => { invalidate(); toast.success('Verification status updated') },
  })

  const patchIngredientMutation = useMutation({
    mutationFn: (fields: { name?: string; labelName?: string | null; stockG?: number | null }) =>
      fetch(`/api/ingredients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Save failed')
        return r.json()
      }),
    onSuccess: () => { invalidate(); toast.success('Saved') },
    onError: (err: Error) => toast.error(err.message),
  })

  const saveNutrientsMutation = useMutation({
    mutationFn: (payload: {
      values: Array<{ nutrientId: string; amountPer100g: number; sourceRef: string }>
      deleteIds: string[]
    }) =>
      fetch(`/api/ingredients/${id}/nutrients`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Save failed')
      }),
    onSuccess: () => {
      invalidate()
      cancelEditNutrients()
      toast.success('Nutrients saved')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const addAllergenMutation = useMutation({
    mutationFn: (allergen: string) =>
      fetch(`/api/ingredients/${id}/allergens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allergen }),
      }).then(r => r.json()),
    onSuccess: () => { invalidate(); setAllergenInput('') },
    onError: () => toast.error('Failed to add allergen'),
  })

  const removeAllergenMutation = useMutation({
    mutationFn: (allergenId: string) =>
      fetch(`/api/ingredients/${id}/allergens/${allergenId}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(),
    onError: () => toast.error('Failed to remove allergen'),
  })

  const addCertMutation = useMutation({
    mutationFn: (cert: string) =>
      fetch(`/api/ingredients/${id}/certs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cert }),
      }).then(r => r.json()),
    onSuccess: () => { invalidate(); setCertInput('') },
    onError: () => toast.error('Failed to add certification'),
  })

  const removeCertMutation = useMutation({
    mutationFn: (certId: string) =>
      fetch(`/api/ingredients/${id}/certs/${certId}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(),
    onError: () => toast.error('Failed to remove certification'),
  })

  const updateSubsMutation = useMutation({
    mutationFn: (names: string[]) =>
      fetch(`/api/ingredients/${id}/sub-ingredients`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names }),
      }).then(r => r.json()),
    onSuccess: () => {
      invalidate()
      setEditingSubs(false)
      toast.success('Sub-ingredients saved')
    },
    onError: () => toast.error('Failed to save sub-ingredients'),
  })

  const uploadDocMutation = useMutation({
    mutationFn: ({ file, label }: { file: File; label: string }) => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('label', label)
      return fetch(`/api/ingredients/${id}/docs`, { method: 'POST', body: fd }).then(async r => {
        const body = await r.json()
        if (!r.ok) throw new Error(body.error ?? 'Upload failed')
        return body
      })
    },
    onSuccess: row => {
      invalidate()
      setDocLabel('')
      setDocFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      toast.success(`Uploaded "${row.label}"`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteDocMutation = useMutation({
    mutationFn: (docId: string) =>
      fetch(`/api/ingredients/${id}/docs/${docId}`, { method: 'DELETE' }),
    onSuccess: () => { invalidate(); toast.success('Document deleted') },
    onError: () => toast.error('Failed to delete document'),
  })

  const addSupplierLinkMutation = useMutation({
    mutationFn: async (form: SupplierLinkForm) => {
      let supplierId = form.supplierId
      if (supplierId === '__new__') {
        const r = await fetch('/api/suppliers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.newName.trim(), websiteUrl: form.newWebsite.trim() || null }),
        })
        const s = await r.json()
        if (!r.ok) throw new Error(s.error ?? 'Failed to create supplier')
        supplierId = s.id
      }
      const r = await fetch(`/api/ingredients/${id}/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          packSize: form.packSize ? parseFloat(form.packSize) : null,
          packUnit: form.packUnit || null,
          costPerUnit: form.costPerUnit ? parseFloat(form.costPerUnit) : null,
          isPreferred: form.isPreferred,
        }),
      })
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to link supplier')
      return r.json()
    },
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      setShowAddSupplier(false)
      setLinkForm(defaultLinkForm())
      toast.success('Supplier linked')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateSupplierLinkMutation = useMutation({
    mutationFn: ({ linkId, form }: { linkId: string; form: SupplierLinkForm }) =>
      fetch(`/api/ingredients/${id}/suppliers/${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packSize: form.packSize ? parseFloat(form.packSize) : null,
          packUnit: form.packUnit || null,
          costPerUnit: form.costPerUnit ? parseFloat(form.costPerUnit) : null,
          isPreferred: form.isPreferred,
        }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error ?? 'Failed'); return r.json() }),
    onSuccess: () => {
      invalidate()
      setEditingLinkId(null)
      setLinkForm(defaultLinkForm())
      toast.success('Supplier updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const removeSupplierLinkMutation = useMutation({
    mutationFn: (linkId: string) =>
      fetch(`/api/ingredients/${id}/suppliers/${linkId}`, { method: 'DELETE' }),
    onSuccess: () => { invalidate(); toast.success('Supplier removed') },
    onError: () => toast.error('Failed to remove supplier'),
  })

  // ── Nutrient helpers ──────────────────────────────────────────────────
  function handleSaveNutrients() {
    const values: Array<{ nutrientId: string; amountPer100g: number; sourceRef: string }> = []
    const deleteIds: string[] = []

    for (const [nutrientId, edit] of Object.entries(nutrientEdits)) {
      if (edit.amount === '') {
        if (edit.rowId) deleteIds.push(edit.rowId)
      } else {
        const amount = parseFloat(edit.amount)
        if (isNaN(amount) || amount < 0) continue
        const sourceRef = edit.sourceRef || globalSource
        if (!sourceRef) {
          toast.error('Enter a source reference before saving')
          return
        }
        values.push({ nutrientId, amountPer100g: amount, sourceRef })
      }
    }

    saveNutrientsMutation.mutate({ values, deleteIds })
  }

  async function handleParseFromDoc() {
    if (!parseDocId) return
    setIsParsing(true)
    try {
      const r = await fetch(`/api/ingredients/${id}/parse-nutrients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: parseDocId }),
      })
      const result = await r.json()
      if (!r.ok) { toast.error(result.error ?? 'Parse failed'); return }

      setNutrientEdits(prev => {
        const updated = { ...prev }
        for (const p of result.parsed as Array<{ nutrientId: string; amountPer100g: number }>) {
          updated[p.nutrientId] = {
            amount: String(p.amountPer100g),
            sourceRef: `Parsed from: ${result.docLabel}`,
            rowId: updated[p.nutrientId]?.rowId,
          }
        }
        return updated
      })
      toast.success(`Parsed ${result.count} nutrients from "${result.docLabel}"`)
    } finally {
      setIsParsing(false)
    }
  }

  // ── Allergen / cert toggle helpers ────────────────────────────────────
  function toggleAllergen(allergen: string) {
    const existing = data?.allergens.find(a => a.allergen === allergen)
    if (existing) removeAllergenMutation.mutate(existing.id)
    else addAllergenMutation.mutate(allergen)
  }

  function toggleCert(cert: string) {
    const existing = data?.certs.find(c => c.cert === cert)
    if (existing) removeCertMutation.mutate(existing.id)
    else addCertMutation.mutate(cert)
  }

  async function openDoc(docId: string) {
    const r = await fetch(`/api/ingredients/${id}/docs/${docId}`)
    if (!r.ok) { toast.error('Could not get document URL'); return }
    const { signedUrl } = await r.json()
    window.open(signedUrl, '_blank', 'noopener,noreferrer')
  }

  // ── Render guards ─────────────────────────────────────────────────────
  if (isLoading) return <div className="px-8 py-8 text-sm text-gray-400">Loading…</div>

  if (error || !data) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm text-red-500">Ingredient not found.</p>
        <button onClick={() => router.back()} className="mt-2 text-sm text-blue-600 hover:underline">
          ← Back
        </button>
      </div>
    )
  }

  const nutrientsByCategory = CATEGORY_ORDER.map(cat => ({
    category: cat,
    nutrients: data.nutrients.filter(n => n.nutrient.category === cat),
  })).filter(g => g.nutrients.length > 0)

  const activeAllergenNames = new Set(data.allergens.map(a => a.allergen))
  const activeCertNames = new Set(data.certs.map(c => c.cert))
  const customAllergens = data.allergens.filter(a => !STANDARD_ALLERGENS.includes(a.allergen))
  const customCerts = data.certs.filter(c => !STANDARD_CERTS.includes(c.cert))

  return (
    <div className="px-8 py-8 max-w-5xl">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <ArrowLeft size={14} /> Ingredients
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1 min-w-0">
          {/* Editable ingredient name */}
          {editingName ? (
            <form
              className="flex items-center gap-2 mb-1"
              onSubmit={e => {
                e.preventDefault()
                const trimmed = nameEdit.trim()
                if (!trimmed) return
                patchIngredientMutation.mutate({ name: trimmed }, {
                  onSuccess: () => setEditingName(false),
                })
              }}
            >
              <input
                autoFocus
                value={nameEdit}
                onChange={e => setNameEdit(e.target.value)}
                className="text-2xl font-semibold text-gray-900 border-b-2 border-blue-500 outline-none bg-transparent w-full"
              />
              <button type="submit" disabled={!nameEdit.trim() || patchIngredientMutation.isPending}
                className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 shrink-0">
                <Save size={12} /> Save
              </button>
              <button type="button" onClick={() => setEditingName(false)}
                className="px-3 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50 shrink-0">
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2 group/name mb-1">
              <h1 className="text-2xl font-semibold text-gray-900">{data.name}</h1>
              <button
                onClick={() => { setNameEdit(data.name); setEditingName(true) }}
                className="opacity-0 group-hover/name:opacity-100 transition-opacity p-1 text-gray-400 hover:text-gray-700 rounded"
                title="Edit name"
              >
                <Edit2 size={14} />
              </button>
            </div>
          )}

          {/* Editable label name */}
          {editingLabelName ? (
            <form
              className="flex items-center gap-2 mb-2"
              onSubmit={e => {
                e.preventDefault()
                patchIngredientMutation.mutate(
                  { labelName: labelNameEdit.trim() || null },
                  { onSuccess: () => setEditingLabelName(false) },
                )
              }}
            >
              <input
                autoFocus
                value={labelNameEdit}
                onChange={e => setLabelNameEdit(e.target.value)}
                placeholder="Label statement (e.g. Isolated Soy Protein)"
                className="text-sm text-gray-600 border-b border-blue-400 outline-none bg-transparent w-full"
              />
              <button type="submit" disabled={patchIngredientMutation.isPending}
                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 shrink-0">
                <Save size={11} /> Save
              </button>
              <button type="button" onClick={() => setEditingLabelName(false)}
                className="px-2.5 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50 shrink-0">
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-1.5 group/label mb-2">
              {data.labelName ? (
                <span className="text-sm text-gray-500">
                  <span className="text-xs text-gray-400 mr-1">Label:</span>
                  {data.labelName}
                </span>
              ) : (
                <span className="text-xs text-gray-300 italic">No label name set</span>
              )}
              <button
                onClick={() => { setLabelNameEdit(data.labelName ?? ''); setEditingLabelName(true) }}
                className="opacity-0 group-hover/label:opacity-100 transition-opacity p-0.5 text-gray-400 hover:text-gray-700 rounded"
                title="Edit label name"
              >
                <Edit2 size={11} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
              data.verification === 'verified'
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {data.verification === 'verified' ? '✓ Verified' : '⚠ Unverified'}
            </span>
            <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 uppercase">
              {data.sourceType}
            </span>
            {data.isAbSpi && (
              <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                AB SPI
              </span>
            )}
            {data.isIsolateOrConcentrate && !data.isAbSpi && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                <AlertTriangle size={10} /> Isolate/Concentrate
              </span>
            )}
            {data.fdcId && (
              <a
                href={`https://fdc.nal.usda.gov/food-details/${data.fdcId}/nutrients`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline"
              >
                FDC {data.fdcId} <ExternalLink size={10} />
              </a>
            )}
          </div>
          {data.notes && <p className="mt-2 text-sm text-gray-500">{data.notes}</p>}
        </div>

        <button
          onClick={() => verifyMutation.mutate()}
          disabled={verifyMutation.isPending}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors ${
            data.verification === 'verified'
              ? 'border-green-200 text-green-700 hover:bg-green-50'
              : 'border-yellow-200 text-yellow-700 hover:bg-yellow-50'
          }`}
        >
          <Check size={12} />
          {data.verification === 'verified' ? 'Mark unverified' : 'Mark verified'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {([
          ['nutrients', `Nutrients (${data.nutrients.length})`],
          ['allergens', `Allergens (${data.allergens.length})`],
          ['certs', `Certifications (${data.certs.length})`],
          ['subs', `Sub-ingredients (${data.subIngredients?.length ?? 0})`],
          ['docs', `Documents (${data.docs?.length ?? 0})`],
          ['formulations', `Formulations (${data.formulations?.length ?? 0})`],
          ['suppliers', `Suppliers (${data.suppliers?.length ?? 0})`],
          ['inventory', 'Inventory'],
        ] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-500 text-blue-600 font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── NUTRIENTS ── */}
      {activeTab === 'nutrients' && (
        <div className="space-y-4">
          {!editingNutrients ? (
            /* Read mode */
            <>
              <div className="flex justify-end">
                <button
                  onClick={() => setEditingNutrients(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <Edit2 size={12} /> Edit nutrients
                </button>
              </div>

              {data.nutrients.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No nutrient data yet.
                  {data.sourceType === 'usda'
                    ? ' The USDA import should have populated this — check the FDC entry.'
                    : ' Click "Edit nutrients" to enter values from a spec sheet or COA.'}
                </p>
              ) : (
                <div className="space-y-6">
                  {nutrientsByCategory.map(({ category, nutrients: rows }) => (
                    <div key={category}>
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        {category}
                      </h3>
                      <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50 text-xs text-gray-500">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium">Nutrient</th>
                            <th className="px-4 py-2 text-right font-medium">Per 100 g</th>
                            <th className="px-4 py-2 text-right font-medium">Unit</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-400">Source</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {rows.map(n => (
                            <tr key={n.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 font-medium text-gray-800">{n.nutrient.name}</td>
                              <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                                {parseFloat(n.amountPer100g).toLocaleString(undefined, {
                                  maximumFractionDigits: 4,
                                })}
                              </td>
                              <td className="px-4 py-2 text-right text-gray-400">{n.nutrient.unit}</td>
                              <td className="px-4 py-2 text-xs text-gray-400">
                                {n.sourceUrl ? (
                                  <a href={n.sourceUrl} target="_blank" rel="noopener noreferrer"
                                    className="hover:underline text-blue-400">
                                    {n.sourceRef}
                                  </a>
                                ) : n.sourceRef}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Edit mode */
            <>
              {/* Edit header bar */}
              <div className="flex items-end gap-4 pb-4 border-b border-gray-100">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Source reference
                    <span className="font-normal text-gray-400 ml-1">
                      — applied to new or modified values
                    </span>
                  </label>
                  <input
                    value={globalSource}
                    onChange={e => setGlobalSource(e.target.value)}
                    placeholder="e.g. Supplier COA Q2-2024, USDA FDC 12345, Manual entry"
                    className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={cancelEditNutrients}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNutrients}
                    disabled={saveNutrientsMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 text-white
                               rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Save size={13} />
                    {saveNutrientsMutation.isPending ? 'Saving…' : 'Save nutrients'}
                  </button>
                </div>
              </div>

              {/* Parse from document row */}
              {(data.docs?.length ?? 0) > 0 && (
                <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                  <Sparkles size={13} className="text-emerald-500 shrink-0" />
                  <span className="text-xs text-gray-500">Parse from document:</span>
                  <select
                    value={parseDocId}
                    onChange={e => setParseDocId(e.target.value)}
                    className="text-sm border border-gray-200 rounded-md px-2 py-1
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select document…</option>
                    {data.docs?.map(doc => (
                      <option key={doc.id} value={doc.id}>{doc.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleParseFromDoc}
                    disabled={!parseDocId || isParsing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 text-white
                               rounded-md hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                  >
                    {isParsing ? 'Parsing…' : 'Parse with AI'}
                  </button>
                  <span className="text-xs text-gray-400">
                    Populates fields from a PDF or image spec sheet — values remain editable
                  </span>
                </div>
              )}

              {/* Nutrient edit table */}
              {!allNutrients ? (
                <div className="py-6 text-sm text-gray-400">Loading nutrient list…</div>
              ) : (
                <div className="space-y-6">
                  {CATEGORY_ORDER.map(cat => {
                    const rows = allNutrients.filter(n => n.category === cat)
                    if (rows.length === 0) return null
                    return (
                      <div key={cat}>
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                          {cat}
                        </h3>
                        <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
                          <thead className="bg-gray-50 text-xs text-gray-500">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium">Nutrient</th>
                              <th className="px-3 py-2 text-left font-medium w-14">Unit</th>
                              <th className="px-3 py-2 text-left font-medium w-36">Per 100 g</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-400">Source</th>
                              <th className="px-3 py-2 w-6" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {rows.map(n => {
                              const edit = nutrientEdits[n.id] ?? { amount: '', sourceRef: '' }
                              const hasValue = edit.amount !== ''
                              const sourceDisplay = edit.sourceRef
                                || (hasValue ? globalSource : '')

                              return (
                                <tr key={n.id} className={hasValue ? '' : 'opacity-60'}>
                                  <td className="px-3 py-1.5 text-xs font-medium text-gray-700">
                                    {n.name}
                                  </td>
                                  <td className="px-3 py-1.5 text-xs text-gray-400">{n.unit}</td>
                                  <td className="px-3 py-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      value={edit.amount}
                                      onChange={e =>
                                        setNutrientEdits(prev => ({
                                          ...prev,
                                          [n.id]: {
                                            ...prev[n.id],
                                            amount: e.target.value,
                                            // clear specific source so globalSource applies
                                            sourceRef: prev[n.id]?.rowId ? prev[n.id].sourceRef : '',
                                          },
                                        }))
                                      }
                                      placeholder="—"
                                      className="w-32 px-2 py-0.5 text-sm border border-gray-200 rounded
                                                 focus:outline-none focus:ring-1 focus:ring-blue-500 tabular-nums"
                                    />
                                  </td>
                                  <td className="px-3 py-1.5 text-xs">
                                    {hasValue && (
                                      sourceDisplay
                                        ? <span className="text-gray-400">{sourceDisplay}</span>
                                        : <span className="text-amber-500">← source needed above</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-1.5">
                                    {hasValue && (
                                      <button
                                        onClick={() =>
                                          setNutrientEdits(prev => ({
                                            ...prev,
                                            [n.id]: { ...prev[n.id], amount: '', sourceRef: '' },
                                          }))
                                        }
                                        className="text-gray-300 hover:text-red-400 transition-colors"
                                        title="Clear value"
                                      >
                                        <X size={13} />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── ALLERGENS ── */}
      {activeTab === 'allergens' && (
        <div className="space-y-4">
          <p className="text-xs text-gray-400">Click to declare or remove. Declared allergens are highlighted.</p>

          <div className="flex flex-wrap gap-2">
            {STANDARD_ALLERGENS.map(allergen => {
              const active = activeAllergenNames.has(allergen)
              return (
                <button
                  key={allergen}
                  onClick={() => toggleAllergen(allergen)}
                  disabled={addAllergenMutation.isPending || removeAllergenMutation.isPending}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    active
                      ? 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-600'
                  }`}
                >
                  {active && <span className="mr-1">✓</span>}{allergen}
                </button>
              )
            })}
          </div>

          {customAllergens.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Custom</p>
              <div className="flex flex-wrap gap-2">
                {customAllergens.map(a => (
                  <span key={a.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-orange-500 text-white">
                    {a.allergen}
                    <button onClick={() => removeAllergenMutation.mutate(a.id)} className="hover:opacity-70">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <form
            className="flex items-center gap-2"
            onSubmit={e => { e.preventDefault(); const v = allergenInput.trim(); if (v) addAllergenMutation.mutate(v) }}
          >
            <input
              value={allergenInput}
              onChange={e => setAllergenInput(e.target.value)}
              placeholder="Add custom allergen…"
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
            />
            <button
              type="submit"
              disabled={!allergenInput.trim() || addAllergenMutation.isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-40 transition-colors"
            >
              <Plus size={14} /> Add
            </button>
          </form>
        </div>
      )}

      {/* ── CERTIFICATIONS ── */}
      {activeTab === 'certs' && (
        <div className="space-y-4">
          <p className="text-xs text-gray-400">Click to add or remove certifications.</p>

          <div className="flex flex-wrap gap-2">
            {STANDARD_CERTS.map(cert => {
              const active = activeCertNames.has(cert)
              return (
                <button
                  key={cert}
                  onClick={() => toggleCert(cert)}
                  disabled={addCertMutation.isPending || removeCertMutation.isPending}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                  }`}
                >
                  {active && <span className="mr-1">✓</span>}{cert}
                </button>
              )
            })}
          </div>

          {customCerts.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Custom</p>
              <div className="flex flex-wrap gap-2">
                {customCerts.map(c => (
                  <span key={c.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-600 text-white">
                    {c.cert}
                    <button onClick={() => removeCertMutation.mutate(c.id)} className="hover:opacity-70">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <form
            className="flex items-center gap-2"
            onSubmit={e => { e.preventDefault(); const v = certInput.trim(); if (v) addCertMutation.mutate(v) }}
          >
            <input
              value={certInput}
              onChange={e => setCertInput(e.target.value)}
              placeholder="Add custom certification…"
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
            />
            <button
              type="submit"
              disabled={!certInput.trim() || addCertMutation.isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-40 transition-colors"
            >
              <Plus size={14} /> Add
            </button>
          </form>
        </div>
      )}

      {/* ── SUB-INGREDIENTS ── */}
      {activeTab === 'subs' && (
        <div className="space-y-4">
          {!editingSubs ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Declared sub-ingredient list (e.g. from label statement).</p>
                <button
                  onClick={() => { setSubsText((data.subIngredients ?? []).map(s => s.name).join('\n')); setEditingSubs(true) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <Edit2 size={12} /> Edit list
                </button>
              </div>
              {(data.subIngredients?.length ?? 0) === 0 ? (
                <p className="text-sm text-gray-400">No sub-ingredients declared.</p>
              ) : (
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                  {data.subIngredients?.map((s: { id: string; name: string }) => (
                    <li key={s.id}>{s.name}</li>
                  ))}
                </ol>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">One sub-ingredient per line, in label order.</p>
              <textarea
                autoFocus
                value={subsText}
                onChange={e => setSubsText(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md
                           focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono leading-relaxed resize-y"
                placeholder={"Water\nSoybeans\nWheat\nSalt"}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateSubsMutation.mutate(subsText.split('\n').map(s => s.trim()).filter(Boolean))}
                  disabled={updateSubsMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Save size={13} />
                  {updateSubsMutation.isPending ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingSubs(false)}
                  className="px-4 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <span className="text-xs text-gray-400 ml-auto">
                  {subsText.split('\n').filter(s => s.trim()).length} items
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── DOCUMENTS ── */}
      {activeTab === 'docs' && (
        <div className="space-y-5">
          {(data.docs?.length ?? 0) === 0 ? (
            <p className="text-sm text-gray-400">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {data.docs?.map(doc => (
                <div key={doc.id}
                  className="flex items-center justify-between px-4 py-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <FileText size={16} className="text-gray-400 shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-gray-800">{doc.label}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(doc.uploadedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openDoc(doc.id)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    >
                      <Eye size={12} /> View
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete "${doc.label}"?`)) deleteDocMutation.mutate(doc.id) }}
                      disabled={deleteDocMutation.isPending}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-40"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="border border-dashed border-gray-200 rounded-lg p-5 space-y-3">
            <p className="text-xs font-medium text-gray-600">Upload document (COA, spec sheet, etc.)</p>
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.png,.jpg,.jpeg,.webp"
                onChange={e => setDocFile(e.target.files?.[0] ?? null)}
                className="text-sm text-gray-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-md
                           file:border-0 file:text-xs file:bg-gray-100 file:text-gray-700
                           hover:file:bg-gray-200 file:cursor-pointer"
              />
              <input
                value={docLabel}
                onChange={e => setDocLabel(e.target.value)}
                placeholder="Label (e.g. Spec Sheet, COA 2024-Q2)"
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => { if (docFile && docLabel.trim()) uploadDocMutation.mutate({ file: docFile, label: docLabel.trim() }) }}
              disabled={!docFile || !docLabel.trim() || uploadDocMutation.isPending}
              className="flex items-center gap-2 px-4 py-1.5 text-sm bg-blue-600 text-white
                         rounded-md hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              <Upload size={13} />
              {uploadDocMutation.isPending ? 'Uploading…' : 'Upload'}
            </button>
            {docFile && (
              <p className="text-xs text-gray-400">
                {docFile.name} · {(docFile.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── SUPPLIERS ── */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          {(data.suppliers?.length ?? 0) === 0 && !showAddSupplier ? (
            <div className="rounded-lg border border-dashed border-gray-200 p-10 text-center">
              <Truck size={24} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400 mb-2">No suppliers linked yet.</p>
              <button
                onClick={() => setShowAddSupplier(true)}
                className="text-sm text-blue-600 hover:underline"
              >
                Link a supplier →
              </button>
            </div>
          ) : (
            <>
              {(data.suppliers ?? []).map((link: IngredientSupplierWithName) => (
                <div key={link.id} className="border border-gray-100 rounded-lg">
                  {editingLinkId === link.id ? (
                    /* ── inline edit ── */
                    <div className="px-4 py-4 space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Pack size</label>
                          <input
                            type="number" min="0" step="any"
                            value={linkForm.packSize}
                            onChange={e => setLinkForm(f => ({ ...f, packSize: e.target.value }))}
                            placeholder="e.g. 25"
                            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Unit</label>
                          <select
                            value={linkForm.packUnit}
                            onChange={e => setLinkForm(f => ({ ...f, packUnit: e.target.value }))}
                            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {PACK_UNITS.map(u => <option key={u}>{u}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Cost / unit ($)</label>
                          <input
                            type="number" min="0" step="any"
                            value={linkForm.costPerUnit}
                            onChange={e => setLinkForm(f => ({ ...f, costPerUnit: e.target.value }))}
                            placeholder="e.g. 42.50"
                            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={linkForm.isPreferred}
                          onChange={e => setLinkForm(f => ({ ...f, isPreferred: e.target.checked }))}
                          className="rounded border-gray-300 text-blue-600"
                        />
                        Preferred supplier
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateSupplierLinkMutation.mutate({ linkId: link.id, form: linkForm })}
                          disabled={updateSupplierLinkMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Save size={12} /> Save
                        </button>
                        <button
                          onClick={() => { setEditingLinkId(null); setLinkForm(defaultLinkForm()) }}
                          className="px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── read view ── */
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Truck size={15} className="text-gray-400 shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800">{link.supplierName}</span>
                            {link.isPreferred && (
                              <span title="Preferred">
                                <Star size={11} className="text-yellow-400 fill-yellow-400" />
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                            {link.packSize && link.packUnit && (
                              <span>{parseFloat(link.packSize)} {link.packUnit}</span>
                            )}
                            {link.costPerUnit && (
                              <span className="text-green-700 font-medium">
                                ${parseFloat(link.costPerUnit).toFixed(2)} / {link.packUnit || 'unit'}
                              </span>
                            )}
                            {link.supplierWebsiteUrl && (
                              <a
                                href={link.supplierWebsiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-0.5 text-blue-500 hover:underline"
                              >
                                <ExternalLink size={10} />
                                {new URL(link.supplierWebsiteUrl).hostname.replace(/^www\./, '')}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingLinkId(link.id)
                            setLinkForm({
                              supplierId: link.supplierId,
                              newName: '', newWebsite: '',
                              packSize: link.packSize ? String(parseFloat(link.packSize)) : '',
                              packUnit: link.packUnit ?? 'kg',
                              costPerUnit: link.costPerUnit ? String(parseFloat(link.costPerUnit)) : '',
                              isPreferred: link.isPreferred,
                            })
                          }}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${link.supplierName} from this ingredient?`))
                              removeSupplierLinkMutation.mutate(link.id)
                          }}
                          disabled={removeSupplierLinkMutation.isPending}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-40"
                          title="Remove"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* ── Add supplier form ── */}
          {showAddSupplier ? (
            <div className="border border-dashed border-blue-200 rounded-lg px-4 py-4 space-y-3 bg-blue-50/30">
              <p className="text-xs font-medium text-gray-600">Link supplier</p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Supplier</label>
                <select
                  value={linkForm.supplierId}
                  onChange={e => setLinkForm(f => ({ ...f, supplierId: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="">— select supplier —</option>
                  {(allSuppliers ?? []).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                  <option value="__new__">+ New supplier…</option>
                </select>
              </div>
              {linkForm.supplierId === '__new__' && (
                <div className="grid grid-cols-2 gap-3 pl-2 border-l-2 border-blue-200">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Company name <span className="text-red-400">*</span></label>
                    <input
                      autoFocus
                      value={linkForm.newName}
                      onChange={e => setLinkForm(f => ({ ...f, newName: e.target.value }))}
                      placeholder="e.g. Cargill"
                      className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Website URL</label>
                    <input
                      type="url"
                      value={linkForm.newWebsite}
                      onChange={e => setLinkForm(f => ({ ...f, newWebsite: e.target.value }))}
                      placeholder="https://example.com"
                      className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
              {linkForm.supplierId && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Pack size</label>
                      <input
                        type="number" min="0" step="any"
                        value={linkForm.packSize}
                        onChange={e => setLinkForm(f => ({ ...f, packSize: e.target.value }))}
                        placeholder="e.g. 25"
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Unit</label>
                      <select
                        value={linkForm.packUnit}
                        onChange={e => setLinkForm(f => ({ ...f, packUnit: e.target.value }))}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {PACK_UNITS.map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Cost / unit ($)</label>
                      <input
                        type="number" min="0" step="any"
                        value={linkForm.costPerUnit}
                        onChange={e => setLinkForm(f => ({ ...f, costPerUnit: e.target.value }))}
                        placeholder="e.g. 42.50"
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={linkForm.isPreferred}
                      onChange={e => setLinkForm(f => ({ ...f, isPreferred: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    Mark as preferred supplier
                  </label>
                </>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (!linkForm.supplierId) return
                    if (linkForm.supplierId === '__new__' && !linkForm.newName.trim()) {
                      toast.error('Supplier name is required')
                      return
                    }
                    addSupplierLinkMutation.mutate(linkForm)
                  }}
                  disabled={!linkForm.supplierId || addSupplierLinkMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus size={12} />
                  {addSupplierLinkMutation.isPending ? 'Saving…' : 'Link supplier'}
                </button>
                <button
                  onClick={() => { setShowAddSupplier(false); setLinkForm(defaultLinkForm()) }}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (data.suppliers?.length ?? 0) > 0 && (
            <button
              onClick={() => setShowAddSupplier(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              <Plus size={12} /> Link another supplier
            </button>
          )}
        </div>
      )}

      {/* ── INVENTORY ── */}
      {activeTab === 'inventory' && (
        <div className="space-y-5">
          {/* Stock level card */}
          <div className="border border-gray-100 rounded-lg px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">Current stock</span>
              {!editingStock && (
                <button
                  onClick={() => {
                    setStockEdit(data.stockG != null ? String(parseFloat(data.stockG)) : '')
                    setEditingStock(true)
                  }}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                >
                  <Edit2 size={11} /> Edit
                </button>
              )}
            </div>
            {editingStock ? (
              <form
                className="flex items-center gap-2"
                onSubmit={async e => {
                  e.preventDefault()
                  const val = stockEdit.trim()
                  const stockGValue = val === '' ? null : parseFloat(val)
                  patchIngredientMutation.mutate({ stockG: stockGValue }, {
                    onSuccess: () => {
                      setEditingStock(false)
                      refetchInventory()
                    },
                  })
                }}
              >
                <input
                  autoFocus
                  type="number"
                  step="any"
                  value={stockEdit}
                  onChange={e => setStockEdit(e.target.value)}
                  placeholder="Leave blank to disable tracking"
                  className="w-44 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 tabular-nums"
                />
                <span className="text-xs text-gray-400">g</span>
                <button type="submit" disabled={patchIngredientMutation.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                  <Save size={11} /> Save
                </button>
                <button type="button" onClick={() => setEditingStock(false)}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50">
                  Cancel
                </button>
              </form>
            ) : (
              <div>
                {data.stockG != null ? (
                  <span className={`text-2xl font-semibold tabular-nums ${parseFloat(data.stockG) < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                    {parseFloat(data.stockG).toFixed(1)} g
                  </span>
                ) : (
                  <span className="text-sm text-gray-400 italic">Tracking not enabled</span>
                )}
              </div>
            )}
          </div>

          {/* Depletion history */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Depletion history
            </h3>
            {!inventoryData ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : inventoryData.depletions.length === 0 ? (
              <p className="text-sm text-gray-400">No batches recorded yet.</p>
            ) : (
              <div className="space-y-1.5">
                {inventoryData.depletions.map(d => (
                  <div key={d.runId} className="flex items-center justify-between px-3 py-2.5 border border-gray-100 rounded-lg hover:bg-gray-50 text-sm">
                    <div>
                      <div className="font-medium text-gray-800">{d.formulationName}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {new Date(d.runAt).toLocaleDateString()} · ×{d.batchMultiplier}
                        {d.notes && <span className="ml-2 text-gray-300">— {d.notes}</span>}
                      </div>
                    </div>
                    <span className="text-red-500 font-medium tabular-nums text-sm">
                      −{d.depletedG.toFixed(1)} g
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FORMULATIONS ── */}
      {activeTab === 'formulations' && (
        <div className="space-y-3">
          {data.sourceType === 'ai_extracted' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-100 rounded-lg">
              <Sparkles size={13} className="text-orange-500 shrink-0" />
              <span className="text-xs text-orange-700">
                Auto-imported via AI research
                {data.notes && (() => {
                  const match = data.notes.match(/https?:\/\/\S+/)
                  return match
                    ? <> — <a href={match[0]} target="_blank" rel="noopener noreferrer" className="underline">USDA source</a></>
                    : null
                })()}
              </span>
            </div>
          )}
          {(data.formulations?.length ?? 0) === 0 ? (
            <p className="text-sm text-gray-400">This ingredient is not used in any formulations yet.</p>
          ) : (
            <div className="space-y-2">
              {data.formulations?.map(f => (
                <div key={f.formulationId}
                  className="flex items-center justify-between px-4 py-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                  <div>
                    <div className="text-sm font-medium text-gray-800">{f.formulationName}</div>
                    <div className="text-xs text-gray-400">{f.projectName}</div>
                  </div>
                  <a
                    href={`/projects/${f.projectId}/formulations/${f.formulationId}`}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  >
                    <ExternalLink size={12} /> View
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
