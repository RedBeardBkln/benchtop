'use client'

import { useEffect, useState } from 'react'
import { formatInUnit, fromGrams, isAmountInput, toGrams, type WeightUnit } from '@/lib/weight-units'

/**
 * Weight box that keeps exactly what is typed — "0.05", "1.2500", "12." all survive
 * while editing — and accepts at most the unit's decimal places (four for grams).
 *
 * `value` and `onChange` are always grams; `unit` (default g) is only what's shown and typed,
 * with `densityGPerMl` needed for volume units.
 *
 * `commitOn="change"` (default) reports every keystroke; `"blur"` reports once, when you leave the
 * box or press Enter (for values that trigger a bigger recalculation, like the batch size).
 */
export function WeightInput({
  value, onChange, disabled, commitOn = 'change', tip, ariaLabel = 'Weight (g)', className, unit = 'g', densityGPerMl,
}: {
  value: number
  onChange: (grams: number) => void
  disabled: boolean
  commitOn?: 'change' | 'blur'
  /** Hover / focus hint */
  tip?: string
  ariaLabel?: string
  className?: string
  unit?: WeightUnit
  densityGPerMl?: number | null
}) {
  const show = (grams: number) => {
    if (!grams) return ''
    const amount = fromGrams(grams, unit, densityGPerMl)
    return amount == null ? '' : formatInUnit(amount, unit)
  }
  const parse = (raw: string) => (raw === '' || raw === '.' ? 0 : toGrams(parseFloat(raw), unit, densityGPerMl) ?? 0)

  const [draft, setDraft] = useState(() => show(value))

  // Follow changes made elsewhere (solver, swaps, rebalancing, a new unit) without overwriting a
  // matching in-progress edit
  useEffect(() => {
    setDraft(d => (parse(d) === value && d !== '' ? d : show(value)))
  }, [value, unit, densityGPerMl])

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      disabled={disabled}
      data-tip={tip}
      placeholder="0"
      aria-label={ariaLabel}
      onChange={(e) => {
        const raw = e.target.value
        if (!isAmountInput(raw, unit)) return
        setDraft(raw)
        if (commitOn === 'change') onChange(parse(raw))
      }}
      onBlur={() => {
        if (commitOn !== 'blur') return
        if (parse(draft) !== value) onChange(parse(draft))
        else setDraft(show(value))
      }}
      onKeyDown={(e) => { if (commitOn === 'blur' && e.key === 'Enter') e.currentTarget.blur() }}
      className={className ?? `w-24 px-2 py-0.5 text-right text-sm border border-gray-200 rounded
                 focus:outline-none focus:ring-1 focus:ring-blue-500
                 disabled:opacity-60 disabled:bg-gray-50 tabular-nums`}
    />
  )
}
