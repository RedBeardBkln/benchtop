'use client'

import { useEffect, useState } from 'react'
import { formatWeightG, isWeightInput } from '@/lib/weight'

/**
 * Weight (g) box that keeps exactly what is typed — "0.05", "1.2500", "12." all survive
 * while editing — and accepts at most four digits after the decimal point.
 *
 * `commitOn="change"` (default) reports every keystroke; `"blur"` reports once, when you leave the
 * box or press Enter (for values that trigger a bigger recalculation, like the batch size).
 */
export function WeightInput({ value, onChange, disabled, commitOn = 'change', title, ariaLabel = 'Weight (g)', className }: {
  value: number
  onChange: (grams: number) => void
  disabled: boolean
  commitOn?: 'change' | 'blur'
  title?: string
  ariaLabel?: string
  className?: string
}) {
  const [draft, setDraft] = useState(value ? formatWeightG(value) : '')

  // Follow changes made elsewhere (solver, swaps, rebalancing) without overwriting a matching in-progress edit
  useEffect(() => {
    setDraft(d => (Number(d || 0) === value ? d : value ? formatWeightG(value) : ''))
  }, [value])

  const parse = (raw: string) => (raw === '' || raw === '.' ? 0 : parseFloat(raw))

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      disabled={disabled}
      title={title}
      placeholder="0"
      aria-label={ariaLabel}
      onChange={(e) => {
        const raw = e.target.value
        if (!isWeightInput(raw)) return
        setDraft(raw)
        if (commitOn === 'change') onChange(parse(raw))
      }}
      onBlur={() => {
        if (commitOn !== 'blur') return
        if (parse(draft) !== value) onChange(parse(draft))
        else setDraft(value ? formatWeightG(value) : '')
      }}
      onKeyDown={(e) => { if (commitOn === 'blur' && e.key === 'Enter') e.currentTarget.blur() }}
      className={className ?? `w-24 px-2 py-0.5 text-right text-sm border border-gray-200 rounded
                 focus:outline-none focus:ring-1 focus:ring-blue-500
                 disabled:opacity-60 disabled:bg-gray-50 tabular-nums`}
    />
  )
}
