import { notFound } from 'next/navigation'
import { CalendarPanel } from '@/components/settings/calendar-panel'
import { requirePage } from '@/lib/auth/context'
import { isGoogleCalendarConfigured } from '@/lib/calendar/google'

export default async function CalendarSettingsPage() {
  await requirePage({ allowUnentitled: true })
  if (!isGoogleCalendarConfigured()) notFound()
  return <CalendarPanel />
}
