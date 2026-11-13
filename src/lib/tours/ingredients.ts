import type { Tour } from './types'

export const ingredientsTour: Tour = {
  id: 'ingredients-v1',
  paths: ['/ingredients'],
  steps: [
    {
      title: 'Your ingredient library',
      body: 'Every raw material you use lives here, with its nutrition, allergens, suppliers, cost and stock. Your whole team shares one library.',
    },
    {
      target: 'ingredients-add',
      title: 'Add an ingredient',
      body: 'Type one in, or pull nutrition from a supplier’s web page. “Scan photos” beside it reads a package label for you.',
    },
    {
      target: 'ingredients-usda',
      title: 'Import from USDA',
      body: 'For common foods, search the USDA database. You get complete nutrition in a few clicks, and it arrives verified.',
    },
    {
      target: 'ingredients-intake',
      title: 'Log a whole shelf',
      body: 'Lab intake adds many materials at once from typed names, a pasted list or photos of container labels. Handy for a new lab or a stock count.',
    },
    {
      target: 'ingredients-filters',
      title: 'Narrow the list',
      body: 'Search by name above, or show one category or only what’s on hand in your lab.',
    },
    {
      target: 'ingredients-list',
      title: 'Open an ingredient',
      body: 'Badges show where each ingredient’s data came from and whether it’s been verified. Click a row to see and edit everything about it.',
    },
  ],
}
