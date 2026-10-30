import { requirePage } from '@/lib/auth/context'
import { AppShell } from '@/components/app-shell'
import { ClientList } from '@/components/clients/client-list'

// Everyone sees client records; what members may change is set on Settings › Team
export default async function ClientsPage() {
  const ctx = await requirePage()

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin}>
      <ClientList />
    </AppShell>
  )
}
