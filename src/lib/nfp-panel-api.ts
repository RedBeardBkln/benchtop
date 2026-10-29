import { z } from 'zod'
import { formulationNfpPanels } from '@/lib/db/schema'
import { nfpModelSchema, nfpOptionsSchema } from '@/lib/nfp-model'

// Shared by the saved-panel routes: what a save or an edit sends, and what is returned. SERVER ONLY.

/** A saved panel as the dialog sends it, for a new panel or an edit */
export const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  servingSizeG: z.number().positive().max(1_000_000).nullish(),
  options: nfpOptionsSchema,
  model: nfpModelSchema,
})

export const panelColumns = {
  id: formulationNfpPanels.id,
  name: formulationNfpPanels.name,
  rulesVersion: formulationNfpPanels.rulesVersion,
  servingSizeG: formulationNfpPanels.servingSizeG,
  options: formulationNfpPanels.options,
  model: formulationNfpPanels.model,
  createdAt: formulationNfpPanels.createdAt,
}
