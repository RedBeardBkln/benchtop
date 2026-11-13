import type { Tour } from './types'

export const suppliersTour: Tour = {
  id: 'suppliers-v1',
  paths: ['/suppliers'],
  steps: [
    {
      title: 'Your suppliers',
      body: 'Keep every vendor and distributor you buy from in one place, with contacts, account numbers and payment terms.',
    },
    {
      target: 'suppliers-new',
      title: 'Add a supplier',
      body: 'Add a company with its main contact, address and terms. You can add more contacts once it’s saved.',
    },
    {
      target: 'suppliers-search',
      title: 'Find one fast',
      body: 'Search by supplier name, contact name, email, or city, state or country.',
    },
    {
      target: 'suppliers-list',
      title: 'Open a supplier',
      body: 'Each row shows the main contact, location and how many ingredients come from that supplier. Click one to open its record.',
    },
    {
      title: 'Prices live on ingredients',
      body: 'Pack sizes and prices are set on each ingredient’s Suppliers tab, so your formulations can use them for COGS.',
    },
  ],
}
