import type { Tour } from './types'

export const clientDetailTour: Tour = {
  id: 'client-detail-v1',
  paths: ['/clients/:id'],
  steps: [
    {
      title: 'A client’s record',
      body: 'Everything about one customer lives on this page: who they are, who you talk to, how they’re billed and where samples ship.',
    },
    {
      target: 'client-details',
      title: 'The basics',
      body: 'The name they trade under shows on projects. Add their legal company name for invoices and contracts if it’s different.',
    },
    {
      target: 'client-billing',
      title: 'Billing and shipping',
      body: 'Keep payment terms, the invoice email, addresses and the client’s own carrier accounts on hand, so nobody has to dig through old emails.',
    },
    {
      target: 'client-projects',
      title: 'Their projects',
      body: 'Every project linked to this client is listed here. Link one by choosing this client on the project’s page.',
    },
    {
      title: 'Remember to save',
      body: 'When you change details, accounting or shipping, an Unsaved changes bar appears at the bottom. Click Save there. Contacts save on their own.',
    },
  ],
}
