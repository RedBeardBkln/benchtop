import { AppShell } from '@/components/app-shell'
import { InvitationsAdmin } from '@/components/admin/invitations-admin'
import { requirePage } from '@/lib/auth/context'

// Platform admins only; everyone else gets a 404.
// `?request=<id>` (the Approve button in the request notification email) fills that request into
// the invite form.
export default async function AdminInvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string | string[] }>
}) {
  const ctx = await requirePage({ allowUnentitled: true, platformAdmin: true })
  const { request } = await searchParams
  const approveRequestId = typeof request === 'string' ? request : undefined

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin}>
      <div className="px-4 py-5 sm:px-8 sm:py-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Invitations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Benchtop is invitation only. Create an invite, then send the link to the person yourself. Manage
            existing accounts under <a href="/admin/accounts" className="text-blue-600 hover:underline">Accounts</a>.
          </p>
        </div>
        <InvitationsAdmin approveRequestId={approveRequestId} />
      </div>
    </AppShell>
  )
}
