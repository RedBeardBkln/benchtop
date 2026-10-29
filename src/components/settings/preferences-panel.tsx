'use client'

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { Card } from '@/components/settings/ui'
import { usePreferences } from '@/lib/use-preferences'
import { readThemePref, setThemePref, type ThemePref } from '@/lib/theme'

const THEME_OPTIONS: { value: ThemePref; label: string; icon: typeof Sun; tip: string }[] = [
  { value: 'light', label: 'Light', icon: Sun, tip: 'Always show Benchtop light' },
  { value: 'dark', label: 'Dark', icon: Moon, tip: 'Always show Benchtop dark' },
  { value: 'auto', label: 'Auto', icon: Monitor, tip: 'Match this device’s light or dark setting, switching when it does' },
]

function AppearanceCard() {
  // Read after mount: the preference lives in this browser, which the server can't see
  const [theme, setTheme] = useState<ThemePref | null>(null)
  useEffect(() => { setTheme(readThemePref()) }, [])

  const choose = (pref: ThemePref) => {
    setThemePref(pref)
    setTheme(pref)
  }

  return (
    <Card
      title="Appearance"
      description="Show Benchtop light or dark, or set it to Auto to follow your device. Printed pages and downloads are always light."
    >
      <div role="radiogroup" aria-label="Appearance" className="inline-flex rounded-md border border-gray-300 p-0.5 gap-0.5">
        {THEME_OPTIONS.map(({ value, label, icon: Icon, tip }) => {
          const selected = theme === value
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              data-tip={tip}
              onClick={() => choose(value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded ${
                selected ? 'bg-blue-600 font-medium' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-gray-500 mt-2">Remembered in this browser, so each device can have its own.</p>
    </Card>
  )
}

export function PreferencesPanel() {
  const { prefs, isLoading, setPrefs } = usePreferences()
  return (
    <div className="space-y-6">
      <AppearanceCard />

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
