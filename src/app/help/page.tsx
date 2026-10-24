import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { HELP_ICONS } from '@/components/help/help-icons'
import { HelpText } from '@/components/help/help-blocks'
import { HELP_SECTIONS, POPULAR_QUESTIONS } from '@/lib/help'
import { faqAnchor } from '@/lib/help/search'
import { requirePage } from '@/lib/auth/context'

export const metadata = { title: 'Help & FAQ — benchtop' }

export default async function HelpHome() {
  await requirePage({ allowUnentitled: true })
  const popular = POPULAR_QUESTIONS.map(({ section, q }) => {
    const sec = HELP_SECTIONS.find(s => s.slug === section)
    const i = sec?.faqs.findIndex(f => f.q === q) ?? -1
    return sec && i >= 0 ? { href: `/help/${sec.slug}#${faqAnchor(i)}`, q } : null
  }).filter((x): x is { href: string; q: string } => x != null)

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {HELP_SECTIONS.map(s => {
          const Icon = HELP_ICONS[s.icon]
          return (
            <Link
              key={s.slug}
              href={`/help/${s.slug}`}
              className="group rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-400 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Icon size={18} className="text-ink-600" />
                <h2 className="font-semibold text-gray-900">{s.title}</h2>
                <ChevronRight size={16} className="ml-auto text-gray-300 group-hover:text-gray-500" />
              </div>
              <p className="mt-1.5 text-sm text-gray-600"><HelpText text={s.intro} /></p>
              <p className="mt-2 text-xs text-gray-400">
                {s.articles.length} guide{s.articles.length === 1 ? '' : 's'} · {s.faqs.length} question{s.faqs.length === 1 ? '' : 's'}
              </p>
            </Link>
          )
        })}
      </div>

      {popular.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Popular questions</h2>
          <ul className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
            {popular.map(p => (
              <li key={p.href}>
                <Link href={p.href} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50">
                  <span className="flex-1">{p.q}</span>
                  <ChevronRight size={15} className="text-gray-300" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm text-gray-500">
        Can’t find what you need? Use <strong className="text-gray-700">Report a bug or request a feature</strong> at the
        bottom of any page and the benchtop team will help.
      </p>
    </div>
  )
}
