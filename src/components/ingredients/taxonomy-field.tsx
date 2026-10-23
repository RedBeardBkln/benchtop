'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import type { TaxonomyEntry } from '@/lib/ingredient-categories'

const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400'

const ADD_NEW = '__add_new'

/** Category/subcategory/micro category combinations already saved in this account. */
export function useTaxonomy(enabled = true) {
  const { data = [] } = useQuery<TaxonomyEntry[]>({
    // Under ['ingredients'] so saving an ingredient refreshes the options too
    queryKey: ['ingredients', 'taxonomy'],
    queryFn: () => fetch('/api/ingredients/taxonomy').then(r => (r.ok ? r.json() : [])),
    enabled,
  })
  return data
}

/** Pick an existing value, or "Add new…" to type one; the typed value becomes an option once saved. */
export function TaxonomyField({ label, value, onChange, options, placeholder, noneLabel = 'None' }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder: string
  noneLabel?: string
}) {
  const [adding, setAdding] = useState(false)
  if (adding) {
    return (
      <div className="relative">
        <input
          autoFocus
          aria-label={`New ${label.toLowerCase()}`}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={120}
          className={`${inputClass} pr-8`}
        />
        <button
          type="button"
          onClick={() => { onChange(''); setAdding(false) }}
          aria-label="Back to list"
          title="Back to list"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X size={14} />
        </button>
      </div>
    )
  }
  // Keep the current value selectable even when it isn't among the options for the levels above it
  const current = options.find(o => o.toLowerCase() === value.trim().toLowerCase()) ?? value.trim()
  const list = current && !options.includes(current) ? [current, ...options] : options
  return (
    <select
      aria-label={label}
      value={current}
      onChange={e => {
        if (e.target.value === ADD_NEW) { onChange(''); setAdding(true) } else onChange(e.target.value)
      }}
      className={inputClass}
    >
      <option value="">{noneLabel}</option>
      {list.map(o => <option key={o} value={o}>{o}</option>)}
      <option value={ADD_NEW}>Add new…</option>
    </select>
  )
}
