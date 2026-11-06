import type { Metadata } from 'next'
import { Check } from 'lucide-react'
import { InviteCta, PageIntro, SiteLayout } from '@/components/site/site-layout'
import { SiteIcon } from '@/components/site/site-icon'
import { FEATURE_GROUPS } from '@/lib/site-content'

export const metadata: Metadata = {
  title: 'Features | Benchtop',
  description: 'Formulations, live nutrition, Nutrition Facts panels, targets, an ingredient library with AI intake, costing, clients and an AI lab-mate.',
}

export default function FeaturesPage() {
  return (
    <SiteLayout>
      <PageIntro
        eyebrow="Features"
        title="Everything between the first trial and the final label."
        lead="Benchtop replaces the recipe spreadsheet, the nutrition calculator and the folder of spec sheets with one workspace your whole team shares."
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid gap-10 lg:grid-cols-[13rem_1fr]">
        <nav aria-label="Features on this page" className="hidden lg:block">
          <ul className="sticky top-20 space-y-1 text-sm">
            {FEATURE_GROUPS.map(g => (
              <li key={g.slug}>
                <a href={`#${g.slug}`} className="block rounded-md px-3 py-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900">{g.title}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-6">
          {FEATURE_GROUPS.map(g => (
            <section key={g.slug} id={g.slug} className="scroll-mt-20 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <SiteIcon name={g.icon} />
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-gray-900">{g.title}</h2>
                  <p className="mt-1 text-gray-600">{g.lead}</p>
                </div>
              </div>
              <ul className="mt-6 grid gap-3 md:grid-cols-2">
                {g.points.map(p => (
                  <li key={p} className="flex items-start gap-3 text-gray-700">
                    <Check size={18} className="mt-0.5 shrink-0 text-lcd-600" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>

      <InviteCta />
    </SiteLayout>
  )
}
