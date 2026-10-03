'use client'

import { useState } from 'react'

const MAX_TYPED_DECIMALS = 5   // formulation_lines.pct holds 5 decimals

/**
 * Usage-% box. Shows the value to `decimals` places; while you are typing it keeps exactly what you
 * type (up to 5 decimals, max 100) and reports each valid value as it changes.
 */
export function PctInput({ value, decimals, onChange, disabled, title }: {
  value: number
  decimals: number
  onChange: (pct: number) => void
  disabled: boolean
  title?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)   // non-null only while focused
  const shown = draft ?? value.toFixed(decimals)

  return (
    <span className="inline-flex items-center gap-0.5">
      <input
        type="text"
        inputMode="decimal"
        value={shown}
        disabled={disabled}
        title={title}
        aria-label="Usage %"
        onFocus={(e) => {
          setDraft(String(Number(value.toFixed(MAX_TYPED_DECIMALS))))
          e.target.select()
        }}
        onChange={(e) => {
          const raw = e.target.value
          if (!new RegExp(`^\\d*\\.?\\d{0,${MAX_TYPED_DECIMALS}}$`).test(raw)) return
          if (raw !== '' && raw !== '.' && parseFloat(raw) > 100) return
          setDraft(raw)
          onChange(raw === '' || raw === '.' ? 0 : parseFloat(raw))
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        className="w-20 px-2 py-0.5 text-right text-sm border border-gray-200 rounded
                   focus:outline-none focus:ring-1 focus:ring-blue-500
                   disabled:opacity-60 disabled:bg-gray-50 tabular-nums"
      />
      <span className="text-xs text-gray-400">%</span>
    </span>
  )
}
