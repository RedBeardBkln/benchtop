import type { HelpSection } from '../types'

export const time: HelpSection = {
  slug: 'time',
  title: 'Billable time',
  icon: 'clock',
  intro:
    'How to turn on time tracking, log time against a client or project, run a timer, mark time as billed, and prepare a time report to send a client.',
  articles: [
    {
      slug: 'turn-on',
      title: 'Turning on time tracking',
      summary: 'Time tracking is off until you turn it on, just for you.',
      blocks: [
        {
          type: 'p',
          text: 'Not everyone bills clients for their time, so time tracking starts switched off and **Time** isn’t in the menu.',
        },
        {
          type: 'steps',
          items: [
            'Go to [Settings → Preferences](/settings/preferences).',
            'Turn on **Track billable time**. It saves straight away.',
            '**Time** now appears in the menu (on a phone, under **More**).',
          ],
        },
        {
          type: 'note',
          text: 'This setting is only for you; each teammate turns it on for themselves. Turning it off hides Time from the menu but keeps everything you logged.',
        },
      ],
    },
    {
      slug: 'log-time',
      title: 'Logging time',
      summary: 'Record time you’ve spent, with its client, project, type, task and times.',
      blocks: [
        {
          type: 'steps',
          items: [
            'Open [Time](/time) and click `Log time`.',
            'Choose the **Client**. Optionally choose one of that client’s **Projects**.',
            'Choose the **Type** of work, such as Phone call, Benchtop work, In-person meeting or Travel.',
            'Describe the **Task**. Write it for the client, because it appears on the time reports you send them.',
            'Enter the **Date**, **Start** and **End**. The **Duration** is worked out for you. You can also type a duration (1:30, 1.5 or 90m) and the end time follows.',
            'Tick **Already billed** if this time has already been on an invoice. Click `Log time`.',
          ],
        },
        {
          type: 'tip',
          text: 'An end time earlier than the start (for example 10:00 pm to 1:00 am) is read as finishing the next day.',
        },
        {
          type: 'terms',
          items: [
            { term: 'Client', text: 'Required. You can log time for the clients you have access to. Clients are added under [Clients](/clients).' },
            { term: 'Project', text: 'Optional. Only the client’s active projects are listed. Leave it empty for general work for the client.' },
            { term: 'Duration', text: 'Shown as hours and minutes (1:30). Reports show decimal hours (1.50).' },
          ],
        },
      ],
    },
    {
      slug: 'timer',
      title: 'Using the timer',
      summary: 'Start a clock when you begin and stop it when you finish.',
      blocks: [
        {
          type: 'steps',
          items: [
            'On [Time](/time), click `Start timer`.',
            'Choose the client, project (optional), type and task, then click `Start timer`.',
            'The running clock shows at the top of the Time page. Click `Stop` when you’re done and the time is logged.',
          ],
        },
        {
          type: 'note',
          text: 'You can have one timer running at a time, and an entry can be at most 24 hours long. If you forgot to stop a timer, click `Edit` on it to fix the start, or stop it and then edit the times.',
        },
      ],
    },
    {
      slug: 'billed',
      title: 'Marking time as billed',
      summary: 'Keep track of which time has been invoiced so nothing is billed twice.',
      blocks: [
        {
          type: 'list',
          items: [
            'Tick the **Billed** box on any entry on the Time page to mark it billed, or untick it to undo.',
            'To change several at once, tick the boxes on the left of the entries and click `Mark billed` or `Mark not billed`.',
            'On a time report, click `Mark entries billed` once you’ve sent it.',
            'Use the **Not billed** filter to see what’s still waiting to be invoiced.',
          ],
        },
      ],
    },
    {
      slug: 'reports',
      title: 'Preparing a time report for a client',
      summary: 'A clean report of one client’s time to save as a PDF or download as a spreadsheet.',
      blocks: [
        {
          type: 'steps',
          items: [
            'On [Time](/time), click `Prepare report`.',
            'Choose the **Client** and, if you like, one **Project**.',
            'Choose the **Period** and what to **Include**: time not yet billed (the usual choice for an invoice), all time, or only billed time.',
            'Choose whether to show start and end times. Owners and admins can also include the whole team’s time.',
            'Click `Prepare report`. To get a PDF, click `Print or save PDF` and choose **Save as PDF** as the printer. For a spreadsheet, click `Download CSV`.',
          ],
        },
        {
          type: 'p',
          text: 'The report is headed with your company name (from your [profile](/settings/profile), or the account name), your name, email and phone. It is addressed to the client’s legal name and billing address from their client record. It lists each entry’s date, type, task, times and hours, followed by the total and a summary by type. It never shows whether time was billed.',
        },
        {
          type: 'note',
          text: 'Only owners and admins can see clients’ billing details, so a report prepared by a member shows the client’s name without the address.',
        },
      ],
    },
  ],
  faqs: [
    {
      q: 'I can’t find Time in the menu.',
      a: 'Time tracking is off until you turn it on. Go to [Settings → Preferences](/settings/preferences) and turn on **Track billable time**. On a phone, Time is under **More**.',
    },
    {
      q: 'Why isn’t my client in the list?',
      a: 'Archived clients aren’t listed, and team members only see clients their project access covers. Ask an account owner or admin to add the client under [Clients](/clients) or to give you access.',
    },
    {
      q: 'Can I see my teammates’ time?',
      a: 'Owners and admins can. Use the person filter on [Time](/time) to choose **Everyone’s time** or one teammate. Members only see their own time.',
    },
    {
      q: 'Can I delete a client I’ve logged time for?',
      a: 'No. A client with logged time can’t be deleted, because that time is billing history. Archive the client instead; its time is kept and still appears on reports.',
    },
  ],
}
