import type { HelpSection } from '../types'

export const clients: HelpSection = {
  slug: 'clients',
  title: 'Clients',
  icon: 'building',
  intro:
    'If you develop products for other companies, a client record keeps that customer’s contacts, billing and shipping details in one place and links to their projects. Clients are only available to owners and admins.',
  articles: [
    {
      slug: 'clients-list',
      title: 'The Clients page and adding a client',
      summary: 'See all your customers and add new ones.',
      blocks: [
        {
          type: 'p',
          text: 'Click [Clients](/clients) in the menu. The list shows each client, their primary contact, and how many projects they have, in alphabetical order. Once you have more than 5 clients, a search box appears that finds clients by name or by their primary contact’s name.',
        },
        {
          type: 'steps',
          items: [
            'On [Clients](/clients), click `New client`.',
            'Type the **Client name (DBA)**: the name they do business as, for example “Acme Foods”.',
            'Click `Add client`. The client’s record opens so you can fill in the rest.',
          ],
        },
        {
          type: 'tip',
          text: 'You can also add a client while creating or editing a project: in the Client list, choose **+ New client…**, type the name and click `Add`.',
        },
        {
          type: 'note',
          text: 'Each client name must be different, ignoring capital letters, so “Acme” and “ACME” count as the same name.',
        },
      ],
    },
    {
      slug: 'client-record',
      title: 'Filling in a client record',
      summary: 'Details, contacts, accounting and shipping.',
      blocks: [
        {
          type: 'p',
          text: 'Open a client from [Clients](/clients). The record has these sections:',
        },
        {
          type: 'terms',
          items: [
            { term: 'Details', text: '**Client name (DBA)**: the name they trade under, shown on projects. **Legal company name**: their registered name for billing, such as “Acme Foods, LLC” (leave it blank if it’s the same). Also **Website** and **Notes**.' },
            { term: 'Contacts', text: 'The people you work with there. See below. Contacts save immediately.' },
            { term: 'Accounting', text: '**Tax ID / EIN**, **Payment terms** (such as Net 30), **Currency**, **Invoices go to** (an email), **Purchase order required on invoices**, the **Billing address**, and **Accounting notes**.' },
            { term: 'Shipping', text: '**Ship-to address**, **Preferred carrier**, the client’s **UPS / FedEx / DHL account #**, any **Other carrier accounts**, and **Shipping notes** (dock hours, cold-chain needs and so on).' },
            { term: 'Projects', text: 'Every project linked to this client. Click one to open it.' },
          ],
        },
        {
          type: 'warning',
          text: 'Changes to Details, Accounting and Shipping are **not saved automatically**. When you change something, a bar appears at the bottom of the screen saying **Unsaved changes**. Click `Save` there (or `Discard` to undo). Leaving the page without saving loses your changes.',
        },
        {
          type: 'tip',
          text: 'If the client ships to their billing address, click **Same as billing** next to Ship-to address to copy it over, then `Save`. It’s a one-time copy: changing the billing address later doesn’t change the shipping address.',
        },
        {
          type: 'p',
          text: 'For extra carriers, click **Add carrier account**, then fill in both the carrier and the account number (or remove the row with **X**). `Save` stays greyed out while a row is half filled in.',
        },
      ],
    },
    {
      slug: 'contacts',
      title: 'Client contacts',
      summary: 'Add people, choose the main contact, edit or remove them.',
      blocks: [
        {
          type: 'steps',
          items: [
            'In the client’s **Contacts** section, click **Add contact**.',
            'Fill in **Name** (required), and optionally **Title / role**, **Email**, **Phone** and **Notes**.',
            'Tick **Primary contact** if this is the main person to talk to.',
            'Click `Save contact`.',
          ],
        },
        {
          type: 'list',
          items: [
            'The first contact you add becomes the **Primary** contact automatically. Only one contact can be primary.',
            'To make someone else primary, click the **star** on their card.',
            'To edit a contact, click the **pencil**. To remove one, click the **trash can**. Removing happens straight away, with no “are you sure?” step.',
            'Click a contact’s email or phone number to start an email or a call.',
          ],
        },
      ],
    },
    {
      slug: 'linking-projects',
      title: 'Linking projects to a client',
      summary: 'Projects are linked from the project page, not the client page.',
      blocks: [
        {
          type: 'steps',
          items: [
            'Open the project from [Projects](/projects).',
            'Click **+ Add client** (or the pencil next to the current client).',
            'Choose the client and click `Save`.',
          ],
        },
        {
          type: 'p',
          text: 'The project then appears in that client’s **Projects** section. Team members who were given access to that client can now see the project too.',
        },
      ],
    },
    {
      slug: 'rename-delete-client',
      title: 'Renaming or deleting a client',
      summary: 'Renaming updates everything automatically. Deleting needs the client to have no projects.',
      blocks: [
        {
          type: 'p',
          text: '**Renaming:** change the **Client name** and click `Save`. Benchtop updates every linked project and every teammate’s access automatically, so nobody loses access.',
        },
        { type: 'h', text: 'Deleting a client' },
        {
          type: 'steps',
          items: [
            'First move all the client’s projects to another client or to **No client**, from each project’s page. Archived projects count too.',
            'On the client record, scroll to the bottom and click `Delete client`.',
            'Click `Delete` to confirm. The client and all its contacts are permanently removed.',
          ],
        },
        {
          type: 'tip',
          text: 'Finished working with a client but want to keep their history? **Archive** them instead. See below.',
        },
      ],
    },
    {
      slug: 'archive-client',
      title: 'Archiving and unarchiving a client',
      summary: 'Put a client away with its projects and formulations, and bring back exactly what you need later.',
      blocks: [
        {
          type: 'p',
          text: 'Archiving hides a client from your client list and the project Client dropdown. Its projects and formulations are archived too. Nothing is deleted.',
        },
        {
          type: 'steps',
          items: [
            'On the client record, scroll to the bottom and click `Archive client`.',
            'The dialog shows how many projects and formulations will be archived with it.',
            'Optionally tick **ingredients** to archive too. Only ingredients this client’s formulations use are listed. Ones also used by other clients’ or projects’ formulations are greyed out with the reason.',
            'Optionally tick **suppliers** to archive too. A supplier can only be archived when every ingredient it supplies is being archived as well.',
            'Click `Archive client`.',
          ],
        },
        {
          type: 'p',
          text: 'Archived ingredients and suppliers drop out of the library, the supplier list and every picker, but formulations that use them keep working.',
        },
        { type: 'h', text: 'Unarchiving' },
        {
          type: 'steps',
          items: [
            'On [Clients](/clients), tick **Show archived** below the list and open the client.',
            'Scroll to the bottom and click `Unarchive client`.',
            'Everything archived along with the client is listed: projects, formulations, ingredients and suppliers, all ticked. Untick anything you want to leave archived.',
            'Click `Unarchive client`.',
          ],
        },
        {
          type: 'note',
          text: 'Projects you’d archived yourself before archiving the client are listed too but start unticked. Anything left archived can be restored on its own later: a project or formulation from its own page, and an ingredient or supplier from **Archived ingredients** or **Archived suppliers** under those lists.',
        },
      ],
    },
  ],
  faqs: [
    {
      q: 'Why can’t I see Clients in the menu?',
      a: 'Clients are only for owners and admins, because the records hold billing and shipping details. Ask your account owner if you need access.',
    },
    {
      q: 'Why can’t I delete a client?',
      a: 'It still has projects linked to it, including archived ones. Open each project and change its client (or choose **No client**), then try again.',
    },
    {
      q: 'I can’t add a client because the name already exists.',
      a: 'Client names must be different, ignoring capital letters. Open the existing client from [Clients](/clients) instead. If it’s archived, tick **Show archived** to find it, then unarchive it.',
    },
    {
      q: 'What’s the difference between the client name and the legal company name?',
      a: 'The **Client name (DBA)** is the name they do business as, which shows on projects. The **Legal company name** is their registered name for invoices and billing, such as “Acme Foods, LLC”. Leave it blank if they’re the same.',
    },
    {
      q: 'Does archiving a client delete anything?',
      a: 'No. The client, its projects and formulations, and any ingredients or suppliers you chose are hidden, not deleted. Unarchive the client to choose what comes back.',
    },
    {
      q: 'I made changes to a client but they disappeared.',
      a: 'Details, Accounting and Shipping only save when you click `Save` on the bar at the bottom of the screen. Contacts save on their own.',
    },
    {
      q: 'How do I set a primary contact?',
      a: 'Click the star on the contact’s card, or tick **Primary contact** when adding or editing them. Only one contact can be primary.',
    },
    {
      q: 'If I rename a client, will my teammates lose access?',
      a: 'No. Renaming updates all linked projects and teammates’ access automatically.',
    },
    {
      q: 'Where do I record payment terms or a tax ID?',
      a: 'In the client’s **Accounting** section. Remember to click `Save` at the bottom.',
    },
  ],
}
