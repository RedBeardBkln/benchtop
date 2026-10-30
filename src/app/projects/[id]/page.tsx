import { notFound } from 'next/navigation'
import { requirePage } from '@/lib/auth/context'
import { getOwnedProject } from '@/lib/tenancy'
import { AppShell } from '@/components/app-shell'
import { ProjectDetail } from '@/components/projects/project-detail'
import { SousChefPageContext } from '@/components/sous-chef/sous-chef-session'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requirePage()

  const { id } = await params
  const project = await getOwnedProject(ctx, id)
  if (!project) notFound()

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin}>
      <ProjectDetail id={id} />
      <SousChefPageContext project={{ id, name: project.name }} />
    </AppShell>
  )
}
