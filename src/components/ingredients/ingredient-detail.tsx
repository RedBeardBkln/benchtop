'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft, ExternalLink, Check, AlertTriangle,
  Plus, X, Edit2, Save, Upload, FileText, Trash2, Eye, Sparkles, Truck, Star, Package,
} from 'lucide-react'
import type { IngredientDetail as IngredientDetailType, Nutrient, Supplier, IngredientSupplierWithName } from '@/lib/types'
import { readErrorMessage } from '@/lib/utils'
import { uploadStaged } from '@/lib/upload-file'
import { nutrientSourceFor, type NutrientEditSource } from '@/lib/nutrient-source'
import { DuplicateResolveDialog } from './duplicate-resolve-dialog'
import { IngredientCostPanel } from './ingredient-cost-panel'
import { EditIngredientDialog, toEditable, type EditableIngredient } from './edit-ingredient-dialog'
import { categoryPath } from '@/lib/ingredient-categories'
import { GLOSSARY } from '@/lib/glossary'
import { Term } from '@/components/term'

// fetch(...).then(okOrThrow('…')) — a refused change (e.g. view-only access) shows its error
// instead of looking like it worked
const okOrThrow = (fallback: string) => async (r: Response) => {
  if (!r.ok) throw new Error(await readErrorMessage(r, fallback))
}

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

type Tab = 'nutrients' | 'allergens' | 'certs' | 'subs' | 'docs' | 'formulations' | 'suppliers' | 'cost' | 'inventory'

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

type NutrientEdit = NutrientEditSource & {
  // amount '' = no value / delete if rowId exists
  rowId?: string    // existing ingredient_nutrient row id
}

// canEdit: false for members with view-only library access (editing controls are hidden;
// the API refuses their changes anyway)
export function IngredientDetail({ id, canEdit }: { id: string; canEdit: boolean }) {
  const router = useRouter()
  const [resolveOpen, setResolveOpen] = useState(false)
  const [resolveMode, setResolveMode] = useState<'rename' | 'merge'>('rename')
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
  const [editingSource, setEditingSource] = useState(false)
  const [sourceEdit, setSourceEdit] = useState({ brandName: '', supplierName: '', itemCode: '' })

  // ── Allergens ─────────────────────────────────────────────────────────
  const [allergenInput, setAllergenInput] = useState('')

  // Category, on hand, stock, moisture, naturally derived, notes (same dialog as the list's pencil)
  const [editingDetails, setEditingDetails] = useState<EditableIngredient | null>(null)

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
            originalAmount: String(parseFloat(existing.amountPer100g)),
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
      }).then(okOrThrow('Could not update verification')),
    onSuccess: () => { invalidate(); toast.success('Verification status updated') },
    onError: (err: Error) => toast.error(err.message),
  })

  const patchIngredientMutation = useMutation({
    mutationFn: (fields: {
      name?: string
      labelName?: string | null
      brandName?: string | null
      supplierName?: string | null
      itemCode?: string | null
      stockG?: number | null
    }) =>
      fetch(`/api/ingredients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      }).then(async r => {
        if (!r.ok) throw new Error(await readErrorMessage(r, 'Save failed'))
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
        if (!r.ok) throw new Error(await readErrorMessage(r, 'Save failed'))
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
      }).then(okOrThrow('Failed to add allergen')),
    onSuccess: () => { invalidate(); setAllergenInput('') },
    onError: (err: Error) => toast.error(err.message),
  })

  const removeAllergenMutation = useMutation({
    mutationFn: (allergenId: string) =>
      fetch(`/api/ingredients/${id}/allergens/${allergenId}`, { method: 'DELETE' })
        .then(okOrThrow('Failed to remove allergen')),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast.error(err.message),
  })

  const addCertMutation = useMutation({
    mutationFn: (cert: string) =>
      fetch(`/api/ingredients/${id}/certs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cert }),
      }).then(okOrThrow('Failed to add certification')),
    onSuccess: () => { invalidate(); setCertInput('') },
    onError: (err: Error) => toast.error(err.message),
  })

  const removeCertMutation = useMutation({
    mutationFn: (certId: string) =>
      fetch(`/api/ingredients/${id}/certs/${certId}`, { method: 'DELETE' })
        .then(okOrThrow('Failed to remove certification')),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast.error(err.message),
  })

  const updateSubsMutation = useMutation({
    mutationFn: (names: string[]) =>
      fetch(`/api/ingredients/${id}/sub-ingredients`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names }),
      }).then(okOrThrow('Failed to save sub-ingredients')),
    onSuccess: () => {
      invalidate()
      setEditingSubs(false)
      toast.success('Sub-ingredients saved')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const uploadDocMutation = useMutation({
    mutationFn: async ({ file, label }: { file: File; label: string }) => {
      // The file goes straight to storage; large files would be refused by our own server
      const stagedPath = await uploadStaged(file)
      const r = await fetch(`/api/ingredients/${id}/docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stagedPath, label }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Upload failed'))
      return r.json()
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
      fetch(`/api/ingredients/${id}/docs/${docId}`, { method: 'DELETE' })
        .then(okOrThrow('Failed to delete document')),
    onSuccess: () => { invalidate(); toast.success('Document deleted') },
    onError: (err: Error) => toast.error(err.message),
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
        // A supplier with that name already exists: link to it rather than making a twin
        const body = await r.json().catch(() => null)
        if (r.status === 409 && body?.existing?.id) supplierId = body.existing.id
        else if (!r.ok) throw new Error(body?.error ?? 'Failed to create supplier')
        else supplierId = body.id
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
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Failed to link supplier'))
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
      }).then(async r => { if (!r.ok) throw new Error(await readErrorMessage(r, 'Failed')); return r.json() }),
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
      fetch(`/api/ingredients/${id}/suppliers/${linkId}`, { method: 'DELETE' })
        .then(okOrThrow('Failed to remove supplier')),
    onSuccess: () => { invalidate(); toast.success('Supplier removed') },
    onError: (err: Error) => toast.error(err.message),
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
        const sourceRef = nutrientSourceFor(edit, globalSource)
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
            originalAmount: updated[p.nutrientId]?.originalAmount,
            fromParse: true,
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
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-5xl">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <ArrowLeft size={14} /> Ingredients
      </button>

      {(data.duplicates?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
          <p className="flex-1 min-w-[16rem] text-sm text-amber-900">
            <span className="font-medium"><Term t="duplicate">Duplicate</Term> ingredient.</span>{' '}
            {data.duplicates!.length === 1 ? 'Another entry has' : `${data.duplicates!.length} other entries have`} the same
            name, brand, supplier and item code. Rename this one, or merge them.
          </p>
          {canEdit && <div className="flex gap-2">
            <button
              onClick={() => { setResolveMode('rename'); setResolveOpen(true) }}
              data-tip="Change this entry’s name, brand, supplier or item code so it’s no longer a duplicate."
              className="px-3 py-1.5 text-xs font-medium border border-amber-300 rounded-md bg-white text-amber-800 hover:bg-amber-100"
            >
              Rename
            </button>
            <button
              onClick={() => { setResolveMode('merge'); setResolveOpen(true) }}
              data-tip="Combine the duplicates into one entry. Formulations that used the others switch to the kept one."
              className="px-3 py-1.5 text-xs font-medium border border-amber-300 rounded-md bg-white text-amber-800 hover:bg-amber-100"
            >
              Merge…
            </button>
          </div>}
        </div>
      )}
      <EditIngredientDialog ingredient={editingDetails} onClose={() => setEditingDetails(null)} />
      {resolveOpen && (
        <DuplicateResolveDialog
          ingredientId={id}
          initialMode={resolveMode}
          onClose={() => setResolveOpen(false)}
          onRemoved={() => router.push('/ingredients')}
        />
      )}

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
                data-tip={!nameEdit.trim() ? 'The name can’t be empty.' : 'Renames the ingredient everywhere it’s used. Words are capitalized automatically.'}
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
              {canEdit && <button
                onClick={() => { setNameEdit(data.name); setEditingName(true) }}
                className="[@media(hover:hover)]:opacity-0 group-hover/name:opacity-100 focus:opacity-100 transition-opacity p-1 text-gray-400 hover:text-gray-700 rounded"
                aria-label="Edit name"
                data-tip="Rename this ingredient. The new name shows everywhere it’s used."
              >
                <Edit2 size={14} />
              </button>}
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
                placeholder="Label statement (e.g. Rolled Oats)"
                aria-label="Label name"
                data-tip="How the ingredient is written in the ingredient statement. Leave blank to use its name."
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
                  <span className="text-xs text-gray-400 mr-1"><Term t="labelName">Label</Term>:</span>
                  {data.labelName}
                </span>
              ) : (
                <span className="text-xs text-gray-300 italic">No <Term t="labelName">label name</Term> set</span>
              )}
              {canEdit && <button
                onClick={() => { setLabelNameEdit(data.labelName ?? ''); setEditingLabelName(true) }}
                className="[@media(hover:hover)]:opacity-0 group-hover/label:opacity-100 focus:opacity-100 transition-opacity p-0.5 text-gray-400 hover:text-gray-700 rounded"
                aria-label="Edit label name"
                data-tip="Set how this ingredient reads in a formulation’s ingredient statement."
              >
                <Edit2 size={11} />
              </button>}
            </div>
          )}

          {/* Editable brand / supplier / item code */}
          {editingSource ? (
            <form
              className="flex items-center gap-2 mb-2 flex-wrap"
              onSubmit={e => {
                e.preventDefault()
                patchIngredientMutation.mutate(
                  {
                    brandName: sourceEdit.brandName.trim() || null,
                    supplierName: sourceEdit.supplierName.trim() || null,
                    itemCode: sourceEdit.itemCode.trim() || null,
                  },
                  { onSuccess: () => setEditingSource(false) },
                )
              }}
            >
              {([
                ['brandName', 'Brand'],
                ['supplierName', 'Supplier'],
                ['itemCode', 'Item code'],
              ] as const).map(([key, placeholder]) => (
                <input
                  key={key}
                  value={sourceEdit[key]}
                  onChange={e => setSourceEdit(s => ({ ...s, [key]: e.target.value }))}
                  placeholder={placeholder}
                  aria-label={placeholder}
                  data-tip="Name, brand, supplier and item code together must not match another ingredient."
                  className="text-sm text-gray-600 border-b border-blue-400 outline-none bg-transparent w-32"
                />
              ))}
              <button type="submit" disabled={patchIngredientMutation.isPending}
                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 shrink-0">
                <Save size={11} /> Save
              </button>
              <button type="button" onClick={() => setEditingSource(false)}
                className="px-2.5 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50 shrink-0">
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-1.5 group/source mb-2 flex-wrap">
              {data.brandName || data.supplierName || data.itemCode ? (
                <span className="text-sm text-gray-500 flex items-center gap-3 flex-wrap">
                  {data.brandName && (
                    <span><span className="text-xs text-gray-400 mr-1">Brand:</span>{data.brandName}</span>
                  )}
                  {data.supplierName && (
                    <span><span className="text-xs text-gray-400 mr-1">Supplier:</span>{data.supplierName}</span>
                  )}
                  {data.itemCode && (
                    <span><span className="text-xs text-gray-400 mr-1">Item #:</span>{data.itemCode}</span>
                  )}
                </span>
              ) : (
                <span className="text-xs text-gray-300 italic">No brand / supplier / item code set</span>
              )}
              {canEdit && <button
                onClick={() => {
                  setSourceEdit({
                    brandName: data.brandName ?? '',
                    supplierName: data.supplierName ?? '',
                    itemCode: data.itemCode ?? '',
                  })
                  setEditingSource(true)
                }}
                className="[@media(hover:hover)]:opacity-0 group-hover/source:opacity-100 focus:opacity-100 transition-opacity p-0.5 text-gray-400 hover:text-gray-700 rounded"
                aria-label="Edit brand, supplier, item code"
                data-tip="Edit brand, supplier and item code. With the name, they tell this entry apart from similar ones."
              >
                <Edit2 size={11} />
              </button>}
            </div>
          )}

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span data-tip={data.verification === 'verified' ? GLOSSARY.verified : GLOSSARY.unverified} className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
              data.verification === 'verified'
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {data.verification === 'verified' ? '✓ Verified' : '⚠ Unverified'}
            </span>
            <span data-tip={GLOSSARY.source} className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 uppercase">
              {data.sourceType}
            </span>
            {data.onHand && (
              <span data-tip={GLOSSARY.onHand} className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">On hand</span>
            )}
            <span className="text-xs text-gray-500" data-tip={GLOSSARY.category}>{categoryPath(data) || 'Uncategorized'}</span>
            {data.moisturePct != null && (
              <span className="text-xs text-gray-500"><Term t="moisturePct">Moisture</Term> {parseFloat(data.moisturePct)}%</span>
            )}
            {data.naturallyDerived && <span className="text-xs text-gray-500"><Term t="naturallyDerived">Naturally derived</Term></span>}
            {data.sourceFormulationId && (
              <Link
                href={`/formulations/${data.sourceFormulationId}`}
                data-tip="Opens the formulation this ingredient was saved from."
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-teal-50 text-teal-700 hover:underline"
              >
                View source formulation <ExternalLink size={10} />
              </Link>
            )}
            {data.stockG != null && (
              <span data-tip={GLOSSARY.stock} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-teal-50 text-teal-700">
                <Package size={10} />
                {parseFloat(data.stockG).toFixed(0)} g on hand
              </span>
            )}
            {data.fdcId && (
              <a
                href={`https://fdc.nal.usda.gov/food-details/${data.fdcId}/nutrients`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline"
                data-tip="Opens this food’s USDA FoodData Central page in a new tab."
              >
                FDC {data.fdcId} <ExternalLink size={10} />
              </a>
            )}
          </div>
          {data.notes && <p className="mt-2 text-sm text-gray-500">{data.notes}</p>}
        </div>

        {canEdit && <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
        <button
          onClick={() => setEditingDetails(toEditable(data))}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          data-tip="Edit category, on hand, stock, moisture, naturally derived and notes."
        >
          <Edit2 size={12} /> Edit details
        </button>
        <button
          onClick={() => verifyMutation.mutate()}
          disabled={verifyMutation.isPending}
          data-tip={data.verification === 'verified'
            ? 'Marks the data as not yet checked, so it shows ⚠ in formulations.'
            : 'Confirms you’ve checked this ingredient’s nutrition, allergens and details against a reliable source, such as its spec sheet.'}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors ${
            data.verification === 'verified'
              ? 'border-green-200 text-green-700 hover:bg-green-50'
              : 'border-yellow-200 text-yellow-700 hover:bg-yellow-50'
          }`}
        >
          <Check size={12} />
          {data.verification === 'verified' ? 'Mark unverified' : 'Mark verified'}
        </button>
        </div>}
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto mb-6">
      <div className="flex border-b border-gray-200 min-w-max">
        {([
          ['nutrients', `Nutrients (${data.nutrients.length})`],
          ['allergens', `Allergens (${data.allergens.length})`],
          ['certs', `Certifications (${data.certs.length})`],
          ['subs', `Sub-ingredients (${data.subIngredients?.length ?? 0})`],
          ['docs', `Documents (${data.docs?.length ?? 0})`],
          ['formulations', `Formulations (${data.formulations?.length ?? 0})`],
          ['suppliers', `Suppliers (${data.suppliers?.length ?? 0})`],
          ['cost', 'Cost'],
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
      </div>

      {/* ── NUTRIENTS ── */}
      {activeTab === 'nutrients' && (
        <div className="space-y-4">
          {!editingNutrients ? (
            /* Read mode */
            <>
              {canEdit && <div className="flex justify-end">
                <button
                  onClick={() => setEditingNutrients(true)}
                  data-tip="Type values in per 100 g, or read them from an uploaded spec sheet. Changes apply wherever this ingredient is used."
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <Edit2 size={12} /> Edit nutrients
                </button>
              </div>}

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
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
                          <thead className="bg-gray-50 text-xs text-gray-500">
                            <tr>
                              <th className="px-4 py-2 text-left font-medium">Nutrient</th>
                              <th className="px-4 py-2 text-right font-medium"><Term t="per100g">Per 100 g</Term></th>
                              <th className="px-4 py-2 text-right font-medium">Unit</th>
                              <th className="px-4 py-2 text-left font-medium text-gray-400"><Term t="sourceRef">Source</Term></th>
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
                                      data-tip="Opens the page this value came from in a new tab."
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
                    <Term t="sourceRef">Source reference</Term>
                    <span className="font-normal text-gray-400 ml-1">
                      — applied to new or modified values
                    </span>
                  </label>
                  <input
                    value={globalSource}
                    onChange={e => setGlobalSource(e.target.value)}
                    placeholder="e.g. Supplier COA Q2-2024, USDA FDC 12345, Manual entry"
                    data-tip="Where the numbers came from. Saved with every value you add or change; untouched values keep their own source."
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
                    data-tip="Saves all values. Every formulation that uses this ingredient picks up the change."
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
                    aria-label="Document to parse"
                    data-tip="Choose an uploaded spec sheet or COA. Only PDFs and images can be read."
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
                    data-tip={!parseDocId ? 'Choose a document first.' : 'Reads nutrition values from this document into the editor for you to check. Nothing is saved until you click Save nutrients.'}
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
                        <div className="overflow-x-auto">
                        <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
                          <thead className="bg-gray-50 text-xs text-gray-500">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium">Nutrient</th>
                              <th className="px-3 py-2 text-left font-medium w-14">Unit</th>
                              <th className="px-3 py-2 text-left font-medium w-36"><Term t="per100g">Per 100 g</Term></th>
                              <th className="px-3 py-2 text-left font-medium text-gray-400"><Term t="sourceRef">Source</Term></th>
                              <th className="px-3 py-2 w-6" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {rows.map(n => {
                              const edit = nutrientEdits[n.id] ?? { amount: '', sourceRef: '' }
                              const hasValue = edit.amount !== ''
                              const sourceDisplay = hasValue ? nutrientSourceFor(edit, globalSource) : ''

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
                                            // A retyped value takes the source reference typed above
                                            sourceRef: prev[n.id]?.rowId ? prev[n.id].sourceRef : '',
                                            fromParse: false,
                                          },
                                        }))
                                      }
                                      placeholder="—"
                                      aria-label={`${n.name} per 100 g (${n.unit})`}
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
                                        aria-label={`Clear ${n.name}`}
                                        data-tip="Clears this value. It’s removed from the ingredient when you save."
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
          <p className="text-xs text-gray-400">Click to declare or remove. Declared <Term t="allergen">allergens</Term> are highlighted.</p>

          <div className="flex flex-wrap gap-2">
            {STANDARD_ALLERGENS.map(allergen => {
              const active = activeAllergenNames.has(allergen)
              return (
                <button
                  key={allergen}
                  onClick={() => toggleAllergen(allergen)}
                  disabled={!canEdit || addAllergenMutation.isPending || removeAllergenMutation.isPending}
                  data-tip={!canEdit
                    ? 'You have view-only access to the ingredient library.'
                    : active
                      ? `Removes ${allergen}. It drops out of the allergen statement of formulations using this ingredient.`
                      : `Declares ${allergen}. It’s added to the allergen statement of every formulation using this ingredient.`}
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
                    {canEdit && <button onClick={() => removeAllergenMutation.mutate(a.id)} aria-label={`Remove ${a.allergen}`} data-tip={`Removes ${a.allergen} from this ingredient’s allergens.`} className="hover:opacity-70">
                      <X size={12} />
                    </button>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {canEdit && <form
            className="flex items-center gap-2"
            onSubmit={e => { e.preventDefault(); const v = allergenInput.trim(); if (v) addAllergenMutation.mutate(v) }}
          >
            <input
              value={allergenInput}
              onChange={e => setAllergenInput(e.target.value)}
              placeholder="Add custom allergen…"
              aria-label="Custom allergen"
              data-tip="For an allergen not in the list above, e.g. one required in another market."
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
            />
            <button
              type="submit"
              disabled={!allergenInput.trim() || addAllergenMutation.isPending}
              data-tip={!allergenInput.trim() ? 'Type an allergen first.' : 'Declares this allergen on the ingredient.'}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-40 transition-colors"
            >
              <Plus size={14} /> Add
            </button>
          </form>}
        </div>
      )}

      {/* ── CERTIFICATIONS ── */}
      {activeTab === 'certs' && (
        <div className="space-y-4">
          <p className="text-xs text-gray-400">{canEdit ? <>Click to add or remove <Term t="certification">certifications</Term>.</> : <><Term t="certification">Certifications</Term> recorded for this ingredient are highlighted.</>}</p>

          <div className="flex flex-wrap gap-2">
            {STANDARD_CERTS.map(cert => {
              const active = activeCertNames.has(cert)
              return (
                <button
                  key={cert}
                  onClick={() => toggleCert(cert)}
                  disabled={!canEdit || addCertMutation.isPending || removeCertMutation.isPending}
                  data-tip={!canEdit
                    ? 'You have view-only access to the ingredient library.'
                    : active ? `Removes the ${cert} certification.` : `Records that this ingredient is certified ${cert}.`}
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
                    {canEdit && <button onClick={() => removeCertMutation.mutate(c.id)} aria-label={`Remove ${c.cert}`} data-tip={`Removes the ${c.cert} certification.`} className="hover:opacity-70">
                      <X size={12} />
                    </button>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {canEdit && <form
            className="flex items-center gap-2"
            onSubmit={e => { e.preventDefault(); const v = certInput.trim(); if (v) addCertMutation.mutate(v) }}
          >
            <input
              value={certInput}
              onChange={e => setCertInput(e.target.value)}
              placeholder="Add custom certification…"
              aria-label="Custom certification"
              data-tip="For a certification not in the list above."
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
            />
            <button
              type="submit"
              disabled={!certInput.trim() || addCertMutation.isPending}
              data-tip={!certInput.trim() ? 'Type a certification first.' : 'Records this certification on the ingredient.'}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-40 transition-colors"
            >
              <Plus size={14} /> Add
            </button>
          </form>}
        </div>
      )}

      {/* ── SUB-INGREDIENTS ── */}
      {activeTab === 'subs' && (
        <div className="space-y-4">
          {!editingSubs ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Declared <Term t="subIngredients">sub-ingredient</Term> list (e.g. from label statement).</p>
                {canEdit && <button
                  onClick={() => { setSubsText((data.subIngredients ?? []).map(s => s.name).join('\n')); setEditingSubs(true) }}
                  data-tip="Type the components of this ingredient, one per line, in label order."
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <Edit2 size={12} /> Edit list
                </button>}
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
                  data-tip="Saves the list. It appears in parentheses after this ingredient in formulation ingredient statements."
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
                      data-tip="Opens the document in a new tab. The link works for a few minutes."
                      className="flex items-center gap-1 px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    >
                      <Eye size={12} /> View
                    </button>
                    {canEdit && <button
                      onClick={() => { if (confirm(`Delete "${doc.label}"?`)) deleteDocMutation.mutate(doc.id) }}
                      disabled={deleteDocMutation.isPending}
                      data-tip="Permanently deletes this document. Nutrient values already read from it stay."
                      className="flex items-center gap-1 px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-40"
                    >
                      <Trash2 size={12} /> Delete
                    </button>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {canEdit && <div className="border border-dashed border-gray-200 rounded-lg p-5 space-y-3">
            <p className="text-xs font-medium text-gray-600">Upload document (COA, spec sheet, etc.)</p>
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.png,.jpg,.jpeg,.webp"
                aria-label="Document file"
                data-tip="PDF, Word, Excel, CSV, PNG, JPG or WebP, up to 20 MB. PDFs and images can be read by AI for nutrition."
                onChange={e => setDocFile(e.target.files?.[0] ?? null)}
                className="text-sm text-gray-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-md
                           file:border-0 file:text-xs file:bg-gray-100 file:text-gray-700
                           hover:file:bg-gray-200 file:cursor-pointer"
              />
              <input
                value={docLabel}
                onChange={e => setDocLabel(e.target.value)}
                placeholder="Label (e.g. Spec Sheet, COA 2024-Q2)"
                aria-label="Document label"
                data-tip="A name for the document, shown in the list. Required."
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => { if (docFile && docLabel.trim()) uploadDocMutation.mutate({ file: docFile, label: docLabel.trim() }) }}
              disabled={!docFile || !docLabel.trim() || uploadDocMutation.isPending}
              data-tip={!docFile ? 'Choose a file first.' : !docLabel.trim() ? 'Type a label for the document first.' : 'Uploads the file and stores it with this ingredient.'}
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
          </div>}
        </div>
      )}

      {/* ── SUPPLIERS ── */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          {(data.suppliers?.length ?? 0) === 0 && !showAddSupplier ? (
            <div className="rounded-lg border border-dashed border-gray-200 p-10 text-center">
              <Truck size={24} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400 mb-2">No suppliers linked yet.</p>
              {canEdit && <button
                onClick={() => setShowAddSupplier(true)}
                data-tip="Record who sells this ingredient, the pack size and the price."
                className="text-sm text-blue-600 hover:underline"
              >
                Link a supplier →
              </button>}
            </div>
          ) : (
            <>
              {(data.suppliers ?? []).map((link: IngredientSupplierWithName) => (
                <div key={link.id} className="border border-gray-100 rounded-lg">
                  {editingLinkId === link.id ? (
                    /* ── inline edit ── */
                    <div className="px-4 py-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1"><Term t="packSize">Pack size</Term></label>
                          <input
                            type="number" min="0" step="any"
                            value={linkForm.packSize}
                            data-tip="How much one pack, bag or drum holds, in the unit chosen. Leave blank if unknown."
                            onChange={e => setLinkForm(f => ({ ...f, packSize: e.target.value }))}
                            placeholder="e.g. 25"
                            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Unit</label>
                          <select
                            value={linkForm.packUnit}
                            aria-label="Unit"
                            data-tip="The unit for the pack size and the price. Only per kg, g, lb, oz or mt prices can be used as the ingredient’s cost."
                            onChange={e => setLinkForm(f => ({ ...f, packUnit: e.target.value }))}
                            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {PACK_UNITS.map(u => <option key={u}>{u}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1"><Term tip="The price for one unit (e.g. $ per kg or per bag), not for the whole pack. Leave blank if unknown.">Cost / unit</Term> ($)</label>
                          <input
                            type="number" min="0" step="any"
                            value={linkForm.costPerUnit}
                            onChange={e => setLinkForm(f => ({ ...f, costPerUnit: e.target.value }))}
                            placeholder="e.g. 42.50"
                            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer" data-tip={GLOSSARY.preferredSupplier}>
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
                          data-tip="Saves the pack size, price and preferred setting for this supplier link."
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
                              <span data-tip={GLOSSARY.preferredSupplier} aria-label="Preferred supplier">
                                <Star size={11} className="text-yellow-400 fill-yellow-400" />
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                            {link.packSize && link.packUnit && (
                              <span data-tip={GLOSSARY.packSize}>{parseFloat(link.packSize)} {link.packUnit}</span>
                            )}
                            {link.costPerUnit && (
                              <span className="text-green-700 font-medium" data-tip="Price per unit. Choose it as the ingredient’s cost on the Cost tab.">
                                ${parseFloat(link.costPerUnit).toFixed(2)} / {link.packUnit || 'unit'}
                              </span>
                            )}
                            {link.supplierWebsiteUrl && (
                              <a
                                href={link.supplierWebsiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-0.5 text-blue-500 hover:underline"
                                data-tip="Opens the supplier’s website in a new tab."
                              >
                                <ExternalLink size={10} />
                                {new URL(link.supplierWebsiteUrl).hostname.replace(/^www\./, '')}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      {canEdit && <div className="flex items-center gap-1">
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
                          aria-label="Edit supplier link"
                          data-tip="Edit the pack size, price and preferred setting for this supplier."
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
                          aria-label="Remove supplier link"
                          data-tip="Unlinks this supplier and its price from the ingredient. The supplier record itself is kept."
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>}
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
                <label className="block text-xs text-gray-500 mb-1"><Term t="supplier">Supplier</Term></label>
                <select
                  value={linkForm.supplierId}
                  aria-label="Supplier"
                  data-tip="Pick one of your suppliers, or “+ New supplier…” to create one here."
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-2 border-l-2 border-blue-200">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Company name <span className="text-red-400">*</span></label>
                    <input
                      autoFocus
                      value={linkForm.newName}
                      onChange={e => setLinkForm(f => ({ ...f, newName: e.target.value }))}
                      placeholder="e.g. Cargill"
                      data-tip="If a supplier with this name already exists, the ingredient is linked to it instead of creating a second one."
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1"><Term t="packSize">Pack size</Term></label>
                      <input
                        type="number" min="0" step="any"
                        value={linkForm.packSize}
                        data-tip="How much one pack, bag or drum holds, in the unit chosen. Leave blank if unknown."
                        onChange={e => setLinkForm(f => ({ ...f, packSize: e.target.value }))}
                        placeholder="e.g. 25"
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Unit</label>
                      <select
                        value={linkForm.packUnit}
                        aria-label="Unit"
                        data-tip="The unit for the pack size and the price. Only per kg, g, lb, oz or mt prices can be used as the ingredient’s cost."
                        onChange={e => setLinkForm(f => ({ ...f, packUnit: e.target.value }))}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {PACK_UNITS.map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1"><Term tip="The price for one unit (e.g. $ per kg or per bag), not for the whole pack. Leave blank if unknown.">Cost / unit</Term> ($)</label>
                      <input
                        type="number" min="0" step="any"
                        value={linkForm.costPerUnit}
                        onChange={e => setLinkForm(f => ({ ...f, costPerUnit: e.target.value }))}
                        placeholder="e.g. 42.50"
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer" data-tip={`${GLOSSARY.preferredSupplier} Shown with a star.`}>
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
                  data-tip={!linkForm.supplierId ? 'Choose a supplier first.' : 'Links this supplier to the ingredient with the pack size and price entered.'}
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
          ) : canEdit && (data.suppliers?.length ?? 0) > 0 && (
            <button
              onClick={() => setShowAddSupplier(true)}
              data-tip="Add another supplier, or the same one again for a different pack size."
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              <Plus size={12} /> Link another supplier
            </button>
          )}
        </div>
      )}

      {/* ── INVENTORY ── */}
      {activeTab === 'cost' && (
        <IngredientCostPanel
          key={`${data.defaultCostPerKg}-${data.costUnit}`}
          ingredientId={id}
          defaultCostPerKg={data.defaultCostPerKg}
          costUnit={data.costUnit}
          suppliers={data.suppliers ?? []}
          onGoToSuppliers={() => setActiveTab('suppliers')}
          canEdit={canEdit}
        />
      )}

      {activeTab === 'inventory' && (
        <div className="space-y-5">
          {/* Stock level card */}
          <div className="border border-gray-100 rounded-lg px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">Current <Term t="stock">stock</Term></span>
              {!editingStock && canEdit && (
                <button
                  onClick={() => {
                    setStockEdit(data.stockG != null ? String(parseFloat(data.stockG)) : '')
                    setEditingStock(true)
                  }}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                  data-tip="Set how many grams you have now, e.g. after a stock count."
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
                  aria-label="Stock in grams"
                  data-tip="Grams you have now. Completing a batch subtracts what it used. Leave blank to stop tracking."
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
              <Term tip="Batches completed with this ingredient and how many grams each one took from stock.">Depletion history</Term>
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
                        {new Date(d.runAt).toLocaleDateString()} · <span data-tip={GLOSSARY.batchMultiplier}>×{d.batchMultiplier}</span>
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
                    data-tip="Opens this formulation."
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
