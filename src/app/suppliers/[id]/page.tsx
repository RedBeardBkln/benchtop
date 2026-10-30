import { requirePage } from '@/lib/auth/context'
import { AppShell } from '@/components/app-shell'
import { LibraryViewOnlyNotice } from '@/components/view-only-notice'
import { canEditLibrary } from '@/lib/team-access'
import { SupplierDetail } from '@/components/suppliers/supplier-detail'

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage()
  const { id } = await params
  const canEdit = canEditLibrary(ctx.access)

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin}>
      {!canEdit && (
        <div className="px-4 pt-5 sm:px-8"><LibraryViewOnlyNotice /></div>
      )}
      <SupplierDetail id={id} canEdit={canEdit} />
    </AppShell>
  )
}
