import Link from 'next/link'
import { Check } from 'lucide-react'
import { InviteCta, SiteLayout, siteBtnPrimary, siteBtnSecondary } from '@/components/site/site-layout'
import { SiteIcon } from '@/components/site/site-icon'
import { HOME_HIGHLIGHTS, HOW_IT_WORKS, PRICING } from '@/lib/site-content'

// The public home page, shown at / to visitors who aren't signed in
export function SiteHome() {
  return (
    <SiteLayout>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16 sm:pt-20 sm:pb-24 grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1 font-mono text-xs uppercase tracking-wider text-gray-600">
            <span className="h-2 w-2 rounded-full bg-tang-500" aria-hidden="true" />
            Invitation-only beta
          </span>
          <h1 className="mt-5 text-5xl sm:text-6xl font-semibold tracking-tight text-gray-900 leading-[1.02]">
            Formulas that finally add up.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-gray-600">
            Benchtop is the R&amp;D workspace for food, beverage and supplement developers. Build recipes, see the
            nutrition as you go, and walk away with a label-ready Nutrition Facts panel, the ingredient statement
            and the cost per serving.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/request-invite" className={siteBtnPrimary}>Request an invite</Link>
            <Link href="/features" className={siteBtnSecondary}>Take the tour</Link>
          </div>
          <p className="mt-5 text-sm text-gray-500">
            {PRICING.trialDays}-day free trial · no card to start · ${PRICING.monthly}/month after
          </p>
        </div>
        <ProductPreview />
      </section>

      <section className="border-y border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="font-mono text-xs uppercase tracking-wider text-lcd-600">What it does</div>
          <h2 className="mt-3 max-w-2xl text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900">
            One place for the recipe, the data and the label.
          </h2>
          <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {HOME_HIGHLIGHTS.map(h => (
              <div key={h.title} className="flex gap-4">
                <SiteIcon name={h.icon} />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{h.title}</h3>
                  <p className="mt-1 text-gray-600">{h.text}</p>
                </div>
              </div>
            ))}
          </div>
          <Link href="/features" className="mt-10 inline-block text-blue-600 font-medium">See every feature</Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="font-mono text-xs uppercase tracking-wider text-lcd-600">How it works</div>
        <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900">From the bench to the label in four steps.</h2>
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map(s => (
            <li key={s.step} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="font-mono text-sm text-tang-700">{s.step}</div>
              <h3 className="mt-2 text-lg font-semibold text-gray-900">{s.title}</h3>
              <p className="mt-1 text-gray-600">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-ink-900 text-ink-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="font-mono text-xs uppercase tracking-wider text-lcd-300">Your data stays yours</div>
            <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-[#FFFDF6]">
              We never sell or share your data, or your clients’ data.
            </h2>
            <p className="mt-4 text-ink-300">
              Every account is a private workspace. Your formulations, suppliers and client details are visible only to
              your team, and you can download or delete all of it whenever you like.
            </p>
            <Link href="/trust" className="mt-6 inline-block font-medium text-lcd-300 underline decoration-2 underline-offset-4 hover:decoration-tang-500">
              How we handle your data
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              'Separate workspace per company',
              'Role and project-level permissions',
              'Card details handled by Stripe',
              'Full data export at any time',
            ].map(t => (
              <li key={t} className="flex items-start gap-3 rounded-xl border border-ink-700 p-4">
                <Check size={18} className="mt-0.5 shrink-0 text-lcd-300" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-10 grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="font-mono text-xs uppercase tracking-wider text-lcd-600">Pricing</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">One plan. Every feature.</h2>
            <p className="mt-2 text-gray-600">
              ${PRICING.monthly} a month or ${PRICING.yearly} a year, including the account owner. Extra teammates are $
              {PRICING.seatMonthly} a month. Start with {PRICING.trialDays} days free.
            </p>
          </div>
          <Link href="/pricing" className={siteBtnSecondary}>See pricing</Link>
        </div>
      </section>

      <InviteCta />
    </SiteLayout>
  )
}

// An illustrative slice of the formulation page: a few lines, a running total and a mini
// nutrition readout on the lime display. Static markup, not a screenshot, so it stays crisp.
function ProductPreview() {
  const lines = [
    { name: 'Rolled Oats', pct: '38.0', g: '190.0' },
    { name: 'Whey Protein Isolate', pct: '22.0', g: '110.0' },
    { name: 'Almond Butter', pct: '18.0', g: '90.0' },
    { name: 'Allulose Syrup', pct: '14.0', g: '70.0' },
    { name: 'Dark Chocolate Chips', pct: '8.0', g: '40.0' },
  ]
  return (
    <div className="relative" aria-hidden="true">
      <div className="rounded-2xl border-[1.5px] border-ink-900 bg-[#FFFDF6] text-ink-900 shadow-[6px_6px_0_var(--color-ink-900)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-200 px-5 py-3">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-ink-500">High-protein bar · v3</div>
            <div className="font-semibold">Chocolate almond</div>
          </div>
          <span className="rounded-full bg-lcd-200 px-2.5 py-0.5 font-mono text-[11px] text-ink-800">Targets met</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="font-mono text-[11px] uppercase tracking-wider text-ink-500">
              <th className="px-5 py-2 text-left font-normal">Ingredient</th>
              <th className="px-2 py-2 text-right font-normal">%</th>
              <th className="px-5 py-2 text-right font-normal">g</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {lines.map(l => (
              <tr key={l.name} className="border-t border-ink-100">
                <td className="px-5 py-1.5 font-sans">{l.name}</td>
                <td className="px-2 py-1.5 text-right">{l.pct}</td>
                <td className="px-5 py-1.5 text-right">{l.g}</td>
              </tr>
            ))}
            <tr className="border-t-[1.5px] border-ink-900 font-semibold">
              <td className="px-5 py-2 font-sans">Batch</td>
              <td className="px-2 py-2 text-right">100.0</td>
              <td className="px-5 py-2 text-right">500.0</td>
            </tr>
          </tbody>
        </table>
        <div className="lcd-panel shadow-[inset_0_2px_10px_rgb(22_32_14/0.18)]! m-4 mt-1 rounded-xl px-4 py-3 grid grid-cols-3 gap-2 font-mono">
          {[
            ['Protein', '12.4 g'],
            ['Added sugar', '0.0 g'],
            ['Cost / bar', '$0.62'],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="text-[10px] uppercase tracking-wider text-ink-700">{k}</div>
              <div className="text-lg font-medium">{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-5 -left-3 sm:-left-6 rounded-xl border-[1.5px] border-ink-900 bg-tang-300 px-4 py-2.5 text-sm text-ink-900 shadow-[3px_3px_0_var(--color-ink-900)] max-w-[15rem]">
        <span className="font-semibold">Sous Chef:</span> try 2% tapioca fiber for a chewier bite.
      </div>
    </div>
  )
}
