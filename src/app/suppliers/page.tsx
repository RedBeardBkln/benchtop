import { requirePage } from '@/lib/auth/context'
import { AppShell } from '@/components/app-shell'
import { LibraryViewOnlyNotice } from '@/components/view-only-notice'
import { canEditLibrary } from '@/lib/team-access'
import { SupplierList } from '@/components/suppliers/supplier-list'

export default async function SuppliersPage() {
  const ctx = await requirePage()

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin}>
      {!canEditLibrary(ctx.access) && (
        <div className="px-4 pt-5 sm:px-8"><LibraryViewOnlyNotice /></div>
      )}
      <SupplierList />
    </AppShell>
  )
}
