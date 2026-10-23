'use client'

import { Card } from '@/components/settings/ui'
import { usePreferences } from '@/lib/use-preferences'

export function PreferencesPanel() {
  const { prefs, isLoading, setPrefs } = usePreferences()
  return (
    <Card
      title="Raw material costing (COGS)"
      description="Adds a COGS tab to formulations showing raw material cost per batch, per kg or lb, per serving and per unit, with each ingredient's share. You can record ingredient costs either way; this only controls whether formulations show them."
    >
      <label className="flex items-center gap-3 text-sm text-gray-800 cursor-pointer w-fit">
        <input
          type="checkbox"
          role="switch"
          checked={prefs.showCogs}
          disabled={isLoading}
          onChange={e => setPrefs({ showCogs: e.target.checked })}
          className="h-4 w-4 accent-blue-600"
        />
        Show COGS on formulations
      </label>
      <p className="text-xs text-gray-500 mt-2">This setting is just for you; teammates choose their own.</p>
    </Card>
  )
}
