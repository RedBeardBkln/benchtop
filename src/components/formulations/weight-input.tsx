'use client'

import { useEffect, useState } from 'react'
import { formatWeightG, isWeightInput } from '@/lib/weight'

/**
 * Weight (g) box that keeps exactly what is typed — "0.05", "1.2500", "12." all survive
 * while editing — and accepts at most four digits after the decimal point.
 */
export function WeightInput({ value, onChange, disabled }: {
  value: number
  onChange: (grams: number) => void
  disabled: boolean
}) {
  const [draft, setDraft] = useState(value ? formatWeightG(value) : '')

  // Follow changes made elsewhere (solver, swaps) without overwriting a matching in-progress edit
  useEffect(() => {
    setDraft(d => (Number(d || 0) === value ? d : value ? formatWeightG(value) : ''))
  }, [value])

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      disabled={disabled}
      placeholder="0"
      aria-label="Weight (g)"
      onChange={(e) => {
        const raw = e.target.value
        if (!isWeightInput(raw)) return
        setDraft(raw)
        onChange(raw === '' || raw === '.' ? 0 : parseFloat(raw))
      }}
      className="w-24 px-2 py-0.5 text-right text-sm border border-gray-200 rounded
                 focus:outline-none focus:ring-1 focus:ring-blue-500
                 disabled:opacity-50 tabular-nums"
    />
  )
}
