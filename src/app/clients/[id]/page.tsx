import { requirePage } from '@/lib/auth/context'
import { AppShell } from '@/components/app-shell'
import { ClientDetail } from '@/components/clients/client-detail'

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage({ teamAdmin: true })
  const { id } = await params

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin} showClients>
      <ClientDetail id={id} />
    </AppShell>
  )
}
