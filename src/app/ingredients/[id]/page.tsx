import { notFound } from 'next/navigation'
import { requirePage } from '@/lib/auth/context'
import { getOwnedIngredient } from '@/lib/tenancy'
import { AppShell } from '@/components/app-shell'
import { LibraryViewOnlyNotice } from '@/components/view-only-notice'
import { canEditLibrary } from '@/lib/team-access'
import { IngredientDetail } from '@/components/ingredients/ingredient-detail'

export default async function IngredientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requirePage()

  const { id } = await params
  if (!(await getOwnedIngredient(ctx, id))) notFound()

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin}>
      {!canEditLibrary(ctx.access) && (
        <div className="px-4 pt-5 sm:px-8 print:hidden"><LibraryViewOnlyNotice /></div>
      )}
      <IngredientDetail id={id} canEdit={canEditLibrary(ctx.access)} />
    </AppShell>
  )
}
