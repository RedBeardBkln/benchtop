import type { Metadata } from 'next'
import { Check } from 'lucide-react'
import { PageIntro, SiteLayout } from '@/components/site/site-layout'
import { InviteRequestForm } from '@/components/site/invite-request-form'
import { PRICING } from '@/lib/site-content'

export const metadata: Metadata = {
  title: 'Request an invite | Benchtop',
  description: 'Benchtop is in invitation-only beta. Tell us about your work and request an invitation.',
}

export default function RequestInvitePage() {
  return (
    <SiteLayout>
      <PageIntro
        eyebrow="Join the beta"
        title="Request an invite."
        lead="Benchtop is invitation only while we finish the beta. We read every request and add new accounts in small groups, so we can help each one get set up."
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid gap-10 lg:grid-cols-[1fr_20rem] lg:items-start">
        <InviteRequestForm />
        <aside className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">What happens next</h2>
          <ol className="mt-4 space-y-4 text-sm text-gray-700">
            <li>
              <div className="font-mono text-tang-700">01</div>
              We review your request, usually within a few business days.
            </li>
            <li>
              <div className="font-mono text-tang-700">02</div>
              If we can take you on, we email you a personal invitation link.
            </li>
            <li>
              <div className="font-mono text-tang-700">03</div>
              You create your login and your company’s private workspace.
            </li>
          </ol>
          <ul className="mt-6 space-y-2 border-t border-gray-200 pt-5 text-sm text-gray-700">
            {[
              `${PRICING.trialDays}-day free trial with every feature`,
              'No card needed to start',
              'Invite your team whenever you are ready',
            ].map(t => (
              <li key={t} className="flex items-start gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-lcd-600" />
                {t}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </SiteLayout>
  )
}
