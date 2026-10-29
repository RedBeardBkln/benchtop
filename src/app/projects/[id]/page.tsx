import { notFound } from 'next/navigation'
import { requirePage } from '@/lib/auth/context'
import { getOwnedProject } from '@/lib/tenancy'
import { AppShell } from '@/components/app-shell'
import { ProjectDetail } from '@/components/projects/project-detail'
import { isTeamAdmin } from '@/lib/team-access'
import { AskSousChefButton } from '@/components/sous-chef/ask-sous-chef-button'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requirePage()

  const { id } = await params
  if (!(await getOwnedProject(ctx, id))) notFound()

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin} showClients={isTeamAdmin(ctx.role)}>
      <ProjectDetail id={id} />
      <AskSousChefButton kind="project" id={id} />
    </AppShell>
  )
}
