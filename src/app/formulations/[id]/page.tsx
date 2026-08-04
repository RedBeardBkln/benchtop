import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { FormulationGrid } from '@/components/formulations/formulation-grid'

export default async function FormulationPage({
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
      <FormulationGrid id={id} />
    </AppShell>
  )
}
