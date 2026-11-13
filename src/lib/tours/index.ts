import type { Tour } from './types'
import { projectsTour } from './projects'
import { projectDetailTour } from './project-detail'
import { formulationTour } from './formulation'
import { formulationImportTour } from './formulation-import'
import { ingredientsTour } from './ingredients'
import { ingredientDetailTour } from './ingredient-detail'
import { labIntakeTour } from './lab-intake'
import { suppliersTour } from './suppliers'
import { supplierDetailTour } from './supplier-detail'
import { clientsTour } from './clients'
import { clientDetailTour } from './client-detail'
import { timeTour } from './time'
import { timeReportTour } from './time-report'
import { sousChefTour } from './sous-chef'
import {
  settingsAccountTour, settingsBillingTour, settingsInvoicingConnectionTour, settingsPreferencesTour,
  settingsPrivacyTour, settingsProfileTour, settingsTeamTour,
} from './settings'
import { helpSectionTour, helpTour } from './help'

export * from './types'

// Every page tour. Add new tours here; tours.test.ts checks ids are unique and no tour runs long.
export const TOURS: Tour[] = [
  projectsTour, projectDetailTour, formulationTour, formulationImportTour,
  ingredientsTour, ingredientDetailTour, labIntakeTour,
  suppliersTour, supplierDetailTour,
  clientsTour, clientDetailTour,
  timeTour, timeReportTour,
  sousChefTour,
  settingsProfileTour, settingsPreferencesTour, settingsAccountTour, settingsTeamTour,
  settingsBillingTour, settingsInvoicingConnectionTour, settingsPrivacyTour,
  helpTour, helpSectionTour,
]

/** Whether a path pattern ("/projects/:id") matches a pathname */
export function matchPath(pattern: string, pathname: string): boolean {
  const a = pattern.split('/').filter(Boolean)
  const b = pathname.split('/').filter(Boolean)
  return a.length === b.length && a.every((seg, i) => seg.startsWith(':') || seg === b[i])
}

/** The tour for a page, if it has one. Exact segments win over ":param" ones ("/projects/new" over "/projects/:id"). */
export function tourForPath(pathname: string): Tour | null {
  let best: { tour: Tour; score: number } | null = null
  for (const tour of TOURS) {
    for (const p of tour.paths) {
      if (!matchPath(p, pathname)) continue
      const score = p.split('/').filter(s => s && !s.startsWith(':')).length
      if (!best || score > best.score) best = { tour, score }
    }
  }
  return best?.tour ?? null
}
