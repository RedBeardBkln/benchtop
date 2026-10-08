'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const SECTIONS = [
  { href: '/settings/profile', label: 'Profile' },
  { href: '/settings/account', label: 'Account' },
  { href: '/settings/billing', label: 'Billing' },
  { href: '/settings/privacy', label: 'Privacy & Terms' },
]

export function SettingsNav() {
  const pathname = usePathname()
  return (
    <nav className="flex sm:flex-col gap-1 overflow-x-auto sm:w-48 shrink-0" aria-label="Settings sections">
      {SECTIONS.map(({ href, label }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={`whitespace-nowrap px-3 py-2 rounded-md text-sm transition-colors ${
              active ? 'bg-gray-200 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
