import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { IngredientDetail } from '@/components/ingredients/ingredient-detail'

export default async function IngredientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  return (
    <AppShell userEmail={user.email}>
      <IngredientDetail id={id} />
    </AppShell>
  )
}
