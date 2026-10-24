'use client'

import { Lock, Unlock } from 'lucide-react'

/**
 * Small padlock button: filled amber when the value is locked. `lockedTitle` / `unlockedTitle` are
 * its hover hint and accessible name in each state; `disabledTip` replaces them while disabled.
 */
export function LockToggle({ active, disabled, onClick, lockedTitle, unlockedTitle, disabledTip }: {
  active: boolean
  disabled: boolean
  onClick: () => void
  lockedTitle: string
  unlockedTitle: string
  disabledTip?: string
}) {
  const label = active ? lockedTitle : unlockedTitle
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      data-tip={disabled && disabledTip ? disabledTip : label}
      className={`p-1 rounded transition-colors disabled:opacity-40 ${
        active
          ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
      }`}
    >
      {active ? <Lock size={13} /> : <Unlock size={13} />}
    </button>
  )
}
