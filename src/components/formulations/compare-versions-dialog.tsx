'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import type { FormulationDetail, Nutrient } from '@/lib/types'
import { calcNutrientProfile, formatAmt, type CalcResult } from '@/lib/formulation-calc'
import { toLossStep } from '@/lib/process-loss'
import { formatWeightG } from '@/lib/weight'
import type { GlossaryKey } from '@/lib/glossary'
import { Term } from '@/components/term'

type Iteration = FormulationDetail['iterations'][number]

function useVersion(id: string) {
  return useQuery<FormulationDetail>({
    queryKey: ['formulation', id],
    queryFn: () =>
      fetch(`/api/formulations/${id}`).then(r => {
        if (!r.ok) throw new Error('Not found')
        return r.json()
      }),
  })
}

function profile(f: FormulationDetail | undefined, allNutrients: Nutrient[]): CalcResult | null {
  if (!f || f.lines.length === 0) return null
  return calcNutrientProfile({
    lines: f.lines.map(l => ({
      ingredientId: l.ingredientId,
      weightG: parseFloat(l.weightG),
      nutrients: l.nutrients.map(n => ({ ...n, amountPer100g: parseFloat(n.amountPer100g) })),
    })),
    allNutrients: allNutrients.map(n => ({
      id: n.id, name: n.name, unit: n.unit, category: n.category,
      dailyValueAmount: n.dailyValueAmount != null ? Number(n.dailyValueAmount) : null,
    })),
    servingSizeG: f.servingSizeG ? parseFloat(f.servingSizeG) : undefined,
    steps: f.processSteps.map(toLossStep),
  })
}

const pct = (n: number) => `${n.toFixed(2)}%`
// Treat tiny float noise as no change
const differs = (a: number | null, b: number | null) =>
  a == null || b == null ? a !== b : Math.abs(a - b) > Math.max(Math.abs(a), Math.abs(b)) * 0.001 + 1e-9

function Delta({ a, b, fmt }: { a: number | null; b: number | null; fmt: (n: number) => string }) {
  if (a == null || b == null || !differs(a, b)) return <span className="text-gray-300">—</span>
  const d = b - a
  return <span className={d > 0 ? 'text-green-700' : 'text-red-600'}>{d > 0 ? '+' : '−'}{fmt(Math.abs(d))}</span>
}

const versionLabel = (it: Iteration | undefined) =>
  it ? `v${it.version}${it.iterationNote ? ` — ${it.iterationNote.replace(/\s+/g, ' ').slice(0, 40)}` : ''}` : ''

/** Side-by-side view of two saved versions: what changed in the recipe and in the nutrition. */
export function CompareVersionsDialog({ currentId, iterations, allNutrients, onClose }: {
  currentId: string
  iterations: Iteration[]   // newest first
  allNutrients: Nutrient[]
  onClose: () => void
}) {
  // Default: the version before this one on the left, this one on the right
  const idx = iterations.findIndex(it => it.id === currentId)
  const older = iterations[idx + 1] ?? iterations[idx - 1] ?? iterations[0]
  const [aId, setAId] = useState(older.id)
  const [bId, setBId] = useState(currentId)
  const [onlyChanges, setOnlyChanges] = useState(true)

  const { data: a, isLoading: aLoading } = useVersion(aId)
  const { data: b, isLoading: bLoading } = useVersion(bId)
  const pa = useMemo(() => profile(a, allNutrients), [a, allNutrients])
  const pb = useMemo(() => profile(b, allNutrients), [b, allNutrients])

  const ingredientRows = useMemo(() => {
    if (!a || !b) return []
    const total = (f: FormulationDetail) => f.lines.reduce((s, l) => s + parseFloat(l.weightG), 0)
    const ta = total(a), tb = total(b)
    const rows = new Map<string, { name: string; ag: number | null; ap: number | null; bg: number | null; bp: number | null }>()
    for (const l of [...a.lines].sort((x, y) => x.position - y.position)) {
      const g = parseFloat(l.weightG)
      rows.set(l.ingredientId, { name: l.ingredientName, ag: g, ap: ta > 0 ? (g / ta) * 100 : 0, bg: null, bp: null })
    }
    for (const l of [...b.lines].sort((x, y) => x.position - y.position)) {
      const g = parseFloat(l.weightG)
      const row = rows.get(l.ingredientId) ?? { name: l.ingredientName, ag: null, ap: null, bg: null, bp: null }
      rows.set(l.ingredientId, { ...row, bg: g, bp: tb > 0 ? (g / tb) * 100 : 0 })
    }
    return [...rows.entries()].map(([id, r]) => ({ id, ...r }))
  }, [a, b])

  const nutrientRows = useMemo(() => {
    const byId = (r: CalcResult | null) => new Map((r?.results ?? []).map(n => [n.nutrientId, n.perFinished100g]))
    const ma = byId(pa), mb = byId(pb)
    return [...allNutrients]
      .sort((x, y) => (x.displayOrder ?? 0) - (y.displayOrder ?? 0))
      .filter(n => (ma.get(n.id) ?? 0) !== 0 || (mb.get(n.id) ?? 0) !== 0)
      .map(n => ({ id: n.id, name: n.name, unit: n.unit, a: ma.get(n.id) ?? 0, b: mb.get(n.id) ?? 0 }))
  }, [pa, pb, allNutrients])

  const shownIngredients = onlyChanges
    ? ingredientRows.filter(r => differs(r.ag, r.bg) || differs(r.ap, r.bp))
    : ingredientRows
  const shownNutrients = onlyChanges ? nutrientRows.filter(r => differs(r.a, r.b)) : nutrientRows

  const select = (value: string, onChange: (v: string) => void, tip: string) => (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      data-tip={tip}
      className="text-sm border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[14rem]"
    >
      {iterations.map(it => <option key={it.id} value={it.id}>{versionLabel(it)}</option>)}
    </select>
  )

  const summary: Array<{ label: string; t?: GlossaryKey; a: number | null; b: number | null; fmt: (n: number) => string }> = [
    { label: 'Batch weight (g)', t: 'batchSize', a: pa?.totalWeightG ?? null, b: pb?.totalWeightG ?? null, fmt: formatWeightG },
    { label: 'Finished weight (g)', t: 'finishedWeight', a: pa?.finishedWeightG ?? null, b: pb?.finishedWeightG ?? null, fmt: n => formatWeightG(Math.round(n * 10) / 10) },
    { label: 'Serving size (g)', t: 'servingSize', a: a?.servingSizeG ? parseFloat(a.servingSizeG) : null, b: b?.servingSizeG ? parseFloat(b.servingSizeG) : null, fmt: formatWeightG },
    { label: 'Ingredients', a: a?.lines.length ?? null, b: b?.lines.length ?? null, fmt: String },
    { label: 'Process steps', t: 'processStep', a: a?.processSteps.length ?? null, b: b?.processSteps.length ?? null, fmt: String },
  ]

  const th = 'font-medium px-3 py-2 text-right whitespace-nowrap'
  const td = 'px-3 py-1.5 text-right tabular-nums whitespace-nowrap'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 p-5 space-y-4 max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Compare versions</h3>
            <p className="text-sm text-gray-500 mt-1">Compares the saved versions. Changes are shown from the left version to the right one.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          {select(aId, setAId, 'The version to compare from (left)')}
          <span>→</span>
          {select(bId, setBId, 'The version to compare to (right). Changes are shown from left to right.')}
          <label
            className="flex items-center gap-1.5 ml-auto text-sm text-gray-600 cursor-pointer"
            data-tip="Hides ingredients and nutrients that are the same in both versions"
          >
            <input type="checkbox" className="rounded border-gray-300" checked={onlyChanges} onChange={e => setOnlyChanges(e.target.checked)} />
            Only show changes
          </label>
        </div>

        <div className="overflow-y-auto space-y-5 -mx-1 px-1">
          {aLoading || bLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : !a || !b ? (
            <p className="text-sm text-red-500">Could not load one of the versions.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="font-medium px-3 py-2 text-left">Summary</th>
                    <th className={th}>v{a.version}</th>
                    <th className={th}>v{b.version}</th>
                    <th className={th}>Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {summary.map(r => (
                    <tr key={r.label}>
                      <td className="px-3 py-1.5 text-gray-700"><Term t={r.t}>{r.label}</Term></td>
                      <td className={td}>{r.a != null ? r.fmt(r.a) : '—'}</td>
                      <td className={td}>{r.b != null ? r.fmt(r.b) : '—'}</td>
                      <td className={td}><Delta a={r.a} b={r.b} fmt={r.fmt} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-2">Ingredients</h4>
                {shownIngredients.length === 0 ? (
                  <p className="text-sm text-gray-400">No differences in the ingredients.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500">
                        <tr>
                          <th className="font-medium px-3 py-2 text-left">Ingredient</th>
                          <th className={th}>v{a.version} g</th>
                          <th className={th}>v{a.version} %</th>
                          <th className={th}>v{b.version} g</th>
                          <th className={th}>v{b.version} %</th>
                          <th className={th}><Term tip="The change in usage % from the left version to the right one, in percentage points.">Change (%)</Term></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {shownIngredients.map(r => (
                          <tr key={r.id} className={r.ag == null ? 'bg-green-50/50' : r.bg == null ? 'bg-red-50/50' : ''}>
                            <td className="px-3 py-1.5 text-gray-800">
                              {r.name}
                              {r.ag == null && <span className="ml-1.5 text-xs text-green-700">added</span>}
                              {r.bg == null && <span className="ml-1.5 text-xs text-red-600">removed</span>}
                            </td>
                            <td className={td}>{r.ag != null ? formatWeightG(r.ag) : '—'}</td>
                            <td className={td}>{r.ap != null ? pct(r.ap) : '—'}</td>
                            <td className={td}>{r.bg != null ? formatWeightG(r.bg) : '—'}</td>
                            <td className={td}>{r.bp != null ? pct(r.bp) : '—'}</td>
                            <td className={td}><Delta a={r.ap ?? 0} b={r.bp ?? 0} fmt={n => pct(n)} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-2">Nutrition <Term t="per100gFinished">per 100 g finished</Term></h4>
                {shownNutrients.length === 0 ? (
                  <p className="text-sm text-gray-400">No differences in the nutrition.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500">
                        <tr>
                          <th className="font-medium px-3 py-2 text-left">Nutrient</th>
                          <th className={th}>v{a.version}</th>
                          <th className={th}>v{b.version}</th>
                          <th className={th}>Change</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {shownNutrients.map(r => (
                          <tr key={r.id}>
                            <td className="px-3 py-1.5 text-gray-800">{r.name} <span className="text-xs text-gray-400">({r.unit})</span></td>
                            <td className={td}>{formatAmt(r.a, r.unit)}</td>
                            <td className={td}>{formatAmt(r.b, r.unit)}</td>
                            <td className={td}><Delta a={r.a} b={r.b} fmt={n => formatAmt(n, r.unit)} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
