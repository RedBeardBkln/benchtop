import type { Tour } from './types'

export const formulationImportTour: Tour = {
  id: 'formulation-import-v1',
  paths: ['/formulations/import'],
  steps: [
    {
      target: 'import-upload',
      title: 'Upload your spreadsheet',
      body: 'Drop an Excel (.xlsx) or CSV file here. Benchtop reads it and builds a matching formulation, so you don’t have to type it in again.',
    },
    {
      title: 'Check it before saving',
      body: 'Next you’ll review the name, project, ingredients and steps, and link each row to your library. Nothing is created until you click Create formulation.',
    },
    {
      title: 'Finish it later',
      body: 'Missing a spec sheet or an ingredient? Save as draft and come back to it whenever you’re ready. Drafts are private to you.',
    },
    {
      target: 'import-drafts',
      title: 'Unfinished imports',
      body: 'Your saved drafts are listed here. Click Continue to pick up where you left off.',
    },
  ],
}
