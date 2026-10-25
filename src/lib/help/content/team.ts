import type { HelpSection } from '../types'

export const team: HelpSection = {
  slug: 'team',
  title: 'Team & permissions',
  icon: 'users',
  intro:
    'How to invite coworkers, what owners, admins and members can each do, how to limit a member to certain projects or clients, and how to remove someone. The Team page is for owners and admins.',
  articles: [
    {
      slug: 'roles',
      title: 'Roles: owner, admin and member',
      summary: 'Who can do what in an account.',
      blocks: [
        {
          type: 'p',
          text: 'Every person on an account has one of three roles. You can see yours on [Settings → Account](/settings/account).',
        },
        {
          type: 'terms',
          items: [
            { term: 'Owner', text: 'The person who created the account, or who it was handed to. There is exactly one. They can do everything, and they are the only one who can rename the account, subscribe or change billing, download all the data, and delete the account.' },
            { term: 'Admin', text: 'Can see and edit everything: every project, the ingredient library, suppliers, clients and the Team page. Cannot rename the account, handle billing, export data or delete the account.' },
            { term: 'Member', text: 'Sees only the projects and clients they’ve been given, and can either view or edit the ingredient library and suppliers. Members don’t see the Clients page or the Team page.' },
          ],
        },
        { type: 'h', text: 'Side-by-side' },
        {
          type: 'terms',
          items: [
            { term: 'See and edit all projects', text: 'Owner ✓ · Admin ✓ · Member only what they’re given' },
            { term: 'Ingredient library and suppliers', text: 'Owner edit · Admin edit · Member view, or edit if given' },
            { term: 'Clients page', text: 'Owner ✓ · Admin ✓ · Member ✗' },
            { term: 'Invite, change or remove people', text: 'Owner ✓ · Admin ✓ · Member ✗' },
            { term: 'Rename the account', text: 'Owner only' },
            { term: 'Subscribe, change card, cancel', text: 'Owner only' },
            { term: 'Download all data / delete account', text: 'Owner only' },
            { term: 'Own profile, password, preferences, feedback', text: 'Everyone' },
          ],
        },
        {
          type: 'note',
          text: 'Nobody can change their own role or remove themselves; another owner or admin has to do it. The owner can’t be changed or removed by anyone else, but the owner can hand the account over (see below).',
        },
        { type: 'h', text: 'Handing the account to someone else' },
        {
          type: 'steps',
          items: [
            'The owner goes to [Settings → Team](/settings/team). The person taking over must already be on the team (invite them first if not).',
            'Under **Transfer ownership**, choose them as **New owner** and click `Transfer ownership`, then confirm.',
          ],
        },
        {
          type: 'p',
          text: 'The new owner controls billing, the subscription, the data download and account deletion, and billing emails from Stripe go to them. You become an admin and keep full access to everything else. The number of billed seats doesn’t change. Only the new owner can transfer it back.',
        },
      ],
    },
    {
      slug: 'invite',
      title: 'Inviting a teammate',
      summary: 'Create an invitation link and send it to your coworker.',
      blocks: [
        {
          type: 'steps',
          items: [
            'Go to [Settings → Team](/settings/team). (Owners and admins only.)',
            'In the **Invite a teammate** card, type their **Email**.',
            'Pick a **Role**: `Member` (only the projects and clients you choose) or `Admin` (everything, including team and access).',
            'If you picked Member, choose what they can see and do. See [Choosing what a member can see](#member-access). A new member starts with **no projects** and **view-only** ingredients.',
            'Click `Create invitation`.',
            'A green box shows the invitation link. **Copy it now**: click `Copy`. The link is shown only once.',
            'Send the link to your coworker yourself, by email or chat. Benchtop does not send it for you.',
          ],
        },
        {
          type: 'p',
          text: 'The invitation then appears under **Pending invitations** with the date it expires. Links last **7 days**, work once, and only work for the email you typed.',
        },
        {
          type: 'tip',
          text: 'Lost the link, or it expired? Click `Revoke` next to the pending invitation, then create a new one.',
        },
        { type: 'h', text: 'Why an invitation might not work' },
        {
          type: 'terms',
          items: [
            { term: '“This email already has a Benchtop login”', text: 'Each email can be on only one account. Ask them for a different email address.' },
            { term: '“There is already a pending invitation for this email”', text: 'Revoke the old one first, or ask them to use the link they already have.' },
            { term: '“Your plan allows up to N additional user(s)”', text: 'Some free plans have a limit on users. Pending invitations count toward it. Revoke unused invitations or remove someone.' },
            { term: '“An active subscription is required to add team members”', text: 'The account’s trial or subscription has ended. The owner needs to subscribe first. See [Billing & plans](/help/billing).' },
          ],
        },
      ],
    },
    {
      slug: 'member-access',
      title: 'Choosing what a member can see',
      summary: 'Give a member access to all projects, one client’s projects, or just a few projects.',
      blocks: [
        {
          type: 'p',
          text: 'Admins always see everything. For a **Member**, you choose exactly what they can open and change. Each choice is `No access`, `Can view` or `Can edit`.',
        },
        {
          type: 'terms',
          items: [
            { term: 'All projects', text: 'A starting level for every project in the account, including new ones. `No access` hides them all, `Can view` lets them open everything, and `Can edit` lets them change everything.' },
            { term: 'Ingredient library & suppliers', text: '`Can view` or `Can edit`. This covers ingredients, suppliers, equipment and lab intake. Everyone can at least view, because formulations need their ingredients.' },
            { term: 'Clients', text: 'Click **+ Add a client…** to give access to every project for that client, including future ones.' },
            { term: 'Specific projects', text: 'Click **+ Add a project…** to give access to a single project. Remove a line with the **X**.' },
          ],
        },
        {
          type: 'p',
          text: '**The highest level wins.** If “All projects” is `Can view` and one client is `Can edit`, the member can edit that client’s projects and view everything else. You can’t use a lower setting to take away what “All projects” already gives.',
        },
        {
          type: 'tip',
          text: 'To limit someone to one customer’s work: make them a Member, set **All projects** to `No access`, then add that client with `Can view` or `Can edit`.',
        },
        { type: 'h', text: 'What the member experiences' },
        {
          type: 'list',
          items: [
            '**No access:** the project doesn’t appear anywhere for them.',
            '**Can view:** they can open it and see everything, with a “view only” badge, but the editing buttons are hidden.',
            '**Can edit:** they can work on it like an admin would.',
            '**Creating projects:** a member can create a new project only for a client they can edit, or (with no client) only if “All projects” is `Can edit`. Otherwise the **New project** button is hidden.',
            '**View-only library:** they see a note saying they have view-only access to the ingredient library and suppliers, and can’t add or change ingredients.',
          ],
        },
        { type: 'h', text: 'Changing someone’s access later' },
        {
          type: 'steps',
          items: [
            'Go to [Settings → Team](/settings/team).',
            'Click `Edit access` next to the person.',
            'Change their role or access settings.',
            'Click `Save`. You’ll see “Access updated”. The change takes effect right away.',
          ],
        },
      ],
    },
    {
      slug: 'remove',
      title: 'Removing someone from the team',
      summary: 'Take away a person’s access. Their work stays.',
      blocks: [
        {
          type: 'steps',
          items: [
            'Go to [Settings → Team](/settings/team).',
            'Click `Remove` next to the person.',
            'Confirm the pop-up.',
          ],
        },
        {
          type: 'p',
          text: 'Their **login is deleted** and they lose access immediately. Everything they created stays in the account. On a paid plan their seat is taken off the bill (the change is prorated on your next invoice). Because the login is deleted, the same email can be invited again later.',
        },
      ],
    },
    {
      slug: 'seats',
      title: 'How team seats are billed',
      summary: 'What extra people cost and when you start paying for them.',
      blocks: [
        {
          type: 'list',
          items: [
            'The owner is included in the plan.',
            'Each admin or member is one extra **seat**: **$10 per month** on a monthly plan, or **$100 per year** on a yearly plan.',
            'A seat is added when the person **accepts** the invitation, not when you send it, and the charge is prorated.',
            'During a free trial or free period, and on free-for-life plans, extra people are **free**. If you subscribe later, your current team is included in the subscription automatically.',
          ],
        },
        {
          type: 'p',
          text: 'The **Team seats** card on [Settings → Team](/settings/team) shows how many extra users you have and what they cost. If it says your subscription bills a different number of users than you have, click `Update billing` to fix it.',
        },
      ],
    },
  ],
  faqs: [
    {
      q: 'How do I add a coworker?',
      a: 'An owner or admin goes to [Settings → Team](/settings/team), fills in **Invite a teammate**, clicks `Create invitation`, copies the link and sends it to the coworker. See [Inviting a teammate](/help/team#invite).',
    },
    {
      q: 'My new teammate can’t see any projects. Why?',
      a: 'New members start with no project access. Click `Edit access` next to them on [Settings → Team](/settings/team) and give them “All projects”, a client, or specific projects.',
    },
    {
      q: 'I lost the invitation link I created.',
      a: 'It can’t be shown again. Click `Revoke` on the pending invitation and create a new one.',
    },
    {
      q: 'Why can’t my teammate add or edit ingredients?',
      a: 'Their **Ingredient library & suppliers** access is set to `Can view`. An owner or admin can change it to `Can edit` with `Edit access`.',
    },
    {
      q: 'What’s the difference between an admin and a member?',
      a: 'Admins see and change everything, including Clients and the Team page. Members only see what you give them. See [Roles](/help/team#roles).',
    },
    {
      q: 'What can the owner do that an admin can’t?',
      a: 'Rename the account, subscribe and manage billing, download all the data, and delete the account.',
    },
    {
      q: 'Can I limit someone to just one customer’s projects?',
      a: 'Yes. Make them a Member, set **All projects** to `No access`, and add that client under **Clients**. They’ll automatically get any new projects for that client too.',
    },
    {
      q: 'Why can’t I invite someone? It says their email already has a login.',
      a: 'Each email address can belong to only one Benchtop account. Ask them for another email, or they need to be removed from their current account first.',
    },
    {
      q: 'How much does each extra person cost?',
      a: '$10 a month on a monthly plan or $100 a year on a yearly plan. The owner is included, and extra people are free during a trial or free period.',
    },
    {
      q: 'Can I change my own role or remove myself?',
      a: 'No. Another admin or the owner has to do it.',
    },
    {
      q: 'Can I transfer ownership of the account?',
      a: 'Yes, if you’re the owner. On [Settings → Team](/settings/team), choose the new owner under **Transfer ownership** and click `Transfer ownership`. They must already be on the team. You become an admin.',
    },
    {
      q: 'What happens to someone’s work when I remove them?',
      a: 'It stays in the account. Only their login is removed.',
    },
    {
      q: 'Why can’t I see the Team tab or Clients?',
      a: 'Those are only for owners and admins. If you need access, ask your account owner.',
    },
  ],
}
