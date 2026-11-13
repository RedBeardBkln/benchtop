import { requirePage } from '@/lib/auth/context'
import { AiSettingsPanel } from '@/components/settings/ai-settings'

export default async function AiSettingsPage() {
  await requirePage({ allowUnentitled: true })
  return <AiSettingsPanel />
}
