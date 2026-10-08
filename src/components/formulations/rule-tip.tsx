'use client'

import { useId, useState } from 'react'
import type { AppliedRule } from '@/lib/nfp-model'

// Hover / focus tooltip explaining which FDA rounding rule produced a value on the label.
// The popover is position:fixed (clamped to the viewport) so the label's own box never clips it,
// and it is never rendered in print.

const POP_W = 320

export function RuleTip({ rules, children }: { rules: Array<AppliedRule | undefined>; children: React.ReactNode }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const id = useId()
  const shown = rules.filter((r): r is AppliedRule => !!r)
  if (shown.length === 0) return <>{children}</>

  function open(el: HTMLElement) {
    const r = el.getBoundingClientRect()
    const left = Math.max(8, Math.min(r.left, window.innerWidth - POP_W - 8))
    // Flip above the value when there is no room below
    const below = r.bottom + 6
    const top = below + 220 > window.innerHeight ? Math.max(8, r.top - 6 - 220) : below
    setPos({ top, left })
  }

  return (
    <span
      tabIndex={0}
      aria-describedby={pos ? id : undefined}
      onMouseEnter={e => open(e.currentTarget)}
      onMouseLeave={() => setPos(null)}
      onFocus={e => open(e.currentTarget)}
      onBlur={() => setPos(null)}
      onKeyDown={e => { if (e.key === 'Escape') setPos(null) }}
      className="cursor-help underline decoration-dotted decoration-gray-400 underline-offset-2 print:no-underline outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
    >
      {children}
      {pos && (
        <span
          id={id}
          role="tooltip"
          className="print:hidden"
          style={{
            position: 'fixed', top: pos.top, left: pos.left, width: POP_W, zIndex: 100,
            background: '#111827', color: '#f9fafb', borderRadius: 8, padding: '10px 12px',
            fontSize: 11, lineHeight: 1.45, fontWeight: 400, fontStyle: 'normal', textAlign: 'left',
            boxShadow: '0 10px 25px rgba(0,0,0,.35)', pointerEvents: 'none', textDecoration: 'none',
            display: 'block', whiteSpace: 'normal',
          }}
        >
          {shown.map((r, i) => (
            <span key={r.ruleId + i} style={{ display: 'block', marginTop: i ? 10 : 0 }}>
              <span style={{ display: 'block', fontWeight: 700, fontSize: 12 }}>{r.title}</span>
              <span style={{ display: 'block', color: '#9ca3af' }}>{r.citation}</span>
              <span style={{ display: 'block', marginTop: 4 }}>
                Actual <b>{r.actual}</b> → declared <b>{r.declared}</b>
              </span>
              <span style={{ display: 'block', marginTop: 4, color: '#d1d5db' }}>{r.applied}</span>
              <span style={{ display: 'block', marginTop: 4 }}>
                <span style={{ color: '#9ca3af' }}>Rule:</span>
                {r.lines.map(l => (
                  <span key={l} style={{ display: 'block', paddingLeft: 8 }}>• {l}</span>
                ))}
              </span>
              {r.note && <span style={{ display: 'block', marginTop: 4, color: '#9ca3af' }}>{r.note}</span>}
            </span>
          ))}
        </span>
      )}
    </span>
  )
}
