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
      {/* Sidebar */}
      <aside className="w-52 shrink-0 bg-gray-900 text-gray-100 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-800">
          <img
            src="/LaunchTime logo-transparent.png"
            alt="LaunchTime Solutions"
            className="w-full object-contain mb-2"
            style={{ maxHeight: 56 }}
          />
          <div className="text-sm font-semibold tracking-tight text-white">Benchtop</div>
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

      {/* Main */}
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
