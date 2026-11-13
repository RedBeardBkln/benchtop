import type { Tour } from './types'

export const timeReportTour: Tour = {
  id: 'time-report-v1',
  paths: ['/time/report'],
  steps: [
    {
      target: 'timereport-header',
      title: 'Your time report',
      body: 'This is the page your client sees. It’s headed with your company name, logo and contact details from your profile.',
    },
    {
      target: 'timereport-client',
      title: 'Addressed to the client',
      body: 'The report uses the client’s legal name and billing address from their client record, followed by every entry and the total hours.',
    },
    {
      target: 'timereport-print',
      title: 'Save it as a PDF',
      body: 'Click here and choose “Save as PDF” as the printer to get a file to send. These buttons don’t print.',
    },
    {
      target: 'timereport-csv',
      title: 'Or as a spreadsheet',
      body: 'Download the same entries as a CSV that opens in Excel, Numbers or Google Sheets.',
    },
    {
      target: 'timereport-mark-billed',
      title: 'Mark it billed',
      body: 'Once you’ve sent the report or invoiced the time, mark it billed so it isn’t billed again. Billed status never shows on the report.',
    },
  ],
}
