import { Suspense } from 'react'
import { AppShell } from '@/components/app-shell'
import { AdminConsole } from '@/components/admin/admin-console'
import { requirePage } from '@/lib/auth/context'

// Platform admins only; everyone else gets a 404.
export default async function AdminAccountsPage() {
  const ctx = await requirePage({ allowUnentitled: true, platformAdmin: true })

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin}>
      <div className="px-4 py-5 sm:px-8 sm:py-8 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">Every Benchtop account and person: plans, subscriptions, usage and activity.</p>
        </div>
        <Suspense>
          <AdminConsole />
        </Suspense>
      </div>
    </AppShell>
  )
}
