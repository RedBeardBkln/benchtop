'use client'

import { useState } from 'react'

export type SolverBounds = { minPct: number | null; maxPct: number | null }

type Row = { key: string; name: string; locked: boolean } & SolverBounds

const PCT_RE = /^\d*\.?\d{0,4}$/

const toText = (v: number | null) => (v == null ? '' : String(v))
const toNum = (s: string) => (s.trim() === '' || s === '.' ? null : parseFloat(s))

/**
 * Per-ingredient usage limits (% of the batch) that Solve must stay within. Blank means no limit
 * (0–100 %). Render only while open so the boxes start from the current values each time.
 */
export function SolverBoundsDialog({ rows, readOnly, onClose, onApply }: {
  rows: Row[]
  readOnly: boolean
  onClose: () => void
  onApply: (bounds: Record<string, SolverBounds>) => void
}) {
  const [draft, setDraft] = useState<Record<string, { min: string; max: string }>>(
    () => Object.fromEntries(rows.map(r => [r.key, { min: toText(r.minPct), max: toText(r.maxPct) }])),
  )

  const parsed = rows.map(r => {
    const d = draft[r.key]
    return { ...r, min: toNum(d.min), max: toNum(d.max) }
  })
  const rowError = (p: (typeof parsed)[number]) =>
    p.min != null && p.max != null && p.min > p.max ? 'Min is above max' : null
  const minTotal = parsed.reduce((s, p) => s + (p.locked ? 0 : (p.min ?? 0)), 0)
  const error = parsed.some(rowError)
    ? 'Fix the rows marked in red.'
    : minTotal > 100
      ? `The minimums add up to ${Math.round(minTotal * 100) / 100}%, more than 100%.`
      : null

  function set(key: string, field: 'min' | 'max', value: string) {
    if (!PCT_RE.test(value) || (value !== '' && value !== '.' && parseFloat(value) > 100)) return
    setDraft(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-5 space-y-4 max-h-[90vh] flex flex-col"
        onSubmit={e => {
          e.preventDefault()
          if (readOnly || error) return
          onApply(Object.fromEntries(parsed.map(p => [p.key, { minPct: p.min, maxPct: p.max }])))
        }}
      >
        <div>
          <h3 className="text-base font-semibold text-gray-900">Solver limits</h3>
          <p className="text-sm text-gray-500 mt-1">
            Keep each ingredient between a minimum and maximum usage % when you click Solve. Leave a box
            blank for no limit. Locked ingredients keep their amount, so limits don’t apply to them.
          </p>
        </div>
        <div className="overflow-y-auto -mx-1 px-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 text-left">
                <th className="font-medium py-1.5">Ingredient</th>
                <th className="font-medium py-1.5 w-24">Min %</th>
                <th className="font-medium py-1.5 w-24">Max %</th>
              </tr>
            </thead>
            <tbody>
              {parsed.map(p => {
                const bad = !!rowError(p)
                const box = `w-20 px-2 py-1 border rounded-md text-right focus:outline-none focus:ring-2 focus:ring-blue-500
                  disabled:bg-gray-50 disabled:text-gray-400 ${bad ? 'border-red-400' : 'border-gray-200'}`
                return (
                  <tr key={p.key} className="border-t border-gray-100">
                    <td className="py-1.5 pr-2 text-gray-800">
                      {p.name}
                      {p.locked && <span className="block text-xs text-gray-400">Locked</span>}
                      {bad && <span className="block text-xs text-red-500">{rowError(p)}</span>}
                    </td>
                    <td className="py-1.5">
                      <input
                        type="text" inputMode="decimal" placeholder="0" aria-label={`Minimum % for ${p.name}`}
                        value={draft[p.key].min} disabled={readOnly || p.locked}
                        onChange={e => set(p.key, 'min', e.target.value)} className={box}
                      />
                    </td>
                    <td className="py-1.5">
                      <input
                        type="text" inputMode="decimal" placeholder="100" aria-label={`Maximum % for ${p.name}`}
                        value={draft[p.key].max} disabled={readOnly || p.locked}
                        onChange={e => set(p.key, 'max', e.target.value)} className={box}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          {!readOnly ? (
            <button
              type="button"
              onClick={() => setDraft(Object.fromEntries(rows.map(r => [r.key, { min: '', max: '' }])))}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear all
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50">
              {readOnly ? 'Close' : 'Cancel'}
            </button>
            {!readOnly && (
              <button type="submit" disabled={!!error}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                Apply
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
