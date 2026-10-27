import Link from 'next/link'
import { requirePage } from '@/lib/auth/context'
import { AppShell } from '@/components/app-shell'
import { TimeTracker } from '@/components/time/time-tracker'
import { resolvePreferences } from '@/lib/preferences'
import { isTeamAdmin } from '@/lib/team-access'

export default async function TimePage() {
  const ctx = await requirePage()
  const on = resolvePreferences(ctx.profile?.preferences).timeTracking

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin} showClients={isTeamAdmin(ctx.role)}>
      {on ? (
        <TimeTracker isTeamAdmin={isTeamAdmin(ctx.role)} />
      ) : (
        <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-2xl">
          <h1 className="text-2xl font-semibold text-gray-900">Time</h1>
          <p className="text-sm text-gray-600 mt-3">
            Billable time tracking is turned off. Turn on <strong>Track billable time</strong> in{' '}
            <Link href="/settings/preferences" className="text-blue-600 hover:underline">Settings › Preferences</Link>{' '}
            to log time against your clients and prepare time reports.
          </p>
        </div>
      )}
    </AppShell>
  )
}
