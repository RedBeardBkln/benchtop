import type { Metadata } from 'next'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { InviteCta, PageIntro, SiteLayout, siteBtnPrimary, siteBtnSecondary } from '@/components/site/site-layout'
import { FaqList } from '@/components/site/faq-list'
import { FAQ_GROUPS, PLAN_INCLUDES, PRICING } from '@/lib/site-content'

export const metadata: Metadata = {
  title: 'Pricing | Benchtop',
  description: `One plan with every feature: $${PRICING.monthly}/month or $${PRICING.yearly}/year, with a ${PRICING.trialDays}-day free trial.`,
}

export default function PricingPage() {
  const billingFaqs = FAQ_GROUPS.find(g => g.title === 'Pricing and billing')?.faqs ?? []
  return (
    <SiteLayout>
      <PageIntro
        eyebrow="Pricing"
        title="One plan. Every feature. No surprises."
        lead={`Start with ${PRICING.trialDays} days free, with no card needed. After that, pay monthly or save with a yearly plan.`}
      />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid gap-6 md:grid-cols-2">
          <PlanCard
            name="Monthly"
            price={`$${PRICING.monthly}`}
            per="per month"
            seat={`Extra teammates $${PRICING.seatMonthly}/month each`}
          />
          <PlanCard
            name="Yearly"
            price={`$${PRICING.yearly}`}
            per="per year"
            seat={`Extra teammates $${PRICING.seatYearly}/year each`}
            badge={`Save $${PRICING.yearlySavings} a year`}
            highlight
          />
        </div>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Every account includes</h2>
            <ul className="mt-4 space-y-2.5">
              {PLAN_INCLUDES.map(i => (
                <li key={i} className="flex items-start gap-3 text-gray-700">
                  <Check size={18} className="mt-0.5 shrink-0 text-lcd-600" />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">How the beta works</h2>
            <ol className="mt-4 space-y-3 text-gray-700">
              <li><span className="font-mono text-tang-700 mr-2">01</span>Request an invite and tell us about your work.</li>
              <li><span className="font-mono text-tang-700 mr-2">02</span>We email you a personal invitation link.</li>
              <li><span className="font-mono text-tang-700 mr-2">03</span>Create your login. Your {PRICING.trialDays}-day free trial starts that day.</li>
              <li><span className="font-mono text-tang-700 mr-2">04</span>Subscribe any time before it ends. You aren’t charged until the trial is over.</li>
            </ol>
          </div>
        </div>

        <p className="mt-6 text-sm text-gray-500">
          Prices are in US dollars. The account owner is included in the plan price; every other person on the team is
          one extra seat, billed on the same subscription.
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-4">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Billing questions</h2>
        <FaqList faqs={billingFaqs} />
        <Link href="/faq" className="mt-4 inline-block text-blue-600 font-medium">All questions</Link>
      </section>

      <InviteCta
        title="Start with a free trial"
        text={`Request an invite. When you join, you get ${PRICING.trialDays} days with every feature before you decide.`}
      />
    </SiteLayout>
  )
}

function PlanCard({
  name, price, per, seat, badge, highlight = false,
}: {
  name: string
  price: string
  per: string
  seat: string
  badge?: string
  highlight?: boolean
}) {
  return (
    <div className={`rounded-2xl border-[1.5px] p-6 sm:p-8 ${highlight ? 'lcd-panel border-ink-900 text-ink-900' : 'border-gray-300 bg-white text-gray-900'}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-mono text-sm uppercase tracking-wider">{name}</h2>
        {badge && <span className="rounded-full bg-ink-900 px-3 py-1 font-mono text-xs text-lcd-300">{badge}</span>}
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-5xl font-semibold tracking-tight">{price}</span>
        <span className={highlight ? 'text-ink-700' : 'text-gray-500'}>{per}</span>
      </div>
      <p className={`mt-2 text-sm ${highlight ? 'text-ink-800' : 'text-gray-600'}`}>Includes the account owner. {seat}.</p>
      <Link href="/request-invite" className={`mt-6 w-full ${highlight ? siteBtnPrimary : siteBtnSecondary}`}>Request an invite</Link>
    </div>
  )
}
