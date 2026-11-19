import type { TimeActivity } from '@/lib/time-tracking'

// Turns Google Calendar events into meetings the time log can offer, and guesses which client
// each one is for. Pure functions, no I/O (see lib/calendar/google.ts for the API calls).

/** The parts of a Google Calendar event we read */
export type GoogleEvent = {
  id?: string
  status?: string
  summary?: string
  location?: string
  hangoutLink?: string
  conferenceData?: { entryPoints?: { entryPointType?: string }[] }
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  transparency?: string
  eventType?: string
  attendees?: { email?: string; self?: boolean; responseStatus?: string; resource?: boolean }[]
}

export type CalendarMeeting = {
  id: string
  title: string
  start: string // ISO
  end: string // ISO
  location: string | null
  /** A best guess at the time-log type: video if it has a call link, in person if it has a place */
  activity: TimeActivity | null
  /** Email domains of the other people invited (not you, not rooms) */
  domains: string[]
  /** A client the meeting seems to be for, when exactly one matches */
  suggestedClientId: string | null
}

// Shared mail services: a gmail.com attendee says nothing about which client it is
const PUBLIC_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'yahoo.com', 'icloud.com',
  'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'zoho.com', 'comcast.net',
  'calendar.google.com', 'resource.calendar.google.com', 'group.calendar.google.com',
])

export function emailDomain(email: string | null | undefined): string | null {
  const at = email?.trim().toLowerCase().split('@')
  return at && at.length === 2 && at[1].includes('.') ? at[1] : null
}

/** "https://www.acme.com/about" → "acme.com" */
export function websiteDomain(url: string | null | undefined): string | null {
  const raw = url?.trim().toLowerCase()
  if (!raw) return null
  try {
    const host = new URL(/^[a-z]+:\/\//.test(raw) ? raw : `https://${raw}`).hostname
    return host.replace(/^www\./, '') || null
  } catch {
    return null
  }
}

/** Timed events you haven't declined; all-day events, canceled ones and out-of-office blocks are left out */
export function toMeetings(
  events: GoogleEvent[],
  opts: { ownDomain: string | null; clientDomains: Map<string, string[]>; clientNames: { id: string; name: string }[] },
): CalendarMeeting[] {
  const out: CalendarMeeting[] = []
  for (const e of events) {
    if (!e.id || e.status === 'cancelled' || !e.start?.dateTime || !e.end?.dateTime) continue
    if (e.eventType && e.eventType !== 'default') continue // out of office, focus time, working location
    const attendees = e.attendees ?? []
    if (attendees.some(a => a.self && a.responseStatus === 'declined')) continue
    const start = new Date(e.start.dateTime)
    const end = new Date(e.end.dateTime)
    if (!(end > start)) continue

    const domains = [...new Set(
      attendees
        .filter(a => !a.self && !a.resource)
        .map(a => emailDomain(a.email))
        .filter((d): d is string => !!d && !PUBLIC_DOMAINS.has(d) && d !== opts.ownDomain),
    )]
    const title = e.summary?.trim() || '(No title)'
    const hasCall = !!e.hangoutLink || !!e.conferenceData?.entryPoints?.some(p => p.entryPointType === 'video')
    out.push({
      id: e.id,
      title,
      start: start.toISOString(),
      end: end.toISOString(),
      location: e.location?.trim() || null,
      activity: hasCall ? 'video' : e.location?.trim() ? 'meeting' : null,
      domains,
      suggestedClientId: suggestClient(title, domains, opts.clientDomains, opts.clientNames),
    })
  }
  return out.sort((a, b) => a.start.localeCompare(b.start))
}

/**
 * The client a meeting is for: the one whose website, billing email or contacts share an
 * attendee's email domain, or failing that the one named in the title. Null unless exactly one fits.
 */
export function suggestClient(
  title: string,
  domains: string[],
  clientDomains: Map<string, string[]>,
  clientNames: { id: string; name: string }[],
): string | null {
  const byDomain = new Set(domains.flatMap(d => clientDomains.get(d) ?? []))
  if (byDomain.size === 1) return [...byDomain][0]
  if (byDomain.size > 1) return null
  const t = ` ${title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')} `
  const byName = clientNames.filter(c => {
    const n = c.name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    return n.length >= 3 && t.includes(` ${n} `)
  })
  return byName.length === 1 ? byName[0].id : null
}
