import type { Tour } from './types'

export const timeTour: Tour = {
  id: 'time-v1',
  paths: ['/time'],
  steps: [
    {
      target: 'time-timer',
      title: 'Start a timer',
      body: 'Starting work for a client? Start a timer, then stop it when you finish and the time is logged for you.',
    },
    {
      target: 'time-log',
      title: 'Log time after',
      body: 'Forgot the timer? Enter time you’ve already spent with its start and end. Write the task for the client, since it appears on their report.',
    },
    {
      target: 'time-filters',
      title: 'Narrow it down',
      body: 'Filter by client, project, period and billed status to find exactly the time you’re looking for.',
    },
    {
      target: 'time-totals',
      title: 'Your totals',
      body: 'See the total and the not-yet-billed time for whatever the filters show, at a glance.',
    },
    {
      target: 'time-entries',
      title: 'Your logged time',
      body: 'Each entry is listed here. Tick Billed once time has been on an invoice so it’s never billed twice, or select several to mark them at once.',
    },
    {
      target: 'time-report',
      title: 'Report to a client',
      body: 'Prepare a clean report of one client’s time to save as a PDF or download as a spreadsheet.',
    },
  ],
}
