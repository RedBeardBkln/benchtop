import { notFound } from 'next/navigation'
import { requirePage } from '@/lib/auth/context'
import { getOwnedFormulation } from '@/lib/tenancy'
import { FormulationPrintView } from '@/components/formulations/formulation-print-view'
import { parsePrintSections } from '@/lib/print-sections'

export default async function FormulationPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sections?: string | string[] }>
}) {
  const ctx = await requirePage()

  const { id } = await params
  if (!(await getOwnedFormulation(ctx, id))) notFound()
  const { sections } = await searchParams

  return <FormulationPrintView id={id} sections={parsePrintSections(sections)} />
}
