import { ChevronDown } from 'lucide-react'
import type { SiteFaq } from '@/lib/site-content'

// Questions as native disclosures: keyboard and screen-reader friendly, and no client script
export function FaqList({ faqs }: { faqs: SiteFaq[] }) {
  return (
    <div className="mt-4 divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
      {faqs.map(f => (
        <details key={f.q} className="group px-5 sm:px-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium text-gray-900 [&::-webkit-details-marker]:hidden">
            {f.q}
            <ChevronDown size={18} className="shrink-0 text-gray-500 transition-transform group-open:rotate-180" />
          </summary>
          <p className="pb-5 -mt-1 text-gray-600 leading-relaxed">{f.a}</p>
        </details>
      ))}
    </div>
  )
}
