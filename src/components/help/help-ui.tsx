'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HelpCircle, Search, X } from 'lucide-react'
import { HELP_SECTIONS } from '@/lib/help'
import { searchHelp } from '@/lib/help/search'
import { HELP_ICONS } from './help-icons'

// Sidebar list of help sections (a scrolling row of chips on phones)
export function HelpNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Help sections" className="flex lg:flex-col gap-1 overflow-x-auto lg:w-56 shrink-0 -mx-4 px-4 lg:mx-0 lg:px-0 pb-1 lg:pb-0">
      <Link
        href="/help"
        className={`whitespace-nowrap flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
          pathname === '/help' ? 'bg-gray-200 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        <HelpCircle size={15} className="shrink-0" /> Help home
      </Link>
      {HELP_SECTIONS.map(s => {
        const Icon = HELP_ICONS[s.icon]
        const active = pathname === `/help/${s.slug}`
        return (
          <Link
            key={s.slug}
            href={`/help/${s.slug}`}
            className={`whitespace-nowrap flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
              active ? 'bg-gray-200 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Icon size={15} className="shrink-0" /> {s.title}
          </Link>
        )
      })}
    </nav>
  )
}

// Search across every article and FAQ; results link straight to the answer
export function HelpSearch({ autoFocus = false }: { autoFocus?: boolean }) {
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const hits = useMemo(() => searchHelp(HELP_SECTIONS, q), [q])
  const pathname = usePathname()

  // Clear after following a result
  useEffect(() => { setQ('') }, [pathname])

  return (
    <div className="relative">
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          autoFocus={autoFocus}
          placeholder="Search help, e.g. “print a label” or “invite a teammate”"
          aria-label="Search help"
          className="w-full pl-10 pr-10 py-2.5 text-[15px] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {q && (
          <button
            type="button"
            onClick={() => { setQ(''); inputRef.current?.focus() }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        )}
      </div>
      {q.trim().length > 1 && (
        <div className="absolute z-30 mt-1 w-full max-h-[60vh] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {hits.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500">
              No matches. Try fewer or simpler words, or use “Report a bug or request a feature” at the bottom of the page to ask us.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {hits.map(h => (
                <li key={`${h.section}#${h.anchor}`}>
                  <Link
                    href={`/help/${h.section}#${h.anchor}`}
                    onClick={() => setTimeout(() => openFaq(h.anchor), 150)}
                    className="block px-4 py-2.5 hover:bg-gray-50"
                  >
                    <div className="text-xs text-gray-500">
                      {h.sectionTitle} · {h.kind === 'faq' ? 'FAQ' : 'Guide'}
                    </div>
                    <div className="text-sm font-medium text-gray-900">{h.title}</div>
                    <div className="text-xs text-gray-500 line-clamp-2">{h.snippet}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// A link to /help/<section>#faq-3 should land on that question already expanded
// (also called after a search result is followed on the same page, where no hashchange fires)
function openFaq(id: string) {
  const el = document.getElementById(id)
  if (el instanceof HTMLDetailsElement) {
    el.open = true
    el.scrollIntoView({ block: 'start' })
  }
}

export function OpenFaqFromHash() {
  useEffect(() => {
    const open = () => { if (window.location.hash) openFaq(window.location.hash.slice(1)) }
    open()
    window.addEventListener('hashchange', open)
    return () => window.removeEventListener('hashchange', open)
  }, [])
  return null
}
