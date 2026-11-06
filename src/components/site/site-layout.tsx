import Link from 'next/link'
import { Menu } from 'lucide-react'
import { Logo } from '@/components/logo'
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal'

// The public marketing site (home, features, pricing, FAQ, privacy, request an invite) and the
// legal pages. No session needed: these routes are open in middleware.

export const SITE_NAV = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
  { href: '/trust', label: 'Privacy & security' },
]

// Keycap buttons, drawn explicitly rather than through the app's hover:bg-blue-700 hook so they
// look the same on the lime hero and on paper, in light and dark.
const keycap =
  'inline-flex items-center justify-center gap-2 rounded-lg border-[1.5px] border-ink-900 font-semibold shadow-[3px_3px_0_var(--color-ink-900)] transition-[transform,box-shadow,background-color] duration-100 hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_var(--color-ink-900)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_var(--color-ink-900)]'
export const siteBtnPrimary = `${keycap} bg-ink-900 text-lcd-300 px-5 py-2.5 text-[15px]`
export const siteBtnSecondary = `${keycap} bg-[#FFFDF6] text-ink-900 px-5 py-2.5 text-[15px] hover:bg-[#F1FFB3]`

export function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-paper-100 text-gray-900">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 bg-ink-900 text-ink-300 print:hidden">
      <div className="max-w-6xl mx-auto h-14 px-4 sm:px-6 flex items-center gap-6">
        <Link href="/" aria-label="Benchtop home" className="inline-flex text-lcd-300 shrink-0">
          <Logo variant="wordmark" height={16} />
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          {SITE_NAV.map(n => (
            <Link key={n.href} href={n.href} className="px-3 py-1.5 rounded-md hover:bg-ink-800 hover:text-lcd-300 transition-colors">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <Link href="/login" className="hidden sm:inline-flex px-3 py-1.5 rounded-md hover:bg-ink-800 hover:text-lcd-300 transition-colors">
            Sign in
          </Link>
          <Link
            href="/request-invite"
            className="inline-flex items-center rounded-md bg-lcd-300 px-3 py-1.5 font-semibold text-ink-900 hover:bg-lcd-200 transition-colors"
          >
            Request an invite
          </Link>
          {/* Phones: the rest of the menu folds into a disclosure, so no client script is needed */}
          <details className="md:hidden relative">
            <summary className="list-none cursor-pointer p-1.5 rounded-md hover:bg-ink-800 [&::-webkit-details-marker]:hidden" aria-label="Menu">
              <Menu size={20} />
            </summary>
            <nav className="absolute right-0 mt-2 w-56 rounded-xl border border-ink-700 bg-ink-900 p-2 shadow-lg">
              {[...SITE_NAV, { href: '/login', label: 'Sign in' }].map(n => (
                <Link key={n.href} href={n.href} className="block px-3 py-2 rounded-md hover:bg-ink-800 hover:text-lcd-300">
                  {n.label}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  )
}

function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="bg-ink-900 text-ink-300 print:hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid gap-8 sm:grid-cols-[1.5fr_1fr_1fr_1fr] text-sm">
        <div>
          <Logo variant="wordmark" height={16} className="text-lcd-300" />
          <p className="mt-3 max-w-xs text-ink-400">Formulation, from bench to label. Currently in invitation-only beta.</p>
        </div>
        <FooterColumn title="Product" links={[
          { href: '/features', label: 'Features' },
          { href: '/pricing', label: 'Pricing' },
          { href: '/faq', label: 'FAQ' },
          { href: '/request-invite', label: 'Request an invite' },
        ]} />
        <FooterColumn title="Trust" links={[
          { href: '/trust', label: 'Privacy & security' },
          { href: '/legal/privacy', label: 'Privacy Policy' },
          { href: '/legal/terms', label: 'Terms of Service' },
        ]} />
        <FooterColumn title="Account" links={[
          { href: '/login', label: 'Sign in' },
          { href: '/forgot-password', label: 'Forgot password' },
          { href: `mailto:${LEGAL_CONTACT_EMAIL}`, label: 'Contact us' },
        ]} />
      </div>
      <div className="border-t border-ink-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 font-mono text-xs text-ink-500">
          © {year} Benchtop
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-wider text-ink-500">{title}</div>
      <ul className="mt-3 space-y-2">
        {links.map(l => (
          <li key={l.href}>
            <Link href={l.href} className="hover:text-lcd-300 transition-colors">{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Page-top band used by every inner page: a mono eyebrow, a headline and a short lead
export function PageIntro({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: React.ReactNode }) {
  return (
    <section className="border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-10 sm:pt-20 sm:pb-14">
        <div className="font-mono text-xs uppercase tracking-wider text-lcd-600">{eyebrow}</div>
        <h1 className="mt-3 max-w-3xl text-4xl sm:text-5xl font-semibold tracking-tight text-gray-900">{title}</h1>
        {lead && <p className="mt-4 max-w-2xl text-lg text-gray-600">{lead}</p>}
      </div>
    </section>
  )
}

// Lime "lit display" call to action that closes most pages
export function InviteCta({ title = 'Want in on the beta?', text }: { title?: string; text?: string }) {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
      <div className="lcd-panel rounded-2xl border-[1.5px] border-ink-900 px-6 py-10 sm:px-12 sm:py-14 text-ink-900">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-3 max-w-xl text-ink-800">
          {text ?? 'Benchtop is invitation only while we finish the beta. Tell us a little about your work and we will be in touch.'}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/request-invite" className={siteBtnPrimary}>Request an invite</Link>
          <Link href="/features" className={siteBtnSecondary}>See the features</Link>
        </div>
      </div>
    </section>
  )
}
