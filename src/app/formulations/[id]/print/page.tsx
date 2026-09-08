import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FormulationPrintView } from '@/components/formulations/formulation-print-view'

export default async function FormulationPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  return <FormulationPrintView id={id} />
}
