import { AppShell } from '@/components/app-shell'
import { SettingsNav } from '@/components/settings/settings-nav'
import { requirePage } from '@/lib/auth/context'

// Settings is reachable by every signed-in member, subscribed or not (the billing page is where
// an unsubscribed user is sent), but still requires authentication and an account.
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePage({ allowUnentitled: true })

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin}>
      <div className="px-4 py-5 sm:px-8 sm:py-8 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Your profile, account, subscription and privacy.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-6">
          <SettingsNav />
          <div className="flex-1 min-w-0 space-y-6">{children}</div>
        </div>
      </div>
    </AppShell>
  )
}
