import { z } from 'zod'

// Per-user display preferences, stored in profiles.preferences. Every field is optional so new
// preferences need no migration; read them through resolvePreferences for the defaults.

export const COGS_FIGURES = ['batch', 'perMass', 'serving', 'unit'] as const
export type CogsFigure = (typeof COGS_FIGURES)[number]

export const COST_UNITS = ['kg', 'lb'] as const
export type CostUnit = (typeof COST_UNITS)[number]

export const userPreferencesSchema = z.object({
  /** Show the COGS tab on formulations. Ingredient costs can be recorded either way. */
  showCogs: z.boolean().optional(),
  /** Which totals the COGS summary shows */
  cogsFigures: z.array(z.enum(COGS_FIGURES)).max(COGS_FIGURES.length).optional(),
  /** Mass unit for COGS per-mass figures */
  cogsMassUnit: z.enum(COST_UNITS).optional(),
  /** Show Time in the menu, for logging billable time against clients */
  timeTracking: z.boolean().optional(),
})
export type UserPreferences = z.infer<typeof userPreferencesSchema>

export function resolvePreferences(p: UserPreferences | null | undefined) {
  return {
    showCogs: p?.showCogs ?? false,
    cogsFigures: p?.cogsFigures ?? (['batch', 'perMass', 'serving'] as CogsFigure[]),
    cogsMassUnit: p?.cogsMassUnit ?? ('kg' as CostUnit),
    timeTracking: p?.timeTracking ?? false,
  }
}
export type ResolvedPreferences = ReturnType<typeof resolvePreferences>
