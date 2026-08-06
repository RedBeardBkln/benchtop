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
import { Search, Plus, Database, Trash2, ArrowUpDown, Camera, Edit2 } from 'lucide-react'
import { toast } from 'sonner'
import type { IngredientListRow } from '@/lib/types'
import { UsdaSearchDialog } from './usda-search-dialog'
import { AddIngredientDialog } from './add-ingredient-dialog'
import { PhotoIngredientDialog } from './photo-ingredient-dialog'
import { EditIngredientDialog } from './edit-ingredient-dialog'

const SOURCE_LABELS: Record<string, { label: string; className: string }> = {
  usda:         { label: 'USDA', className: 'bg-blue-100 text-blue-700' },
  manual:       { label: 'Manual', className: 'bg-gray-100 text-gray-600' },
  supplier:     { label: 'Supplier', className: 'bg-purple-100 text-purple-700' },
  ai_extracted: { label: 'AI', className: 'bg-orange-100 text-orange-700' },
}

const col = createColumnHelper<IngredientListRow>()

export function IngredientTable() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [usdaOpen, setUsdaOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [editingIngredient, setEditingIngredient] = useState<{ id: string; name: string; stockG: string | null } | null>(null)

  const { data: ingredients = [], isLoading } = useQuery<IngredientListRow[]>({
    queryKey: ['ingredients'],
    queryFn: () => fetch('/api/ingredients').then(r => r.json()),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/ingredients/${id}`, { method: 'DELETE' }).then(r => {
        if (!r.ok && r.status !== 204) throw new Error('Delete failed')
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      toast.success('Ingredient deleted')
    },
    onError: () => toast.error('Failed to delete ingredient'),
  })

  const columns = useMemo(
    () => [
      col.accessor('name', {
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-gray-900"
            onClick={() => column.toggleSorting()}
          >
            Name <ArrowUpDown size={12} />
          </button>
        ),
        cell: info => (
          <span className="font-medium text-gray-900">{info.getValue()}</span>
        ),
      }),
      col.accessor('sourceType', {
        header: 'Source',
        cell: info => {
          const s = SOURCE_LABELS[info.getValue()] ?? { label: info.getValue(), className: 'bg-gray-100 text-gray-600' }
          return (
            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${s.className}`}>
              {s.label}
            </span>
          )
        },
      }),
      col.accessor('verification', {
        header: 'Verified',
        cell: info => (
          <span
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
      col.accessor('isAbSpi', {
        header: 'AB SPI',
        cell: info =>
          info.getValue() ? (
            <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
              AB SPI
            </span>
          ) : null,
      }),
      col.accessor('isIsolateOrConcentrate', {
        header: 'Isolate',
        cell: info =>
          info.getValue() ? (
            <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
              Isolate/Conc.
            </span>
          ) : null,
      }),
      col.accessor('fdcId', {
        header: 'FDC ID',
        cell: info => (
          <span className="text-xs text-gray-400 font-mono">{info.getValue() ?? '—'}</span>
        ),
      }),
      col.accessor('stockG', {
        header: 'Stock',
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
      col.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <button
              onClick={e => {
                e.stopPropagation()
                setEditingIngredient({
                  id: row.original.id,
                  name: row.original.name,
                  stockG: row.original.stockG as string | null,
                })
              }}
              className="p-1 text-gray-300 hover:text-blue-500 transition-colors"
              title="Edit"
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
              className="p-1 text-gray-300 hover:text-red-500 transition-colors"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ),
      }),
    ],
    [deleteMutation],
  )

  const table = useReactTable({
    data: ingredients,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  // Columns hidden on mobile to keep the table readable on small screens
  const MOBILE_HIDDEN = new Set(['sourceType', 'isAbSpi', 'isIsolateOrConcentrate', 'fdcId', 'stockG', 'formulationCount'])

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            placeholder="Filter ingredients…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md
                       focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setUsdaOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200
                       rounded-md bg-white hover:bg-gray-50 text-gray-700 transition-colors"
          >
            <Database size={14} />
            <span className="hidden sm:inline">Search </span>USDA
          </button>
          <button
            onClick={() => setPhotoOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-orange-200
                       rounded-md bg-white hover:bg-orange-50 text-orange-600 transition-colors"
          >
            <Camera size={14} />
            <span className="hidden sm:inline">Scan </span>photos
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600
                       text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} /> Add
          </button>
        </div>
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
        open={editingIngredient !== null}
        ingredientId={editingIngredient?.id ?? null}
        currentName={editingIngredient?.name ?? ''}
        currentStockG={editingIngredient?.stockG ?? null}
        onClose={() => setEditingIngredient(null)}
      />
    </>
  )
}
