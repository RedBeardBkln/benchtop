import { requirePage } from '@/lib/auth/context'
import { AppShell } from '@/components/app-shell'
import { LibraryViewOnlyNotice } from '@/components/view-only-notice'
import { canEditLibrary, isTeamAdmin } from '@/lib/team-access'
import { SupplierList } from '@/components/suppliers/supplier-list'

export default async function SuppliersPage() {
  const ctx = await requirePage()
  const canEdit = canEditLibrary(ctx.access)

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin} showClients={isTeamAdmin(ctx.role)}>
      {!canEdit && (
        <div className="px-4 pt-5 sm:px-8"><LibraryViewOnlyNotice /></div>
      )}
      <SupplierList canEdit={canEdit} />
    </AppShell>
  )
}
