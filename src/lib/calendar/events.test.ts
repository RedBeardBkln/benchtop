import { describe, expect, it } from 'vitest'
import { emailDomain, suggestClient, toMeetings, websiteDomain, type GoogleEvent } from './events'

const ev = (over: Partial<GoogleEvent> = {}): GoogleEvent => ({
  id: 'e1',
  summary: 'Weekly sync',
  start: { dateTime: '2026-11-19T09:00:00-07:00' },
  end: { dateTime: '2026-11-19T09:30:00-07:00' },
  ...over,
})

const opts = {
  ownDomain: 'benchtop.solutions',
  clientDomains: new Map([['acme.com', ['c-acme']], ['shared.com', ['c-a', 'c-b']]]),
  clientNames: [{ id: 'c-acme', name: 'Acme Foods' }, { id: 'c-zen', name: 'Zen Bars' }, { id: 'c-xy', name: 'XY' }],
}

describe('domains', () => {
  it('reads email and website domains', () => {
    expect(emailDomain('Jo@Acme.com ')).toBe('acme.com')
    expect(emailDomain('nope')).toBeNull()
    expect(websiteDomain('https://www.acme.com/about')).toBe('acme.com')
    expect(websiteDomain('acme.com')).toBe('acme.com')
    expect(websiteDomain('')).toBeNull()
  })
})

describe('toMeetings', () => {
  it('keeps timed events and converts to ISO', () => {
    const [m] = toMeetings([ev()], opts)
    expect(m).toMatchObject({ id: 'e1', title: 'Weekly sync', start: '2026-11-19T16:00:00.000Z', end: '2026-11-19T16:30:00.000Z' })
  })

  it('leaves out all-day, canceled, declined and out-of-office events', () => {
    const events = [
      ev({ id: 'allday', start: { date: '2026-11-19' }, end: { date: '2026-11-20' } }),
      ev({ id: 'cancelled', status: 'cancelled' }),
      ev({ id: 'declined', attendees: [{ email: 'me@benchtop.solutions', self: true, responseStatus: 'declined' }] }),
      ev({ id: 'ooo', eventType: 'outOfOffice' }),
      ev({ id: 'ok' }),
    ]
    expect(toMeetings(events, opts).map(m => m.id)).toEqual(['ok'])
  })

  it('guesses the type from a call link or a place', () => {
    expect(toMeetings([ev({ hangoutLink: 'https://meet.google.com/x' })], opts)[0].activity).toBe('video')
    expect(toMeetings([ev({ location: 'Lab 2' })], opts)[0].activity).toBe('meeting')
    expect(toMeetings([ev()], opts)[0].activity).toBeNull()
  })

  it('collects other attendees’ business domains only', () => {
    const [m] = toMeetings([ev({
      attendees: [
        { email: 'me@benchtop.solutions', self: true },
        { email: 'colleague@benchtop.solutions' },
        { email: 'jo@acme.com' },
        { email: 'pat@gmail.com' },
        { email: 'room@resource.calendar.google.com', resource: true },
      ],
    })], opts)
    expect(m.domains).toEqual(['acme.com'])
    expect(m.suggestedClientId).toBe('c-acme')
  })

  it('sorts by start time', () => {
    const later = ev({ id: 'later', start: { dateTime: '2026-11-19T15:00:00Z' }, end: { dateTime: '2026-11-19T16:00:00Z' } })
    const early = ev({ id: 'early', start: { dateTime: '2026-11-19T08:00:00Z' }, end: { dateTime: '2026-11-19T08:15:00Z' } })
    expect(toMeetings([later, early], opts).map(m => m.id)).toEqual(['early', 'later'])
  })
})

describe('suggestClient', () => {
  const { clientDomains, clientNames } = opts
  it('prefers a single domain match', () => {
    expect(suggestClient('Zen Bars review', ['acme.com'], clientDomains, clientNames)).toBe('c-acme')
  })
  it('gives up when a domain fits several clients', () => {
    expect(suggestClient('Acme Foods', ['shared.com'], clientDomains, clientNames)).toBeNull()
  })
  it('falls back to a whole-word name in the title', () => {
    expect(suggestClient('Call: Zen Bars – flavors', [], clientDomains, clientNames)).toBe('c-zen')
    expect(suggestClient('Zen Barsoom', [], clientDomains, clientNames)).toBeNull()
    expect(suggestClient('XY call', [], clientDomains, clientNames)).toBeNull() // too short to trust
  })
})
