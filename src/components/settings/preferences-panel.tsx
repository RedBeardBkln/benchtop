'use client'

import { Card } from '@/components/settings/ui'
import { usePreferences } from '@/lib/use-preferences'

export function PreferencesPanel() {
  const { prefs, isLoading, setPrefs } = usePreferences()
  return (
    <div className="space-y-6">
      <Card
        title="Raw material costing (COGS)"
        description="Adds a COGS tab to formulations showing raw material cost per batch, per kg or lb, per serving and per unit, with each ingredient's share. You can record ingredient costs either way; this only controls whether formulations show them."
      >
        <label className="flex items-center gap-3 text-sm text-gray-800 cursor-pointer w-fit"
          data-tip="Turns the COGS tab on formulations on or off, just for you. Ingredient costs are kept either way.">
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

      <Card
        title="Billable time tracking"
        description="Adds Time to the menu, where you log time against your clients (and optionally a project): the task, the type of work, start and end times, and whether it has been billed. From there you can prepare a time report to send a client as a PDF or spreadsheet."
      >
        <label className="flex items-center gap-3 text-sm text-gray-800 cursor-pointer w-fit"
          data-tip="Shows or hides Time in the menu, just for you. Time you’ve already logged is kept either way.">
          <input
            type="checkbox"
            role="switch"
            checked={prefs.timeTracking}
            disabled={isLoading}
            onChange={e => setPrefs({ timeTracking: e.target.checked })}
            className="h-4 w-4 accent-blue-600"
          />
          Track billable time
        </label>
        <p className="text-xs text-gray-500 mt-2">This setting is just for you; teammates choose their own.</p>
      </Card>
    </div>
  )
}
