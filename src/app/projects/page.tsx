import { requirePage } from '@/lib/auth/context'
import { AppShell } from '@/components/app-shell'
import { ProjectList } from '@/components/projects/project-list'
import { canCreateAnyProject } from '@/lib/team-access'

export default async function ProjectsPage() {
  const ctx = await requirePage()

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin}>
      <ProjectList canCreate={canCreateAnyProject(ctx.access)} />
    </AppShell>
  )
}
