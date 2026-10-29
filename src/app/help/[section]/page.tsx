import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronDown, Link2 } from 'lucide-react'
import { HelpBlocks, HelpText } from '@/components/help/help-blocks'
import { HELP_ICONS } from '@/components/help/help-icons'
import { OpenFaqFromHash } from '@/components/help/help-ui'
import { HELP_SECTIONS } from '@/lib/help'
import { faqAnchor } from '@/lib/help/search'
import { requirePage } from '@/lib/auth/context'

type Props = { params: Promise<{ section: string }> }

export async function generateMetadata({ params }: Props) {
  const { section } = await params
  const sec = HELP_SECTIONS.find(s => s.slug === section)
  return { title: sec ? `${sec.title} — Benchtop help` : 'Help — Benchtop' }
}

export default async function HelpSectionPage({ params }: Props) {
  await requirePage({ allowUnentitled: true })
  const { section } = await params
  const sec = HELP_SECTIONS.find(s => s.slug === section)
  if (!sec) notFound()
  const Icon = HELP_ICONS[sec.icon]
  const idx = HELP_SECTIONS.indexOf(sec)
  const next = HELP_SECTIONS[idx + 1]

  return (
    <div className="space-y-8">
      <OpenFaqFromHash />
      <header>
        <div className="flex items-center gap-2">
          <Icon size={22} className="text-gray-500" />
          <h2 className="text-xl font-semibold text-gray-900">{sec.title}</h2>
        </div>
        <p className="mt-2 text-[15px] text-gray-700 leading-relaxed"><HelpText text={sec.intro} /></p>
      </header>

      {/* On this page */}
      <nav aria-label="On this page" className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">On this page</h3>
        <ol className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          {sec.articles.map(a => (
            <li key={a.slug}>
              <a href={`#${a.slug}`} className="text-blue-700 hover:underline">{a.title}</a>
            </li>
          ))}
          {sec.faqs.length > 0 && (
            <li><a href="#faq" className="text-blue-700 hover:underline">Frequently asked questions</a></li>
          )}
        </ol>
      </nav>

      {sec.articles.map(a => (
        <article key={a.slug} id={a.slug} className="scroll-mt-6 rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
          <h3 className="group flex items-center gap-2 text-lg font-semibold text-gray-900">
            {a.title}
            <a href={`#${a.slug}`} aria-label="Link to this guide" className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600">
              <Link2 size={15} />
            </a>
          </h3>
          <p className="mt-1 mb-4 text-sm text-gray-500"><HelpText text={a.summary} /></p>
          <HelpBlocks blocks={a.blocks} />
        </article>
      ))}

      {sec.faqs.length > 0 && (
        <section id="faq" className="scroll-mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Frequently asked questions</h3>
          <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
            {sec.faqs.map((f, i) => (
              <details key={i} id={faqAnchor(i)} className="group scroll-mt-6 px-4 py-3 [&:target]:bg-lcd-50">
                <summary className="flex cursor-pointer list-none items-start gap-2 text-[15px] font-medium text-gray-900 [&::-webkit-details-marker]:hidden">
                  <span className="flex-1">{f.q}</span>
                  <ChevronDown size={18} className="mt-0.5 shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-2 text-[15px] leading-relaxed text-gray-700"><HelpText text={f.a} /></div>
              </details>
            ))}
          </div>
        </section>
      )}

      {next && (
        <div className="flex justify-end">
          <Link href={`/help/${next.slug}`} className="text-sm text-blue-700 hover:underline">
            Next: {next.title} →
          </Link>
        </div>
      )}
    </div>
  )
}
