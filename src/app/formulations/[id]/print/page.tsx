import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FormulationPrintView } from '@/components/formulations/formulation-print-view'
import { parsePrintSections } from '@/lib/print-sections'

export default async function FormulationPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sections?: string | string[] }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params
  const { sections } = await searchParams

  return <FormulationPrintView id={id} sections={parsePrintSections(sections)} />
}
