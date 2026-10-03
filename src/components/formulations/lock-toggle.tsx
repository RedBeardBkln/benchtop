'use client'

import { Lock, Unlock } from 'lucide-react'

/** Small padlock button: filled amber when the value is locked. */
export function LockToggle({ active, disabled, onClick, lockedTitle, unlockedTitle }: {
  active: boolean
  disabled: boolean
  onClick: () => void
  lockedTitle: string
  unlockedTitle: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={active ? lockedTitle : unlockedTitle}
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
