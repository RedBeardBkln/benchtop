'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { computeCogs, formatMoney, fromPerKg, KG_PER_LB } from '@/lib/costing'
import type { IngredientCostInfo } from '@/lib/costing-server'
import { COGS_FIGURES, type CogsFigure, type CostUnit } from '@/lib/preferences'
import { usePreferences } from '@/lib/use-preferences'
import { readErrorMessage } from '@/lib/utils'

const FIGURE_LABELS: Record<CogsFigure, (u: CostUnit) => string> = {
  batch: () => 'Per batch',
  perMass: u => `Per ${u} finished`,
  serving: () => 'Per serving',
  unit: () => 'Per unit',
}

// The formulation's COGS tab: raw material cost from each ingredient's cost (Cost tab on the
// ingredient), on the formula as it stands in the editor, including unsaved changes.
export function CogsPanel({
  formulationId,
  lines,
  finishedWeightG,
  yieldPct,
  servingSizeG,
  unitSizeG,
  canEdit,
  hasUnsavedChanges,
}: {
  formulationId: string
  lines: Array<{ key: string; ingredientId: string; ingredientName: string; weightG: number }>
  finishedWeightG: number
  yieldPct: number
  servingSizeG: number | null
  unitSizeG: number | null
  canEdit: boolean
  hasUnsavedChanges: boolean
}) {
  const queryClient = useQueryClient()
  const { prefs, setPrefs } = usePreferences()
  const mass = prefs.cogsMassUnit
  const figures = prefs.cogsFigures

  const ids = useMemo(() => [...new Set(lines.map(l => l.ingredientId))].sort(), [lines])
  const { data: costs, isLoading } = useQuery<Record<string, IngredientCostInfo>>({
    queryKey: ['ingredient-costs', ids],
    queryFn: () => fetch(`/api/ingredients/costs?ids=${ids.join(',')}`).then(r => r.json()),
    enabled: ids.length > 0,
  })

  const [unitInput, setUnitInput] = useState(unitSizeG ? String(unitSizeG) : '')
  const saveUnit = useMutation({
    mutationFn: async (g: number | null) => {
      const r = await fetch(`/api/formulations/${formulationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitSizeG: g }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not save unit size'))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['formulation', formulationId] }),
    onError: (e: Error) => toast.error(e.message),
  })
  const unitG = unitInput.trim() && Number(unitInput) > 0 ? Number(unitInput) : null
  function commitUnit() {
    if (unitG === unitSizeG) return
    if (unitInput.trim() && unitG == null) { setUnitInput(unitSizeG ? String(unitSizeG) : ''); return }
    saveUnit.mutate(unitG)
  }

  const cogs = useMemo(() => computeCogs({
    lines: lines.map(l => ({ key: l.key, ingredientId: l.ingredientId, name: l.ingredientName, weightG: l.weightG })),
    costPerKg: id => costs?.[id]?.cost?.perKg ?? null,
    finishedWeightG,
    servingSizeG,
    unitSizeG: unitG,
  }), [lines, costs, finishedWeightG, servingSizeG, unitG])

  // Biggest cost first; ingredients without a cost at the end, in formula order
  const rows = [...cogs.lines].sort((a, b) => (b.cost ?? -1) - (a.cost ?? -1))
  const missing = cogs.lines.filter(l => l.cost == null)
  const qty = (g: number) => (mass === 'lb' ? g / 1000 / KG_PER_LB : g / 1000)
  const fmtQty = (g: number) => qty(g).toLocaleString('en-US', { maximumFractionDigits: 3 })

  function toggleFigure(f: CogsFigure) {
    const next = figures.includes(f) ? figures.filter(x => x !== f) : COGS_FIGURES.filter(x => x === f || figures.includes(x))
    setPrefs({ cogsFigures: next })
  }

  const figureValue: Record<CogsFigure, { value: number | null; hint: string; empty: string }> = {
    batch: {
      value: lines.length ? cogs.batchCost : null,
      hint: `${fmtQty(cogs.totalWeightG)} ${mass} in`,
      empty: 'Add ingredients',
    },
    perMass: {
      value: cogs.perKgFinished != null ? fromPerKg(cogs.perKgFinished, mass) : null,
      hint: `${fmtQty(finishedWeightG)} ${mass} out · ${yieldPct.toFixed(1)}% yield`,
      empty: 'No finished weight',
    },
    serving: {
      value: cogs.perServing,
      hint: servingSizeG ? `${servingSizeG} g serving` : '',
      empty: 'Set a serving size on the Formula tab',
    },
    unit: {
      value: cogs.perUnit,
      hint: cogs.unitsPerBatch != null ? `${unitG} g unit · ${cogs.unitsPerBatch.toLocaleString('en-US', { maximumFractionDigits: 1 })} per batch` : '',
      empty: 'Set a unit size below',
    },
  }

  return (
    <div className="space-y-4">
      {/* Figure picker */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Figures to show">
          <span className="text-xs text-gray-500 mr-1">Show:</span>
          {COGS_FIGURES.map(f => {
            const on = figures.includes(f)
            return (
              <button
                key={f}
                type="button"
                aria-pressed={on}
                onClick={() => toggleFigure(f)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  on ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {FIGURE_LABELS[f](mass)}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-1 text-xs" role="group" aria-label="Weight unit">
          {(['kg', 'lb'] as const).map(u => (
            <button
              key={u}
              type="button"
              aria-pressed={mass === u}
              onClick={() => setPrefs({ cogsMassUnit: u })}
              className={`px-2 py-1 rounded-md border ${mass === u ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      {figures.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {figures.map(f => {
            const { value, hint, empty } = figureValue[f]
            return (
              <div key={f} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                <div className="text-xs text-gray-500">{FIGURE_LABELS[f](mass)}</div>
                <div className="text-xl font-semibold text-gray-900 tabular-nums">
                  {value != null ? formatMoney(value) : <span className="text-gray-300">—</span>}
                </div>
                <div className="text-[11px] text-gray-400 truncate">{value != null ? hint : empty}</div>
              </div>
            )
          })}
        </div>
      )}

      {figures.includes('unit') && (
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="cogs-unit-size" className="text-xs font-medium text-gray-500">Unit / package size (g)</label>
          <input
            id="cogs-unit-size"
            type="number"
            min="0"
            step="any"
            value={unitInput}
            onChange={e => setUnitInput(e.target.value)}
            onBlur={commitUnit}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
            disabled={!canEdit}
            placeholder="e.g. 500"
            className="w-24 px-2 py-0.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 tabular-nums"
          />
          <span className="text-xs text-gray-400">finished weight of one sellable unit</span>
        </div>
      )}

      {(missing.length > 0 && !isLoading) && (
        <div role="status" className="flex items-start gap-2 px-3 py-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div>
            {missing.length === lines.length
              ? 'None of these ingredients has a cost yet. '
              : `Totals leave out ${missing.length} ingredient${missing.length === 1 ? '' : 's'} with no cost: `}
            {missing.map((l, i) => (
              <span key={l.key}>
                {i > 0 && ', '}
                <Link href={`/ingredients/${l.ingredientId}`} className="underline hover:text-amber-900">{l.name}</Link>
              </span>
            ))}
            . Add costs on each ingredient&apos;s Cost tab.
          </div>
        </div>
      )}

      {hasUnsavedChanges && (
        <p className="text-xs text-gray-500">Includes unsaved changes to the formula.</p>
      )}

      {/* Breakdown */}
      {lines.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Ingredient</th>
                <th className="px-3 py-2 text-right font-medium">% of formula</th>
                <th className="px-3 py-2 text-right font-medium">Qty ({mass})</th>
                <th className="px-3 py-2 text-right font-medium">Cost / {mass}</th>
                <th className="px-3 py-2 text-right font-medium">Batch cost</th>
                <th className="px-3 py-2 text-left font-medium w-40">Share of cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(l => {
                const info = costs?.[l.ingredientId]
                return (
                  <tr key={l.key}>
                    <td className="px-3 py-2">
                      <Link href={`/ingredients/${l.ingredientId}`} className="text-gray-900 hover:text-blue-700 hover:underline">{l.name}</Link>
                      {info?.cost?.source === 'supplier' && (
                        <div className="text-[11px] text-gray-400">{info.cost.supplierName}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600">{l.pct.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600">{fmtQty(l.weightG)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                      {l.perKg != null ? formatMoney(fromPerKg(l.perKg, mass)) : <span className="text-amber-600">{isLoading ? '…' : 'No cost'}</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-900">
                      {l.cost != null ? formatMoney(l.cost) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {l.sharePct != null && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${l.sharePct}%` }} />
                          </div>
                          <span className="w-12 text-right text-xs tabular-nums text-gray-600">{l.sharePct.toFixed(1)}%</span>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t border-gray-200 bg-gray-50 font-medium">
              <tr>
                <td className="px-3 py-2">Total{missing.length > 0 && <span className="font-normal text-xs text-amber-700"> (partial)</span>}</td>
                <td className="px-3 py-2 text-right tabular-nums">100.00%</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtQty(cogs.totalWeightG)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                  {cogs.totalWeightG > 0 && missing.length === 0 ? formatMoney(fromPerKg((cogs.batchCost * 1000) / cogs.totalWeightG, mass)) : ''}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(cogs.batchCost)}</td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {lines.length === 0 && (
        <p className="text-sm text-gray-400">Add ingredients on the Formula tab to see their cost.</p>
      )}
      <p className="text-[11px] text-gray-400">
        Raw materials only, on the weights put in. Per {mass}, per-serving and per-unit figures divide by the finished
        weight, so process loss raises them. Packaging, labour and overhead aren&apos;t included.
      </p>
    </div>
  )
}
