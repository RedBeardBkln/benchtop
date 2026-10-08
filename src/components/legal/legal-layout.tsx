import Link from 'next/link'
import { LEGAL_DRAFT_NOTICE } from '@/lib/legal'

// Plain public layout for /legal/* (no AppShell, no session needed).
export function LegalLayout({
  title,
  version,
  effectiveDate,
  children,
}: {
  title: string
  version: string
  effectiveDate: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-gray-900">Benchtop</Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/legal/terms" className="text-blue-600 hover:underline">Terms</Link>
            <Link href="/legal/privacy" className="text-blue-600 hover:underline">Privacy</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {LEGAL_DRAFT_NOTICE}. This text is a working draft and has not been reviewed by a lawyer.
        </div>
        <h1 className="text-3xl font-semibold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500 mt-1 mb-8">
          Version {version} &middot; Effective {effectiveDate}
        </p>
        <div className="space-y-6 text-sm leading-6 text-gray-700 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
          {children}
        </div>
      </main>
    </div>
  )
}
