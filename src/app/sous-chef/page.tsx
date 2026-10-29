import { requirePage } from '@/lib/auth/context'
import { AppShell } from '@/components/app-shell'
import { SousChefWorkspace, type SousChefFocus } from '@/components/sous-chef/sous-chef-workspace'
import { getOwnedFormulation, getOwnedProject, isUuid } from '@/lib/tenancy'
import { isTeamAdmin } from '@/lib/team-access'

// /sous-chef?c=<conversation> opens a conversation; ?formulation=<id> or ?project=<id> starts a new
// one about that formulation or project (the "Ask Sous Chef" buttons link here)
export default async function SousChefPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; formulation?: string; project?: string }>
}) {
  const ctx = await requirePage()
  const sp = await searchParams

  let focus: SousChefFocus | null = null
  if (sp.formulation) {
    const f = await getOwnedFormulation(ctx, sp.formulation)
    if (f) focus = { kind: 'formulation', id: f.id, name: `${f.name} v${f.version}`, projectId: f.projectId }
  } else if (sp.project) {
    const p = await getOwnedProject(ctx, sp.project)
    if (p) focus = { kind: 'project', id: p.id, name: p.name, projectId: p.id }
  }

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin} showClients={isTeamAdmin(ctx.role)}>
      <SousChefWorkspace
        key={focus?.id ?? 'none'}
        initialConversationId={!focus && isUuid(sp.c) ? sp.c : null}
        focus={focus}
      />
    </AppShell>
  )
}
