import type { Tour } from './types'

export const labIntakeTour: Tour = {
  id: 'lab-intake-v1',
  paths: ['/ingredients/intake'],
  steps: [
    {
      target: 'intake-type',
      title: 'Type each label',
      body: 'Type what the container says, add a quantity if you like, and press Enter. The box clears for the next one.',
    },
    {
      target: 'intake-photos',
      title: 'Or snap the labels',
      body: 'Photograph up to 10 container labels at a time. AI reads each name and amount and adds it to the list.',
    },
    {
      target: 'intake-paste',
      title: 'Paste a whole list',
      body: 'Already have a list? Paste it one item per line. A quantity at the end, like “Inulin 2 kg”, is picked up too.',
    },
    {
      target: 'intake-identify',
      title: 'Identify & categorize',
      body: 'AI gives each item a clean name and category, rates how sure it is and spots items already in your library.',
    },
    {
      target: 'intake-list',
      title: 'Review the list',
      body: 'Check each item and fix anything with the pencil. The list is shared with your team and stays until you upload it.',
    },
    {
      target: 'intake-upload',
      title: 'Upload to the library',
      body: 'Identified items go into the library marked on hand. New ones have no nutrition yet, so add it afterwards.',
    },
  ],
}
