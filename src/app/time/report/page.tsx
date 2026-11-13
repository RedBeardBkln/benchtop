import { Suspense } from 'react'
import { requirePage } from '@/lib/auth/context'
import { TimeReportView } from '@/components/time/time-report-view'
import { PageTour } from '@/components/tour/page-tour'

// The client-facing time report, laid out for printing or saving as a PDF. Its filters come in the
// query string from the Prepare report dialog on /time.
export default async function TimeReportPage() {
  await requirePage()
  return (
    <Suspense>
      <TimeReportView />
      {/* No AppShell on this print layout, so the tour is mounted here (it hides itself when printing) */}
      <PageTour />
    </Suspense>
  )
}
