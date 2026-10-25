import { AppShell } from '@/components/app-shell'
import { InvitationsAdmin } from '@/components/admin/invitations-admin'
import { AccountsAdmin } from '@/components/admin/accounts-admin'
import { requirePage } from '@/lib/auth/context'
import { isTeamAdmin } from '@/lib/team-access'

// Platform admins only; everyone else gets a 404.
export default async function AdminInvitationsPage() {
  const ctx = await requirePage({ allowUnentitled: true, platformAdmin: true })

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin} showClients={isTeamAdmin(ctx.role)}>
      <div className="px-4 py-5 sm:px-8 sm:py-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Invitations and accounts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Benchtop is invitation only. Create an invite, then send the link to the person yourself.
          </p>
        </div>
        <div className="space-y-6">
          <InvitationsAdmin />
          <AccountsAdmin />
        </div>
      </div>
    </AppShell>
  )
}
