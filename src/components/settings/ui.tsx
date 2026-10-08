import type { ReactNode } from 'react'

// Small shared bits for the settings / invitation / legal screens, matching the login form styling.

export const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500'

export const btnPrimary =
  'inline-flex items-center justify-center py-2 px-4 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'

export const btnSecondary =
  'inline-flex items-center justify-center py-2 px-4 bg-white text-gray-700 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'

export const btnDanger =
  'inline-flex items-center justify-center py-2 px-4 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

export function Card({
  title,
  description,
  children,
  tone = 'default',
}: {
  title?: string
  description?: string
  children: ReactNode
  tone?: 'default' | 'danger'
}) {
  return (
    <section
      className={`bg-white rounded-lg border p-5 sm:p-6 ${tone === 'danger' ? 'border-red-200' : 'border-gray-200'}`}
    >
      {title && <h2 className="text-base font-semibold text-gray-900">{title}</h2>}
      {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      <div className={title || description ? 'mt-4' : ''}>{children}</div>
    </section>
  )
}

export function Notice({
  tone,
  children,
}: {
  tone: 'info' | 'success' | 'warning' | 'error'
  children: ReactNode
}) {
  const cls = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    error: 'bg-red-50 border-red-200 text-red-800',
  }[tone]
  return <div className={`rounded-md border px-4 py-3 text-sm ${cls}`}>{children}</div>
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}
