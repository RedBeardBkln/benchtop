import { AppShell } from '@/components/app-shell'
import { AccountAdminDetail } from '@/components/admin/account-admin-detail'
import { requirePage } from '@/lib/auth/context'

// Platform admins only; everyone else gets a 404.
export default async function AdminAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage({ allowUnentitled: true, platformAdmin: true })
  const { id } = await params

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin}>
      <AccountAdminDetail id={id} />
    </AppShell>
  )
}
