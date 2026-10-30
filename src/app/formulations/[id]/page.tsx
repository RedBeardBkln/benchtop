import { notFound } from 'next/navigation'
import { requirePage } from '@/lib/auth/context'
import { getOwnedFormulation, getOwnedProject } from '@/lib/tenancy'
import { AppShell } from '@/components/app-shell'
import { FormulationGrid } from '@/components/formulations/formulation-grid'
import { SousChefPageContext } from '@/components/sous-chef/sous-chef-session'

export default async function FormulationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requirePage()

  const { id } = await params
  const f = await getOwnedFormulation(ctx, id)
  if (!f) notFound()
  // For Sous Chef: what this iteration is, so a conversation can be linked to it, its formulation or its project
  const project = await getOwnedProject(ctx, f.projectId)

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin}>
      <FormulationGrid key={id} id={id} />
      {project && (
        <SousChefPageContext
          project={{ id: project.id, name: project.name }}
          formulation={{ id, familyId: f.familyId, name: f.name, version: f.version }}
        />
      )}
    </AppShell>
  )
}
