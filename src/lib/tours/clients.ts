import type { Tour } from './types'

export const clientsTour: Tour = {
  id: 'clients-v1',
  paths: ['/clients'],
  steps: [
    {
      target: 'clients-header',
      title: 'Welcome to Clients',
      body: 'If you formulate for other companies, keep each customer’s contacts, billing and shipping details here, linked to their projects.',
    },
    {
      target: 'clients-new',
      title: 'Add a client',
      body: 'Type the name they do business as and their record opens, ready for contacts, accounting and shipping details.',
    },
    {
      target: 'clients-list',
      title: 'Your clients',
      body: 'Each client is listed with its primary contact and how many projects it has. Click a name to open its record.',
    },
    {
      title: 'Link projects to clients',
      body: 'Pick a client on a project’s page to link them. The project then shows on the client’s record, and teammates with access to that client can see it.',
    },
  ],
}
