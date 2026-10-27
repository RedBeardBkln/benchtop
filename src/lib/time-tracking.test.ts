import { describe, expect, it } from 'vitest'
import {
  activityLabel, checkEntryTimes, combineLocal, durationMinutes, endFromClock, formatDuration, formatHours,
  parseDuration, parseTimeFilter, periodRange, splitLocal, summarizeEntries, timeEntriesCsv, timeEntryFieldsSchema,
  type ReportEntry,
} from './time-tracking'

const CLIENT = '11111111-1111-4111-8111-111111111111'

describe('durations', () => {
  it('formats minutes as h:mm and decimal hours', () => {
    expect(formatDuration(95)).toBe('1:35')
    expect(formatDuration(5)).toBe('0:05')
    expect(formatHours(95)).toBe('1.58')
    expect(formatHours(90)).toBe('1.50')
  })

  it('measures whole minutes between two times', () => {
    expect(durationMinutes('2026-10-27T09:00:00Z', '2026-10-27T10:30:29Z')).toBe(90)
    expect(durationMinutes('2026-10-27T10:00:00Z', '2026-10-27T09:00:00Z')).toBe(0)
  })

  it.each([
    ['1:30', 90], ['0:05', 5], ['1.5', 90], ['2', 120], ['.25', 15], ['1.5h', 90], ['2 hours', 120],
    ['90m', 90], ['45 min', 45], ['1h 30m', 90], ['1h30', 90], [' 1H 5M ', 65],
  ])('reads %j as %i minutes', (text, minutes) => {
    expect(parseDuration(text)).toBe(minutes)
  })

  it.each(['', 'abc', '1:75', '1:5', '-1', '1h-30m'])('rejects %j', text => {
    expect(parseDuration(text)).toBeNull()
  })
})

describe('entry times', () => {
  const start = new Date('2026-10-27T09:00:00Z')
  it('accepts a running timer and a normal span', () => {
    expect(checkEntryTimes(start, null)).toBeNull()
    expect(checkEntryTimes(start, new Date('2026-10-27T17:00:00Z'))).toBeNull()
  })
  it('rejects an end at or before the start, and spans over 24 hours', () => {
    expect(checkEntryTimes(start, start)).toMatch(/after the start/)
    expect(checkEntryTimes(start, new Date('2026-10-28T09:01:00Z'))).toMatch(/24 hours/)
  })
})

describe('local date and time fields', () => {
  it('round-trips a local date and time', () => {
    const d = combineLocal('2026-10-27', '14:05')!
    expect(splitLocal(d)).toEqual({ date: '2026-10-27', time: '14:05' })
    expect(combineLocal('2026-10-27', '')).toBeNull()
    expect(combineLocal('', '14:05')).toBeNull()
  })

  it('puts an end clock time at or before the start on the next day', () => {
    const start = combineLocal('2026-10-27', '22:30')!
    expect(splitLocal(endFromClock(start, '23:15')!)).toEqual({ date: '2026-10-27', time: '23:15' })
    expect(splitLocal(endFromClock(start, '01:00')!)).toEqual({ date: '2026-10-28', time: '01:00' })
  })
})

describe('entry validation', () => {
  const base = {
    clientId: CLIENT, activity: 'phone', task: 'Call about the shelf-life test',
    startedAt: '2026-10-27T09:00:00.000Z', endedAt: '2026-10-27T09:30:00.000Z',
  }
  it('accepts a complete entry, with or without a project', () => {
    expect(timeEntryFieldsSchema.safeParse(base).success).toBe(true)
    expect(timeEntryFieldsSchema.safeParse({ ...base, projectId: null, endedAt: null }).success).toBe(true)
  })
  it('requires a client, a known type and a task', () => {
    expect(timeEntryFieldsSchema.safeParse({ ...base, clientId: undefined }).success).toBe(false)
    expect(timeEntryFieldsSchema.safeParse({ ...base, activity: 'golf' }).success).toBe(false)
    expect(timeEntryFieldsSchema.safeParse({ ...base, task: '   ' }).success).toBe(false)
  })
  it('reads list filters from the query string', () => {
    expect(parseTimeFilter(new URLSearchParams(`client=${CLIENT}&billed=unbilled&user=me`)).data)
      .toEqual({ client: CLIENT, billed: 'unbilled', user: 'me' })
    expect(parseTimeFilter(new URLSearchParams('billed=maybe')).success).toBe(false)
  })
})

describe('report totals and CSV', () => {
  const entries: ReportEntry[] = [
    { startedAt: '2026-10-02T15:00:00Z', endedAt: '2026-10-02T16:30:00Z', activity: 'travel', task: 'Drive to plant', projectName: null, userName: 'Sam', billed: true },
    { startedAt: '2026-10-01T15:00:00Z', endedAt: '2026-10-01T15:45:00Z', activity: 'phone', task: '=SUM(A1), "quoted"', projectName: 'Protein bar', userName: 'Sam', billed: false },
    { startedAt: '2026-10-03T15:00:00Z', endedAt: null, activity: 'phone', task: 'Still running', projectName: null, userName: 'Sam', billed: false },
  ]

  it('totals finished entries by type, in the type list order', () => {
    const s = summarizeEntries(entries)
    expect(s.totalMinutes).toBe(135)
    expect(s.unbilledMinutes).toBe(45)
    expect(s.byActivity).toEqual([
      { key: 'phone', label: 'Phone call', minutes: 45 },
      { key: 'travel', label: 'Travel', minutes: 90 },
    ])
  })

  it('writes finished entries oldest first, quoting and defusing formulas', () => {
    const lines = timeEntriesCsv(entries, { clientName: 'Acme, Inc.', includePerson: false }).trim().split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('Date,Client,Project,Type,Task,Start,End,Duration (h:mm),Hours,Billed')
    expect(lines[1]).toContain(`"Acme, Inc.",Protein bar,Phone call,"'=SUM(A1), ""quoted"""`)
    expect(lines[1]).toMatch(/,0:45,0\.75,No$/)
    expect(lines[2]).toMatch(/,Travel,Drive to plant,.*,1:30,1\.50,Yes$/)
  })

  it('adds a Person column when asked', () => {
    const [header, first] = timeEntriesCsv(entries, { clientName: 'Acme', includePerson: true }).split('\r\n')
    expect(header.startsWith('Date,Person,Client')).toBe(true)
    expect(first.split(',')[1]).toBe('Sam')
  })

  it('labels unknown types by their key', () => {
    expect(activityLabel('meeting')).toBe('In-person meeting')
    expect(activityLabel('legacy')).toBe('legacy')
  })
})

describe('period presets', () => {
  const tue = new Date(2026, 9, 27) // Tuesday 27 Oct 2026
  it('runs weeks Monday to Sunday', () => {
    expect(periodRange('this-week', tue)).toEqual({ from: '2026-10-26', to: '2026-11-01' })
    expect(periodRange('last-week', tue)).toEqual({ from: '2026-10-19', to: '2026-10-25' })
    expect(periodRange('this-week', new Date(2026, 10, 1))).toEqual({ from: '2026-10-26', to: '2026-11-01' })
  })
  it('handles months across a year end, and all time', () => {
    expect(periodRange('this-month', tue)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(periodRange('last-month', new Date(2027, 0, 15))).toEqual({ from: '2026-12-01', to: '2026-12-31' })
    expect(periodRange('this-year', tue)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
    expect(periodRange('all', tue)).toBeNull()
  })
})
