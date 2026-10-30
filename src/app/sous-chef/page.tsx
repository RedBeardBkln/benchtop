import { requirePage } from '@/lib/auth/context'
import { AppShell } from '@/components/app-shell'
import type { ConversationLink } from '@/lib/sous-chef'
import { SousChefWorkspace } from '@/components/sous-chef/sous-chef-workspace'
import { getOwnedFormulation, getOwnedProject, isUuid } from '@/lib/tenancy'
import { isTeamAdmin } from '@/lib/team-access'

// /sous-chef?c=<conversation> opens a conversation; ?formulation=<iteration id> or ?project=<id> starts a new
// one about that iteration or project. With neither, the conversation you were in carries on.
export default async function SousChefPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; formulation?: string; project?: string }>
}) {
  const ctx = await requirePage()
  const sp = await searchParams

  let link: ConversationLink | null = null
  if (sp.formulation) {
    const f = await getOwnedFormulation(ctx, sp.formulation)
    if (f) link = { scope: 'iteration', id: f.id, name: `${f.name} v${f.version}`, href: `/formulations/${f.id}` }
  } else if (sp.project) {
    const p = await getOwnedProject(ctx, sp.project)
    if (p) link = { scope: 'project', id: p.id, name: p.name, href: `/projects/${p.id}` }
  }

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin} showClients={isTeamAdmin(ctx.role)}>
      <SousChefWorkspace
        initialConversationId={!link && isUuid(sp.c) ? sp.c : null}
        initialLink={link}
      />
    </AppShell>
  )
}
