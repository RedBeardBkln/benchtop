import type { Tour } from './types'

export const supplierDetailTour: Tour = {
  id: 'supplier-detail-v1',
  paths: ['/suppliers/:id'],
  steps: [
    {
      target: 'supplier-details',
      title: 'Supplier details',
      body: 'Edit the name, website, account number and payment terms. A Save bar appears at the bottom when you have changes.',
    },
    {
      target: 'supplier-contacts',
      title: 'Everyone you deal with',
      body: 'Add sales reps, customer service, QA and anyone else at this supplier. Contacts save on their own.',
    },
    {
      target: 'supplier-ingredients',
      title: 'What you buy here',
      body: 'Every ingredient from this supplier, with pack size and cost. Prices are changed on the ingredient’s Suppliers tab.',
    },
  ],
}
