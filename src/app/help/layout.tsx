import { AppShell } from '@/components/app-shell'
import { HelpNav, HelpSearch } from '@/components/help/help-ui'
import { requirePage } from '@/lib/auth/context'
import { isTeamAdmin } from '@/lib/team-access'

// Help is open to every signed-in member, subscribed or not, like Settings.
export default async function HelpLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePage({ allowUnentitled: true })

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin} showClients={isTeamAdmin(ctx.role)}>
      <div className="px-4 py-5 sm:px-8 sm:py-8 max-w-6xl">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold text-gray-900">Help & FAQ</h1>
          <p className="text-sm text-gray-500 mt-1">Step-by-step guides for everything in Benchtop, and answers to common questions.</p>
        </div>
        <div className="mb-6 max-w-2xl">
          <HelpSearch />
        </div>
        <div className="flex flex-col lg:flex-row gap-6">
          <HelpNav />
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </AppShell>
  )
}
