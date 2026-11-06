import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, Cookie, CreditCard, Download, KeyRound, Lock, ShieldCheck, Sparkles } from 'lucide-react'
import { InviteCta, PageIntro, SiteLayout } from '@/components/site/site-layout'
import { LEGAL_CONTACT_EMAIL, PRIVACY_EFFECTIVE_DATE } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Privacy & security | Benchtop',
  description: 'How Benchtop protects your formulations and your clients’ data: private workspaces, no selling or sharing, and full export and deletion.',
}

const PRINCIPLES = [
  {
    icon: ShieldCheck,
    title: 'We never sell or share your data',
    text: 'Not your data, and not your clients’ data. We don’t share it with anyone unless the law requires us to, and if it ever does, we disclose only what is required and tell you first where the law allows.',
  },
  {
    icon: Building2,
    title: 'Every company gets a private workspace',
    text: 'Formulations, ingredients, inventory, suppliers, clients and documents belong to one account. Nobody outside that account can see them, and data is never shared between accounts.',
  },
  {
    icon: KeyRound,
    title: 'You decide who sees what',
    text: 'Owners and admins choose what each member can see and edit: everything, one client’s projects, or just a few projects. The ingredient library and suppliers can be view-only.',
  },
  {
    icon: Lock,
    title: 'Secure by default',
    text: 'Encrypted connections, access controls on every request, and per-account data separation. Uploaded documents are kept in private storage, never in public links.',
  },
  {
    icon: CreditCard,
    title: 'Card details never reach us',
    text: 'Payments are handled by Stripe. We store only a customer reference and your subscription status.',
  },
  {
    icon: Sparkles,
    title: 'AI that works for you only',
    text: 'When you use an AI feature, the content you submit is sent to our AI provider to produce the result for you. It isn’t sold or shared.',
  },
  {
    icon: Download,
    title: 'Your data, whenever you want it',
    text: 'The account owner can download a full copy of the account’s data at any time, or permanently delete the account with its documents and logins.',
  },
  {
    icon: Cookie,
    title: 'No tracking',
    text: 'We use only the cookies needed to keep you signed in. No advertising cookies, and no third-party analytics on this site or in the app.',
  },
]

const PROVIDERS = [
  { name: 'Supabase', role: 'Database hosting, sign-in and private document storage' },
  { name: 'Stripe', role: 'Payments and subscriptions' },
  { name: 'Anthropic', role: 'AI features, such as reading label photos and spec sheets, and Sous Chef' },
  { name: 'USDA FoodData Central', role: 'Nutrient lookups (your search terms)' },
  { name: 'Brave Search', role: 'Web lookups (your search terms)' },
  { name: 'Vercel', role: 'Hosting for the app and this site' },
  { name: 'Resend', role: 'Account emails, such as password resets' },
]

export default function TrustPage() {
  return (
    <SiteLayout>
      <PageIntro
        eyebrow="Privacy & security"
        title="Your formulas are your business. We keep it that way."
        lead="Recipes, supplier pricing and client details are some of the most sensitive things a food company has. Here is how Benchtop looks after them, in plain words."
      />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid gap-5 sm:grid-cols-2">
          {PRINCIPLES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-gray-200 bg-white p-6">
              <Icon size={22} strokeWidth={1.75} className="text-lcd-600" />
              <h2 className="mt-3 text-lg font-semibold text-gray-900">{title}</h2>
              <p className="mt-1.5 text-gray-600 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-12 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Who processes data for us</h2>
          <p className="mt-2 text-gray-600">
            These providers handle data only on our instructions, only to deliver the service, and may not sell it or
            use it for their own purposes.
          </p>
          <ul className="mt-4 divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
            {PROVIDERS.map(p => (
              <li key={p.name} className="px-5 py-3">
                <div className="font-medium text-gray-900">{p.name}</div>
                <div className="text-sm text-gray-600">{p.role}</div>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">If you request an invite</h2>
          <p className="mt-2 text-gray-600 leading-relaxed">
            The request form asks for your name and email, and optionally your company, role, team size and what you’d
            like to use Benchtop for. We use it only to review your request and contact you about the beta. We keep a
            one-way fingerprint of your IP address to stop spam, never the address itself. To have a request deleted,
            email us.
          </p>

          <h2 className="mt-8 text-2xl font-semibold tracking-tight text-gray-900">The full documents</h2>
          <p className="mt-2 text-gray-600">
            This page is a summary. The <Link href="/legal/privacy" className="text-blue-600">Privacy Policy</Link> and{' '}
            <Link href="/legal/terms" className="text-blue-600">Terms of Service</Link> are the binding versions (privacy
            policy effective {PRIVACY_EFFECTIVE_DATE}).
          </p>

          <h2 className="mt-8 text-2xl font-semibold tracking-tight text-gray-900">Questions or requests</h2>
          <p className="mt-2 text-gray-600">
            To ask about your data, exercise your privacy rights or report a security concern, email{' '}
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-blue-600">{LEGAL_CONTACT_EMAIL}</a>.
          </p>
        </div>
      </section>

      <InviteCta />
    </SiteLayout>
  )
}
