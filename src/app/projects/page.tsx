import { requirePage } from '@/lib/auth/context'
import { AppShell } from '@/components/app-shell'
import { ProjectList } from '@/components/projects/project-list'

export default async function ProjectsPage() {
  const ctx = await requirePage()

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin}>
      <ProjectList />
    </AppShell>
  )
}
