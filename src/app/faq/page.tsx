import type { Metadata } from 'next'
import { InviteCta, PageIntro, SiteLayout } from '@/components/site/site-layout'
import { FaqList } from '@/components/site/faq-list'
import { FAQ_GROUPS } from '@/lib/site-content'
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'FAQ | Benchtop',
  description: 'Answers about the Benchtop beta, pricing, your data and how Benchtop works.',
}

export default function FaqPage() {
  return (
    <SiteLayout>
      <PageIntro
        eyebrow="FAQ"
        title="Questions, answered."
        lead={<>Can’t find what you’re looking for? Write to us at <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-blue-600">{LEGAL_CONTACT_EMAIL}</a>.</>}
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-12">
        {FAQ_GROUPS.map(g => (
          <section key={g.title}>
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900">{g.title}</h2>
            <FaqList faqs={g.faqs} />
          </section>
        ))}
      </div>
      <InviteCta />
    </SiteLayout>
  )
}
