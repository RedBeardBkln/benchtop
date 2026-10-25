import type { HelpSection } from '../types'

export const suppliers: HelpSection = {
  slug: 'suppliers',
  title: 'Suppliers',
  icon: 'truck',
  intro:
    'Suppliers are the companies you buy ingredients from. Each supplier record holds their contact details, your account number and payment terms, their people, and every ingredient you get from them.',
  articles: [
    {
      slug: 'list',
      title: 'The Suppliers page',
      summary: 'Find a supplier quickly.',
      blocks: [
        {
          type: 'p',
          text: 'Click [Suppliers](/suppliers) in the menu. Suppliers are listed alphabetically with their main contact, location and number of ingredients. Use **Search suppliers, contacts, locations…** to find one by name, contact name, email or city, state or country.',
        },
      ],
    },
    {
      slug: 'add',
      title: 'Adding a supplier',
      summary: 'Create a supplier record.',
      blocks: [
        {
          type: 'steps',
          items: [
            'On [Suppliers](/suppliers), click `New supplier`.',
            'Type the **Company / vendor name** (required).',
            'Optionally fill in **Website**, **Main email**, **Main phone**, **Our account #** (your customer number with them), **Payment terms** (such as Net 30), the **Address**, a **Primary contact** and **Notes** (lead times, minimum orders and so on).',
            'Click `Add supplier`. The new record opens.',
          ],
        },
        {
          type: 'tip',
          text: 'You don’t need to type “https://” in the website; benchtop adds it. You can also create a supplier while linking one to an ingredient (**+ New supplier…** on the ingredient’s **Suppliers** tab).',
        },
      ],
    },
    {
      slug: 'record',
      title: 'Editing a supplier record',
      summary: 'Update details and save.',
      blocks: [
        {
          type: 'steps',
          items: [
            'Open the supplier from [Suppliers](/suppliers).',
            'Change any of the **Details** or **Address** fields.',
            'A bar saying **Unsaved changes** appears at the bottom of the screen. Click `Save` (or `Discard`).',
          ],
        },
        {
          type: 'warning',
          text: 'Details only save when you click `Save` on that bar. Leaving the page first loses your changes.',
        },
        {
          type: 'note',
          text: '**Renaming a supplier** also updates the **Supplier** text on every ingredient that had the old name, and tells you how many were changed.',
        },
      ],
    },
    {
      slug: 'contacts',
      title: 'Supplier contacts',
      summary: 'Sales reps, customer service, QA and anyone else you deal with.',
      blocks: [
        {
          type: 'steps',
          items: [
            'In the supplier’s **Contacts** section, click **Add contact**.',
            'Fill in the **Name** (required), and optionally **Title / role**, **Email**, **Phone** and **Notes**.',
            'Tick **Primary contact** if this is your main contact.',
            'Click `Save contact`. Contacts save straight away.',
          ],
        },
        {
          type: 'list',
          items: [
            'The first contact is automatically the primary one, and there can only be one.',
            '**Star** = make primary. **Pencil** = edit. **Trash can** = remove (no confirmation).',
          ],
        },
      ],
    },
    {
      slug: 'ingredients',
      title: 'A supplier’s ingredients and prices',
      summary: 'How ingredients get listed on a supplier.',
      blocks: [
        {
          type: 'p',
          text: 'The **Ingredients** section lists every ingredient you get from this supplier, with brand, item code, pack size and cost. An ingredient appears here in two ways:',
        },
        {
          type: 'list',
          items: [
            'It’s **linked** to this supplier on the ingredient’s **Suppliers** tab (with pack size and price). A star means preferred.',
            'Its **Supplier** text box matches this supplier’s name. These show a grey **Named** badge because they have no pack size or price.',
          ],
        },
        {
          type: 'p',
          text: 'Prices are added and changed on the ingredient, not here. See [Linking suppliers and prices](/help/ingredients#suppliers-tab).',
        },
      ],
    },
    {
      slug: 'delete',
      title: 'Deleting a supplier',
      summary: 'Remove a supplier you no longer use.',
      blocks: [
        {
          type: 'steps',
          items: [
            'First remove the supplier from each linked ingredient’s **Suppliers** tab.',
            'Open the supplier, scroll to the bottom, and click `Delete supplier`.',
            'Click `Delete` to confirm. The supplier and its contacts are permanently removed.',
          ],
        },
        {
          type: 'note',
          text: 'Ingredients that only mention the supplier in their **Supplier** text don’t stop you deleting it, and their text isn’t changed.',
        },
        { type: 'h', text: 'Archived suppliers' },
        {
          type: 'p',
          text: 'When you archive a client you can archive suppliers whose ingredients are all being archived with it (see [Archiving a client](/help/clients#archive-client)). Archived suppliers are hidden from the supplier list and pickers; their links and prices stay. To bring one back, click **Archived suppliers** under the list and click `Restore`, or open the supplier and click `Restore` on the banner.',
        },
        {
          type: 'note',
          text: 'You can’t add a new supplier with the same name as an archived one. Restore the archived supplier instead.',
        },
      ],
    },
  ],
  faqs: [
    {
      q: 'Why can’t I delete a supplier?',
      a: 'It’s still linked to ingredients. Open each ingredient listed on the supplier page, go to its **Suppliers** tab, remove the link, then try again.',
    },
    {
      q: 'How do I record a supplier’s price for an ingredient?',
      a: 'On the ingredient’s **Suppliers** tab, link the supplier and enter the pack size, unit and cost per unit. See [Linking suppliers and prices](/help/ingredients#suppliers-tab).',
    },
    {
      q: 'What does the grey “Named” badge mean?',
      a: 'That ingredient mentions this supplier in its **Supplier** text box but isn’t linked with a price or pack size.',
    },
    {
      q: 'If I rename a supplier, do my ingredients update?',
      a: 'Yes. Ingredients whose Supplier text had the old name are changed to the new name automatically.',
    },
    {
      q: 'I edited a supplier and my changes disappeared.',
      a: 'Supplier details only save when you click `Save` on the **Unsaved changes** bar at the bottom of the screen. Contacts save on their own.',
    },
    {
      q: 'Why can’t I add or edit suppliers?',
      a: 'Your **Ingredient library & suppliers** access is view-only. Ask an owner or admin to change it to `Can edit`.',
    },
    {
      q: 'Can two suppliers have the same name?',
      a: 'No. benchtop tells you when a supplier with that name already exists (capital letters and spaces at the ends don’t count as a difference). Open the existing supplier instead, or add something to tell them apart, such as the country.',
    },
  ],
}
