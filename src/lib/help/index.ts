import { billing } from './content/billing'
import { clients } from './content/clients'
import { formulations } from './content/formulations'
import { gettingStarted } from './content/getting-started'
import { ingredients } from './content/ingredients'
import { projects } from './content/projects'
import { settings } from './content/settings'
import { suppliers } from './content/suppliers'
import { team } from './content/team'
import type { HelpSection } from './types'

// Order here is the order in the Help sidebar and on the Help home page
export const HELP_SECTIONS: HelpSection[] = [
  gettingStarted,
  projects,
  formulations,
  ingredients,
  suppliers,
  clients,
  team,
  settings,
  billing,
]

// Shown on the Help home page; each must match an FAQ question exactly (checked by a test)
export const POPULAR_QUESTIONS: { section: string; q: string }[] = [
  { section: 'formulations', q: 'I made changes and they disappeared. What happened?' },
  { section: 'getting-started', q: 'I never got an invitation email. Where is it?' },
  { section: 'settings', q: 'I clicked the reset link but it says it expired or was already used.' },
  { section: 'team', q: 'My new teammate can’t see any projects. Why?' },
  { section: 'ingredients', q: 'My new ingredient has no nutrition. Why?' },
  { section: 'formulations', q: 'How do I scale my recipe to a bigger batch?' },
  { section: 'formulations', q: 'Why does my Nutrition Facts panel say “Amount per 100g”?' },
  { section: 'ingredients', q: 'Why can’t I delete an ingredient?' },
  { section: 'projects', q: 'How do I delete a project?' },
  { section: 'billing', q: 'How much does Benchtop cost?' },
]
