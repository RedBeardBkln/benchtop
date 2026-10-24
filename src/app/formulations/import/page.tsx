import { requirePage } from '@/lib/auth/context'
import { AppShell } from '@/components/app-shell'
import { FormulationImport } from '@/components/formulations/import/formulation-import'
import { canCreateAnyProject, canEditLibrary, isTeamAdmin } from '@/lib/team-access'
import { isUuid } from '@/lib/tenancy'

export default async function ImportFormulationPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; draft?: string }>
}) {
  const ctx = await requirePage()
  const sp = await searchParams

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin} showClients={isTeamAdmin(ctx.role)}>
      <FormulationImport
        key={sp.draft ?? 'new'}
        projectId={isUuid(sp.project) ? sp.project : null}
        draftId={isUuid(sp.draft) ? sp.draft : null}
        canEditLibrary={canEditLibrary(ctx.access)}
        canCreateProject={canCreateAnyProject(ctx.access)}
      />
    </AppShell>
  )
}
