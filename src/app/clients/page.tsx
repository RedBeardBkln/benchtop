import { requirePage } from '@/lib/auth/context'
import { AppShell } from '@/components/app-shell'
import { ClientList } from '@/components/clients/client-list'

// Owners and admins only: client records hold accounting and shipping details
export default async function ClientsPage() {
  const ctx = await requirePage({ teamAdmin: true })

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin} showClients>
      <ClientList />
    </AppShell>
  )
}
