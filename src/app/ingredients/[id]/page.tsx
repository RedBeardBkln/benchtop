import { notFound } from 'next/navigation'
import { requirePage } from '@/lib/auth/context'
import { getOwnedIngredient } from '@/lib/tenancy'
import { AppShell } from '@/components/app-shell'
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
      <IngredientDetail id={id} />
    </AppShell>
  )
}
