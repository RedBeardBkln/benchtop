'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Plus, Database, Trash2, ArrowUpDown, Camera, Edit2, AlertTriangle, ClipboardList } from 'lucide-react'
import { toast } from 'sonner'
import { readErrorMessage } from '@/lib/utils'
import type { IngredientListRow } from '@/lib/types'
import { UsdaSearchDialog } from './usda-search-dialog'
import { AddIngredientDialog } from './add-ingredient-dialog'
import { PhotoIngredientDialog } from './photo-ingredient-dialog'
import { EditIngredientDialog, toEditable, type EditableIngredient } from './edit-ingredient-dialog'
import { categoryOptions, categoryPath } from '@/lib/ingredient-categories'
import { DuplicateResolveDialog } from './duplicate-resolve-dialog'
import { GLOSSARY } from '@/lib/glossary'
import { Term } from '@/components/term'
import { ArchivedRecords } from '@/components/archived-records'

const SOURCE_LABELS: Record<string, { label: string; className: string; tip: string }> = {
  usda:         { label: 'USDA', className: 'bg-blue-100 text-blue-700', tip: 'Imported from the USDA FoodData Central database.' },
  manual:       { label: 'Manual', className: 'bg-gray-100 text-gray-600', tip: 'Typed in by hand, or added through Lab Intake.' },
  supplier:     { label: 'Supplier', className: 'bg-purple-100 text-purple-700', tip: 'From a supplier’s web page or spec sheet.' },
  ai_extracted: { label: 'AI', className: 'bg-orange-100 text-orange-700', tip: 'Read by AI from photos of the package. Check it carefully.' },
  formulation:  { label: 'Formulation', className: 'bg-teal-100 text-teal-700', tip: 'Saved from one of your finalized formulations.' },
}

const col = createColumnHelper<IngredientListRow>()

// canEdit: false for members with view-only library access (editing controls are hidden)
export function IngredientTable({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [usdaOpen, setUsdaOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [editingIngredient, setEditingIngredient] = useState<EditableIngredient | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [onlyOnHand, setOnlyOnHand] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [onlyDuplicates, setOnlyDuplicates] = useState(false)

  const { data: ingredients = [], isLoading } = useQuery<IngredientListRow[]>({
    queryKey: ['ingredients'],
    queryFn: () => fetch('/api/ingredients').then(r => r.json()),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/ingredients/${id}`, { method: 'DELETE' }).then(async r => {
        if (!r.ok && r.status !== 204) throw new Error(await readErrorMessage(r, 'Failed to delete ingredient'))
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      toast.success('Ingredient deleted')
    },
    // Says why, e.g. which formulations still use it
    onError: (err: Error) => toast.error(err.message, { duration: 8000 }),
  })

  const columns = useMemo(
    () => [
      col.accessor('name', {
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-gray-900"
            onClick={() => column.toggleSorting()}
            data-tip="Sorts by name. Click again to reverse."
          >
            Name <ArrowUpDown size={12} />
          </button>
        ),
        cell: info => {
          const dupes = info.row.original.duplicateCount ?? 0
          return (
            <span className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900">{info.getValue()}</span>
              {info.row.original.onHand && (
                <span data-tip={GLOSSARY.onHand} className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">On hand</span>
              )}
              {dupes > 0 && canEdit && (
                <button
                  onClick={e => { e.stopPropagation(); setResolvingId(info.row.original.id) }}
                  data-tip="Another ingredient has the same name, brand, supplier and item code. Opens a dialog to rename this one or merge them."
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                >
                  <AlertTriangle size={11} /> Duplicate — rename or merge
                </button>
              )}
            </span>
          )
        },
      }),
      col.accessor(row => categoryPath(row), {
        id: 'category',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-gray-900"
            onClick={() => column.toggleSorting()}
            data-tip="Sorts by category. Click again to reverse."
          >
            Category <ArrowUpDown size={12} />
          </button>
        ),
        cell: info => info.getValue()
          ? <span className="text-xs text-gray-600">{info.getValue()}</span>
          : <span className="text-xs text-gray-300">—</span>,
      }),
      col.accessor('sourceType', {
        header: () => <Term t="source">Source</Term>,
        cell: info => {
          const s = SOURCE_LABELS[info.getValue()] ?? { label: info.getValue(), className: 'bg-gray-100 text-gray-600' }
          return (
            <span data-tip={s.tip} className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${s.className}`}>
              {s.label}
            </span>
          )
        },
      }),
      col.accessor('verification', {
        header: () => <Term tip="Whether someone has checked this ingredient’s data against a reliable source.">Verified</Term>,
        cell: info => (
          <span
            data-tip={info.getValue() === 'verified' ? GLOSSARY.verified : GLOSSARY.unverified}
            className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
              info.getValue() === 'verified'
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}
          >
            {info.getValue() === 'verified' ? 'Verified' : 'Unverified'}
          </span>
        ),
      }),
      col.accessor('fdcId', {
        header: () => <Term t="fdcId">FDC ID</Term>,
        cell: info => (
          <span className="text-xs text-gray-400 font-mono">{info.getValue() ?? '—'}</span>
        ),
      }),
      col.accessor('stockG', {
        header: () => <Term tip="Grams in stock, if you track it. Completing a batch subtracts what was used; red means below zero.">Stock</Term>,
        cell: info => {
          const v = info.getValue()
          if (v == null) return <span className="text-xs text-gray-300">—</span>
          const grams = parseFloat(v as string)
          return (
            <span className={`text-xs tabular-nums ${grams < 0 ? 'text-red-500 font-medium' : 'text-gray-600'}`}>
              {grams.toFixed(0)} g
            </span>
          )
        },
      }),
      col.accessor('formulationCount', {
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-gray-900"
            onClick={() => column.toggleSorting()}
            data-tip="Sorts by how many formulations use each ingredient. Click again to reverse."
          >
            Formulations <ArrowUpDown size={12} />
          </button>
        ),
        cell: info => {
          const count = info.getValue() ?? 0
          return count > 0
            ? <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-700">{count}</span>
            : <span className="text-xs text-gray-300">—</span>
        },
      }),
      // Edit / delete — hidden for view-only library access
      ...(canEdit ? [
        col.display({
          id: 'actions',
          header: '',
          cell: ({ row }) => (
            <div className="flex items-center gap-1">
              <button
                onClick={e => {
                  e.stopPropagation()
                  setEditingIngredient(toEditable(row.original))
                }}
                className="p-2 text-gray-300 hover:text-blue-500 transition-colors"
                aria-label="Edit"
                data-tip="Quick edit: category, on hand, stock, moisture, naturally derived and notes."
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={e => {
                  e.stopPropagation()
                  if (confirm(`Delete "${row.original.name}"?`)) {
                    deleteMutation.mutate(row.original.id)
                  }
                }}
                className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                aria-label="Delete"
                data-tip="Deletes this ingredient with its nutrients, documents and supplier links. Not allowed while a formulation uses it."
              >
                <Trash2 size={14} />
              </button>
            </div>
          ),
        }),
      ] : []),
    ],
    [deleteMutation, canEdit],
  )

  const duplicateRows = useMemo(() => ingredients.filter(i => (i.duplicateCount ?? 0) > 0), [ingredients])
  const visibleIngredients = useMemo(
    () => (onlyDuplicates ? duplicateRows : ingredients).filter(i =>
      (!onlyOnHand || i.onHand) &&
      (!categoryFilter || (categoryFilter === '__none' ? !i.category : i.category === categoryFilter))),
    [onlyDuplicates, duplicateRows, ingredients, onlyOnHand, categoryFilter],
  )
  const usedCategories = useMemo(
    () => categoryOptions(ingredients).filter(c => ingredients.some(i => i.category === c)),
    [ingredients],
  )

  const table = useReactTable({
    data: visibleIngredients,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  // Columns hidden on mobile to keep the table readable on small screens
  const MOBILE_HIDDEN = new Set(['category', 'sourceType', 'fdcId', 'stockG', 'formulationCount'])

  return (
    <>
      {duplicateRows.length > 0 && (
        <div className="flex items-start gap-3 mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 text-sm text-amber-900">
            <p className="font-medium">
              {duplicateRows.length} ingredient{duplicateRows.length === 1 ? ' is' : 's are'} duplicated in your library.
            </p>
            <p className="text-amber-800">
              Entries need a different name, brand, supplier or item code. Rename each one, or merge the duplicates together.
            </p>
          </div>
          <button
            onClick={() => setOnlyDuplicates(v => !v)}
            data-tip={onlyDuplicates ? 'Shows every ingredient again.' : 'Lists only the duplicated entries, so you can rename or merge them.'}
            className="px-3 py-1.5 text-xs font-medium border border-amber-300 rounded-md bg-white text-amber-800 hover:bg-amber-100 shrink-0"
          >
            {onlyDuplicates ? 'Show all' : 'Show duplicates only'}
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            placeholder="Filter ingredients…"
            aria-label="Filter ingredients"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md
                       focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        {canEdit && (
          <div className="flex gap-2 flex-wrap">
            <Link
              href="/ingredients/intake"
              data-tip="Add many ingredients at once from typed names, a pasted list or photos of container labels."
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-emerald-200
                         rounded-md bg-white hover:bg-emerald-50 text-emerald-700 transition-colors"
            >
              <ClipboardList size={14} />
              Lab intake
            </Link>
            <button
              onClick={() => setUsdaOpen(true)}
              data-tip="Imports an ingredient with complete nutrition from the USDA database. Arrives verified."
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200
                         rounded-md bg-white hover:bg-gray-50 text-gray-700 transition-colors"
            >
              <Database size={14} />
              <span className="hidden sm:inline">Search </span>USDA
            </button>
            <button
              onClick={() => setPhotoOpen(true)}
              data-tip="Adds an ingredient from photos of its package. AI reads the name, nutrition and ingredient list."
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-orange-200
                         rounded-md bg-white hover:bg-orange-50 text-orange-600 transition-colors"
            >
              <Camera size={14} />
              <span className="hidden sm:inline">Scan </span>photos
            </button>
            <button
              onClick={() => setAddOpen(true)}
              data-tip="Adds an ingredient by typing it in, or from a supplier’s product web page."
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600
                         text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          aria-label="Category filter"
          data-tip="Shows only ingredients in one category, or those without one."
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All categories</option>
          {usedCategories.map(c => <option key={c} value={c}>{c}</option>)}
          <option value="__none">Uncategorized</option>
        </select>
        <label data-tip="Shows only ingredients marked as physically in your lab." className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white text-gray-700 cursor-pointer">
          <input type="checkbox" checked={onlyOnHand} onChange={e => setOnlyOnHand(e.target.checked)} className="rounded border-gray-300" />
          On hand only
        </label>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-gray-400">Loading…</div>
        ) : ingredients.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">
            No ingredients yet — search USDA or add manually.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id}>
                    {hg.headers.map(header => (
                      <th
                        key={header.id}
                        className={`px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide ${
                          MOBILE_HIDDEN.has(header.column.id) ? 'hidden sm:table-cell' : ''
                        }`}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-gray-100">
                {table.getRowModel().rows.map(row => (
                  <tr
                    key={row.id}
                    onClick={() => router.push(`/ingredients/${row.original.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        className={`px-4 py-3 ${
                          MOBILE_HIDDEN.has(cell.column.id) ? 'hidden sm:table-cell' : ''
                        }`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-2 text-xs text-gray-400">
        {table.getFilteredRowModel().rows.length} of {ingredients.length} ingredient
        {ingredients.length !== 1 ? 's' : ''}
      </div>

      <ArchivedRecords kind="ingredients" canEdit={canEdit} />

      <UsdaSearchDialog
        open={usdaOpen}
        onClose={() => setUsdaOpen(false)}
        onImported={() => {
          queryClient.invalidateQueries({ queryKey: ['ingredients'] })
          setUsdaOpen(false)
        }}
      />
      <AddIngredientDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['ingredients'] })
          setAddOpen(false)
        }}
      />
      <PhotoIngredientDialog
        open={photoOpen}
        onClose={() => setPhotoOpen(false)}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['ingredients'] })
          setPhotoOpen(false)
        }}
      />
      <EditIngredientDialog
        ingredient={editingIngredient}
        onClose={() => setEditingIngredient(null)}
      />
      {resolvingId && (
        <DuplicateResolveDialog
          ingredientId={resolvingId}
          onClose={() => setResolvingId(null)}
        />
      )}
    </>
  )
}
