'use client'

import { useEffect, useState } from 'react'

// A time of day picked from three plain dropdowns (hour, minute, AM/PM). Used instead of
// <input type="time">, whose browser picker scrolls and snaps its columns under the pointer, so a
// click can land on the wrong value. The value is 24-hour "HH:mm", or '' when not set.

const selCls =
  'min-w-0 flex-1 border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 '
const sizeCls = { md: 'px-1.5 py-2 text-sm rounded-md', sm: 'px-1 py-1 text-xs rounded tabular-nums' }

type Parts = { h: string; m: string; p: '' | 'AM' | 'PM' }

function toParts(v: string): Parts {
  const match = /^(\d{1,2}):(\d{2})/.exec(v)
  if (!match) return { h: '', m: '', p: '' }
  const h24 = Number(match[1])
  return { h: String(h24 % 12 || 12), m: match[2], p: h24 < 12 ? 'AM' : 'PM' }
}

function fromParts({ h, m, p }: Parts): string {
  if (!h || !m || !p) return ''
  const h24 = (Number(h) % 12) + (p === 'PM' ? 12 : 0)
  return `${String(h24).padStart(2, '0')}:${m}`
}

const HOURS = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

export function TimeSelect({ id, value, onChange, label, disabled, size = 'md', tip }: {
  id?: string
  value: string
  onChange: (v: string) => void
  label: string
  disabled?: boolean
  size?: 'md' | 'sm'
  /** Hover / focus hint */
  tip?: string
}) {
  const cls = selCls + sizeCls[size]
  const [parts, setParts] = useState<Parts>(() => toParts(value))

  // Follow changes made from outside, such as typing a duration to move the end time
  useEffect(() => {
    if (value !== fromParts(parts)) setParts(toParts(value))
  }, [value]) // only when the value changes from outside, not on each pick

  function set(next: Partial<Parts>) {
    const merged = { ...parts, ...next }
    // Picking an hour first fills in :00 and a working-day guess at AM/PM, so one pick gives a time
    if (next.h && !merged.m) merged.m = '00'
    if (next.h && !merged.p) merged.p = Number(next.h) >= 7 && Number(next.h) <= 11 ? 'AM' : 'PM'
    setParts(merged)
    onChange(fromParts(merged))
  }

  // Keep an existing minute that isn't on the 5-minute steps (from a timer, say) choosable
  const minutes = parts.m && !MINUTES.includes(parts.m) ? [...MINUTES, parts.m].sort() : MINUTES

  return (
    <div className="flex gap-1" data-tip={disabled ? undefined : tip}>
      <select id={id} aria-label={`${label} hour`} value={parts.h} onChange={e => set({ h: e.target.value })} disabled={disabled} className={cls}>
        <option value="">--</option>
        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <select aria-label={`${label} minute`} value={parts.m} onChange={e => set({ m: e.target.value })} disabled={disabled} className={cls}>
        <option value="">--</option>
        {minutes.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <select aria-label={`${label} AM or PM`} value={parts.p} onChange={e => set({ p: e.target.value as Parts['p'] })} disabled={disabled} className={cls}>
        <option value="">--</option>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  )
}
