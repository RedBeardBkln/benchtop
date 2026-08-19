'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { FolderOpen, FlaskConical, LogOut, Truck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/ingredients', label: 'Ingredients', icon: FlaskConical },
  { href: '/suppliers', label: 'Suppliers', icon: Truck },
]

export function AppShell({
  children,
  userEmail,
}: {
  children: React.ReactNode
  userEmail?: string
}) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar — desktop only */}
      <aside className="hidden sm:flex w-52 shrink-0 bg-gray-900 text-gray-100 flex-col">
        <div className="px-4 py-4 border-b border-gray-800 flex items-center gap-3">
          <img
            src="/benchtop-mark.svg"
            alt="benchtop"
            className="shrink-0"
            style={{ width: 32, height: 40 }}
          />
          <span className="text-sm font-semibold tracking-wide text-white">benchtop</span>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="px-4 py-4 border-t border-gray-800">
          {userEmail && (
            <div className="text-xs text-gray-500 truncate mb-2">{userEmail}</div>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content — extra bottom padding on mobile for the nav bar */}
      <main className="flex-1 min-w-0 pb-16 sm:pb-0">{children}</main>

      {/* Bottom nav — mobile only */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-gray-900 border-t border-gray-800 flex">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs transition-colors ${
                active ? 'text-white' : 'text-gray-400'
              }`}
            >
              <Icon size={20} />
              {label}
            </Link>
          )
        })}
        <button
          onClick={signOut}
          className="flex-1 flex flex-col items-center gap-0.5 py-3 text-xs text-gray-400"
        >
          <LogOut size={20} />
          Sign out
        </button>
      </nav>
    </div>
  )
}
