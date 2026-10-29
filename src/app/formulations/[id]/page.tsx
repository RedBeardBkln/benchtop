import { notFound } from 'next/navigation'
import { requirePage } from '@/lib/auth/context'
import { getOwnedFormulation } from '@/lib/tenancy'
import { AppShell } from '@/components/app-shell'
import { FormulationGrid } from '@/components/formulations/formulation-grid'
import { isTeamAdmin } from '@/lib/team-access'
import { AskSousChefButton } from '@/components/sous-chef/ask-sous-chef-button'

export default async function FormulationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requirePage()

  const { id } = await params
  if (!(await getOwnedFormulation(ctx, id))) notFound()

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin} showClients={isTeamAdmin(ctx.role)}>
      <FormulationGrid key={id} id={id} />
      <AskSousChefButton kind="formulation" id={id} />
    </AppShell>
  )
}
