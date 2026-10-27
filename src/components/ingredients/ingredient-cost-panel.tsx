'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, DollarSign } from 'lucide-react'
import type { IngredientSupplierWithName } from '@/lib/types'
import { formatMoney, fromPerKg, pricePerKg, resolveIngredientCost, toPerKg } from '@/lib/costing'
import type { CostUnit } from '@/lib/preferences'
import { readErrorMessage } from '@/lib/utils'
import { Term } from '@/components/term'

// The Cost tab on an ingredient: a manually entered price ($/kg or $/lb), or one of its supplier
// prices chosen as the cost. Formulations use whichever resolveIngredientCost picks.
export function IngredientCostPanel({
  ingredientId,
  defaultCostPerKg,
  costUnit,
  suppliers,
  onGoToSuppliers,
  canEdit,
}: {
  ingredientId: string
  defaultCostPerKg: string | null
  costUnit: string
  suppliers: IngredientSupplierWithName[]
  onGoToSuppliers: () => void
  /** false for view-only library access: shows the cost, hides the controls */
  canEdit: boolean
}) {
  const queryClient = useQueryClient()
  const unit: CostUnit = costUnit === 'lb' ? 'lb' : 'kg'
  const manualPerKg = defaultCostPerKg ? parseFloat(defaultCostPerKg) : null
  const shown = (perKg: number, u: CostUnit) => String(+fromPerKg(perKg, u).toFixed(4))
  const [price, setPrice] = useState(manualPerKg != null ? shown(manualPerKg, unit) : '')
  const [entryUnit, setEntryUnit] = useState<CostUnit>(unit)

  const { cost, warning } = resolveIngredientCost(defaultCostPerKg, suppliers)
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['ingredient', ingredientId] })
    queryClient.invalidateQueries({ queryKey: ['ingredient-costs'] })
  }

  const saveManual = useMutation({
    mutationFn: async (body: { defaultCostPerKg: number | null; costUnit: CostUnit }) => {
      const r = await fetch(`/api/ingredients/${ingredientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not save cost'))
    },
    onSuccess: () => { invalidate(); toast.success('Cost saved') },
    onError: (e: Error) => toast.error(e.message),
  })

  const chooseLink = useMutation({
    mutationFn: async ({ linkId, use }: { linkId: string; use: boolean }) => {
      const r = await fetch(`/api/ingredients/${ingredientId}/suppliers/${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useForCost: use }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not update cost source'))
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  })

  const parsed = price.trim() === '' ? null : Number(price)
  const priceInvalid = parsed != null && !(Number.isFinite(parsed) && parsed > 0)
  const dirty = (parsed == null ? null : +toPerKg(parsed, entryUnit).toFixed(4)) !== (manualPerKg == null ? null : +manualPerKg.toFixed(4))
    || entryUnit !== unit

  function submitManual(e: React.FormEvent) {
    e.preventDefault()
    if (priceInvalid) return
    saveManual.mutate({ defaultCostPerKg: parsed == null ? null : toPerKg(parsed, entryUnit), costUnit: entryUnit })
  }

  const priced = suppliers.filter(s => s.costPerUnit != null)

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Current cost */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 flex items-start gap-3">
        <DollarSign size={18} className="text-gray-400 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <div className="text-xs text-gray-500"><Term t="costPerKg">Cost</Term> used in formulations</div>
          {cost ? (
            <>
              <div className="text-lg font-semibold text-gray-900 tabular-nums">
                {formatMoney(fromPerKg(cost.perKg, unit))} / {unit}
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({formatMoney(fromPerKg(cost.perKg, unit === 'kg' ? 'lb' : 'kg'))} / {unit === 'kg' ? 'lb' : 'kg'})
                </span>
              </div>
              <div className="text-xs text-gray-500">
                {cost.source === 'supplier' ? `From ${cost.supplierName}'s price` : 'Entered manually'}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-500">No cost yet. Enter a price below or use a supplier&apos;s price.</div>
          )}
          {warning && (
            <p className="mt-1 text-xs text-amber-700">
              {warning === 'supplier-price-missing'
                ? 'The chosen supplier link has no price, so it isn’t used.'
                : 'The chosen supplier price isn’t per kg, g, lb, oz or metric ton, so it can’t be converted and isn’t used.'}
              {cost?.source === 'manual' && ' The manual price is used instead.'}
            </p>
          )}
        </div>
      </div>

      {/* Manual price */}
      {canEdit && <form onSubmit={submitManual} className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900">Manual price</h3>
        <p className="text-xs text-gray-500 mb-3">
          Used when no supplier price is chosen below. Leave blank to clear it.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500">$</span>
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={price}
            onChange={e => setPrice(e.target.value)}
            aria-label="Price"
            data-tip="Your own price for this ingredient, per kg or lb. Leave blank and save to clear it."
            placeholder="0.00"
            className="w-32 px-2 py-1.5 text-sm border border-gray-300 rounded-md tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-500">per</span>
          <select
            value={entryUnit}
            onChange={e => {
              const next = e.target.value as CostUnit
              // Convert what's typed so the same price is kept in the new unit
              if (parsed != null && !priceInvalid) setPrice(shown(toPerKg(parsed, entryUnit), next))
              setEntryUnit(next)
            }}
            aria-label="Price unit"
            data-tip="The unit the price is per. Switching converts the number you typed so the price stays the same."
            className="px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
          >
            <option value="kg">kg</option>
            <option value="lb">lb</option>
          </select>
          <button
            type="submit"
            disabled={!dirty || priceInvalid || saveManual.isPending}
            data-tip={priceInvalid ? 'Enter a price above zero first.' : !dirty ? 'Nothing has changed yet.' : 'Saves this manual price. It’s used whenever no supplier price is chosen.'}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saveManual.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
        {priceInvalid && <p className="mt-1 text-xs text-red-600">Enter a price above zero.</p>}
      </form>}

      {/* Supplier prices */}
      {canEdit && <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900">Use a <Term t="useForCost">supplier&apos;s price</Term></h3>
        <p className="text-xs text-gray-500 mb-3">
          Choose one to use instead of the manual price. Prices per kg, g, lb, oz or metric ton convert automatically.
        </p>
        {priced.length === 0 ? (
          <p className="text-sm text-gray-500">
            No supplier prices yet.{' '}
            <button type="button" onClick={onGoToSuppliers} data-tip="Opens the Suppliers tab, where you link a supplier and enter its price." className="text-blue-600 hover:underline">
              Add one on the Suppliers tab →
            </button>
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {priced.map(s => {
              const per = parseFloat(s.costPerUnit!)
              const perKg = pricePerKg(per, s.packUnit)
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="text-sm text-gray-900">{s.supplierName}</div>
                    <div className="text-xs text-gray-500 tabular-nums">
                      {formatMoney(per)} / {s.packUnit || 'unit'}
                      {s.packSize && ` · ${parseFloat(s.packSize)} ${s.packUnit ?? ''} pack`}
                      {perKg != null && s.packUnit !== unit && ` · ${formatMoney(fromPerKg(perKg, unit))} / ${unit}`}
                      {perKg == null && ' · can’t convert to a weight price'}
                    </div>
                  </div>
                  {s.useForCost ? (
                    <button
                      type="button"
                      onClick={() => chooseLink.mutate({ linkId: s.id, use: false })}
                      disabled={chooseLink.isPending}
                      data-tip="Stops using this supplier’s price. Formulations fall back to the manual price, if there is one."
                      className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                    >
                      <Check size={12} /> In use
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => chooseLink.mutate({ linkId: s.id, use: true })}
                      disabled={chooseLink.isPending || perKg == null}
                      data-tip={perKg == null ? 'This price isn’t per kg, g, lb, oz or metric ton, so it can’t be converted to a cost.' : 'Makes this supplier’s price the cost formulations use, instead of the manual price.'}
                      className="px-2.5 py-1 text-xs rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Use this price
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>}
    </div>
  )
}
