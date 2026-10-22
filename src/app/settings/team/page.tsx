import { TeamSettings } from '@/components/settings/team-settings'
import { requirePage } from '@/lib/auth/context'

// Owners and admins only; everyone else gets a 404.
export default async function TeamSettingsPage() {
  await requirePage({ allowUnentitled: true, teamAdmin: true })
  return <TeamSettings />
}
