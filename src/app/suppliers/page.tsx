import { requirePage } from '@/lib/auth/context'
import { AppShell } from '@/components/app-shell'
import { SupplierList } from '@/components/suppliers/supplier-list'

export default async function SuppliersPage() {
  const ctx = await requirePage()

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin}>
      <SupplierList />
    </AppShell>
  )
}
