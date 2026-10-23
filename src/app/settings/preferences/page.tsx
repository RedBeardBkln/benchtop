import { PreferencesPanel } from '@/components/settings/preferences-panel'
import { requirePage } from '@/lib/auth/context'

export default async function PreferencesSettingsPage() {
  await requirePage({ allowUnentitled: true })
  return <PreferencesPanel />
}
