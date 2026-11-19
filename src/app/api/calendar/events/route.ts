import { NextRequest, NextResponse } from 'next/server'
import { inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clientContacts, clients } from '@/lib/db/schema'
import { requireApi } from '@/lib/auth/context'
import { loadTimeOptions } from '@/lib/time-entries-server'
import { CalendarNotConnectedError, isGoogleCalendarConfigured, listEvents } from '@/lib/calendar/google'
import { emailDomain, toMeetings, websiteDomain } from '@/lib/calendar/events'

const MAX_SPAN_MS = 3 * 24 * 60 * 60 * 1000

// The signed-in person's meetings between `from` and `to` (ISO times; the browser sends its own
// local day), each with a guess at the client it's for among the clients they can log time against
export async function GET(req: NextRequest) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  if (!isGoogleCalendarConfigured()) return NextResponse.json({ error: 'Calendar is not available', code: 'not_configured' }, { status: 503 })

  const from = new Date(req.nextUrl.searchParams.get('from') ?? '')
  const to = new Date(req.nextUrl.searchParams.get('to') ?? '')
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || !(to > from) || to.getTime() - from.getTime() > MAX_SPAN_MS) {
    return NextResponse.json({ error: 'Give a from and to time, at most 3 days apart' }, { status: 400 })
  }

  let events
  try {
    events = await listEvents(auth.ctx.user.id, from, to)
  } catch (err) {
    if (err instanceof CalendarNotConnectedError) {
      return NextResponse.json({ error: err.message, code: 'not_connected' }, { status: 409 })
    }
    console.error('[calendar] events failed:', err)
    return NextResponse.json({ error: 'Could not read your Google Calendar. Try again in a moment.' }, { status: 502 })
  }

  // Which business email domains belong to which of the person's clients
  const { clients: mine } = await loadTimeOptions(auth.ctx)
  const ids = mine.map(c => c.id)
  const clientDomains = new Map<string, string[]>()
  if (ids.length > 0) {
    const [clientRows, contactRows] = await Promise.all([
      db.select({ id: clients.id, website: clients.website, billingEmail: clients.billingEmail })
        .from(clients).where(inArray(clients.id, ids)),
      db.select({ clientId: clientContacts.clientId, email: clientContacts.email })
        .from(clientContacts).where(inArray(clientContacts.clientId, ids)),
    ])
    const add = (domain: string | null, id: string) => {
      if (!domain) return
      const list = clientDomains.get(domain) ?? []
      if (!list.includes(id)) clientDomains.set(domain, [...list, id])
    }
    for (const c of clientRows) { add(websiteDomain(c.website), c.id); add(emailDomain(c.billingEmail), c.id) }
    for (const c of contactRows) add(emailDomain(c.email), c.clientId)
  }

  const meetings = toMeetings(events, {
    ownDomain: emailDomain(auth.ctx.user.email),
    clientDomains,
    clientNames: mine,
  })
  return NextResponse.json({ meetings })
}
