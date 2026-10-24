'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Building2, FolderOpen, FlaskConical, HelpCircle, LogOut, MailPlus, MessageSquare, Settings, Truck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/logo'
import { FeedbackLink } from '@/components/feedback-link'
import { UnreadFeedbackBanner, useUnreadFeedback } from '@/components/admin/unread-feedback'

const NAV = [
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/ingredients', label: 'Ingredients', icon: FlaskConical },
  { href: '/suppliers', label: 'Suppliers', icon: Truck },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/help', label: 'Help', icon: HelpCircle },
]

// Only shown to account owners and admins (client records hold accounting and shipping details)
const CLIENTS_NAV = { href: '/clients', label: 'Clients', icon: Building2 }

// Only shown to platform admins
const ADMIN_NAV = [
  { href: '/admin/invitations', label: 'Invitations & accounts', icon: MailPlus },
  { href: '/admin/feedback', label: 'Feedback', icon: MessageSquare },
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
  const base = showClients ? [NAV[0], CLIENTS_NAV, ...NAV.slice(1)] : NAV
  const nav = isPlatformAdmin ? [...base, ...ADMIN_NAV] : base
  const unreadFeedback = useUnreadFeedback(isPlatformAdmin)
  const badge = (href: string) => (href === '/admin/feedback' && unreadFeedback > 0 ? unreadFeedback : 0)

  async function signOut() {
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
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
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
        {isPlatformAdmin && <UnreadFeedbackBanner count={unreadFeedback} />}
        <div className="flex-1 min-w-0">{children}</div>
        <FeedbackLink />
      </main>

      {/* Bottom nav — mobile only */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-ink-900 border-t border-ink-700 flex pb-[env(safe-area-inset-bottom)] print:hidden">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs transition-colors ${
                active ? 'text-lcd-300' : 'text-ink-400'
              }`}
            >
              <span className="relative">
                <Icon size={20} />
                {badge(href) > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-red-500" aria-label={`${badge(href)} unread`} />
                )}
              </span>
              {label}
            </Link>
          )
        })}
        <button
          onClick={signOut}
          className="flex-1 flex flex-col items-center gap-0.5 py-3 text-xs text-ink-400"
        >
          <LogOut size={20} />
          Sign out
        </button>
      </nav>
    </div>
  )
}
