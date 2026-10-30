'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Building2, ChefHat, Clock, FolderOpen, FlaskConical, HelpCircle, LogOut, MailPlus, Menu, MessageSquare, Settings, Truck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/logo'
import { FeedbackLink } from '@/components/feedback-link'
import { UnreadFeedbackBanner, useUnreadFeedback } from '@/components/admin/unread-feedback'
import { usePreferences } from '@/lib/use-preferences'
import { AskSousChefButton, SousChefDock } from '@/components/sous-chef/sous-chef-dock'
import { useSousChef } from '@/components/sous-chef/sous-chef-session'

// `tip` is the short description shown when you hover or focus the link
const NAV = [
  { href: '/projects', label: 'Projects', icon: FolderOpen, tip: 'Your product ideas, each with its formulations and nutrition targets' },
  { href: '/ingredients', label: 'Ingredients', icon: FlaskConical, tip: 'Your ingredient library: nutrition, allergens, suppliers, costs and stock' },
  { href: '/suppliers', label: 'Suppliers', icon: Truck, tip: 'The companies you buy ingredients from, with contacts and terms' },
  { href: '/sous-chef', label: 'Sous Chef', icon: ChefHat, tip: 'Your AI product-development sidekick: food science answers, ingredient swaps and the team’s lab notebook' },
  { href: '/settings', label: 'Settings', icon: Settings, tip: 'Your profile, password, preferences, team and billing' },
  { href: '/help', label: 'Help', icon: HelpCircle, tip: 'Step-by-step guides and answers for every part of Benchtop' },
]

// The phone's bottom bar shows the first four of these the user has; the rest of the menu sits under More.
// Settings only makes the bar for people who can't see Clients.
const MOBILE_PRIMARY = ['/projects', '/clients', '/ingredients', '/suppliers', '/settings']

// Only shown to account owners and admins (client records hold accounting and shipping details)
const CLIENTS_NAV = { href: '/clients', label: 'Clients', icon: Building2, tip: 'The customers you formulate for: contacts, billing, shipping and their projects' }

// Only shown to people who turned on time tracking in Settings › Preferences; it sits before Settings
const TIME_NAV = { href: '/time', label: 'Time', icon: Clock, tip: 'Billable time you’ve logged for clients, and time reports to send them' }

// Only shown to platform admins
const ADMIN_NAV = [
  { href: '/admin/invitations', label: 'Invitations & accounts', icon: MailPlus, tip: 'Platform admin: invite new customers and manage every account’s plan' },
  { href: '/admin/feedback', label: 'Feedback', icon: MessageSquare, tip: 'Platform admin: bug reports and feature requests from users' },
]

export function AppShell({
  children,
  userEmail,
  isPlatformAdmin = false,
  showClients = false,
}: {
  children: React.ReactNode
  userEmail?: string
  isPlatformAdmin?: boolean
  showClients?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { prefs } = usePreferences()
  const withClients = showClients ? [NAV[0], CLIENTS_NAV, ...NAV.slice(1)] : NAV
  const settingsAt = withClients.findIndex(n => n.href === '/settings')
  const base = prefs.timeTracking
    ? [...withClients.slice(0, settingsAt), TIME_NAV, ...withClients.slice(settingsAt)]
    : withClients
  const nav = isPlatformAdmin ? [...base, ...ADMIN_NAV] : base
  const unreadFeedback = useUnreadFeedback(isPlatformAdmin)
  const badge = (href: string) => (href === '/admin/feedback' && unreadFeedback > 0 ? unreadFeedback : 0)
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  // Phones get the main sections in the bottom bar; everything else goes under More
  const primary = nav.filter(n => MOBILE_PRIMARY.includes(n.href)).slice(0, 4)
  const more = nav.filter(n => !primary.includes(n))
  const moreActive = more.some(n => isActive(n.href))
  const moreBadge = more.reduce((sum, n) => sum + badge(n.href), 0)
  // The page More was opened on; it counts as open only while we're still on that page
  const [moreOpenOn, setMoreOpenOn] = useState<string | null>(null)
  const moreOpen = moreOpenOn === pathname
  const sousChef = useSousChef()
  // Sous Chef rides beside project and formulation pages, and anywhere once a conversation is going.
  // Not on its own page, which shows the same chat full size.
  const sousChefAside = pathname !== '/sous-chef' && (sousChef.page || sousChef.conversationId || sousChef.dockOpen)

  async function signOut() {
    sousChef.reset()
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen bg-paper-100">
      {/* Sidebar — desktop only */}
      <aside className="hidden sm:flex w-56 shrink-0 bg-ink-900 text-ink-300 flex-col print:hidden">
        <div className="px-5 pt-6 pb-5">
          <Logo variant="wordmark" height={24} className="text-lcd-300" />
        </div>

        <nav className="flex-1 px-3 pb-4 space-y-1">
          {nav.map(({ href, label, icon: Icon, tip }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                data-tip={tip}
                className={`flex items-center gap-3 h-10 px-3 rounded-lg text-[15px] font-medium transition-colors ${
                  active
                    ? 'bg-lcd-300 text-ink-900'
                    : 'text-ink-300 hover:bg-ink-800 hover:text-paper-50'
                }`}
              >
                <Icon size={18} />
                {label}
                {badge(href) > 0 && (
                  <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center" aria-label={`${badge(href)} unread`}>
                    {badge(href)}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="px-5 py-4 border-t border-ink-700">
          {userEmail && (
            <div className="font-mono text-xs text-ink-400 truncate mb-2">{userEmail}</div>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-xs text-ink-400 hover:text-lcd-300 transition-colors"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content — extra bottom padding on mobile for the nav bar */}
      <main className="flex-1 min-w-0 pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0 print:pb-0 flex flex-col">
        {/* Slim logo strip — mobile only, where there's no sidebar. It scrolls away with the page. */}
        <div className="sm:hidden px-4 py-2 bg-ink-900 print:hidden">
          <Link href="/projects" aria-label="Benchtop home" className="inline-flex">
            <Logo variant="wordmark" height={11} className="text-lcd-300" />
          </Link>
        </div>
        {isPlatformAdmin && <UnreadFeedbackBanner count={unreadFeedback} />}
        <div className="flex-1 min-w-0">{children}</div>
        <FeedbackLink />
      </main>

      {sousChefAside && (sousChef.dockOpen ? <SousChefDock /> : <AskSousChefButton />)}

      {/* Bottom nav — mobile only. Four main sections plus More, which holds the rest. */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-ink-900 border-t border-ink-700 flex pb-[env(safe-area-inset-bottom)] print:hidden">
        {primary.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 min-h-16 px-1 text-[11px] font-medium transition-colors ${
                active ? 'text-lcd-300' : 'text-ink-400'
              }`}
            >
              <Icon size={22} />
              <span className="truncate max-w-full">{label}</span>
            </Link>
          )
        })}
        <button
          onClick={() => setMoreOpenOn(moreOpen ? null : pathname)}
          aria-expanded={moreOpen}
          aria-controls="mobile-more-menu"
          className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 min-h-16 px-1 text-[11px] font-medium transition-colors ${
            moreOpen || moreActive ? 'text-lcd-300' : 'text-ink-400'
          }`}
        >
          <span className="relative">
            <Menu size={22} />
            {moreBadge > 0 && (
              <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-red-500" aria-label={`${moreBadge} unread`} />
            )}
          </span>
          More
        </button>
      </nav>

      {/* More sheet — mobile only. Closes on navigation because it's tied to the page it was opened on. */}
      {moreOpen && (
        <div className="sm:hidden fixed inset-0 z-30 print:hidden" onKeyDown={e => e.key === 'Escape' && setMoreOpenOn(null)}>
          <button aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setMoreOpenOn(null)} />
          <div
            id="mobile-more-menu"
            className="absolute left-0 right-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] bg-ink-900 border-t border-ink-700 rounded-t-2xl px-3 pt-3 pb-2 max-h-[70vh] overflow-y-auto"
          >
            {userEmail && (
              <div className="font-mono text-xs text-ink-400 truncate px-3 pb-2">{userEmail}</div>
            )}
            {more.map(({ href, label, icon: Icon }) => {
              const active = isActive(href)
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 min-h-12 px-3 rounded-lg text-[15px] font-medium ${
                    active ? 'bg-lcd-300 text-ink-900' : 'text-ink-300 active:bg-ink-800'
                  }`}
                >
                  <Icon size={20} />
                  {label}
                  {badge(href) > 0 && (
                    <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center" aria-label={`${badge(href)} unread`}>
                      {badge(href)}
                    </span>
                  )}
                </Link>
              )
            })}
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 min-h-12 px-3 mt-1 rounded-lg border-t border-ink-700 text-[15px] font-medium text-ink-300 active:bg-ink-800"
            >
              <LogOut size={20} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
