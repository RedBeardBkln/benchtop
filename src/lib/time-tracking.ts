import { z } from 'zod'

// Billable time: entries logged against a client (and optionally one of its projects), and the
// client-facing time report built from them. Pure rules only, so they run in the browser and in tests.
// An entry with no end time is a running timer.

export const TIME_ACTIVITIES = [
  { key: 'benchtop', label: 'Benchtop work' },
  { key: 'phone', label: 'Phone call' },
  { key: 'video', label: 'Video call' },
  { key: 'meeting', label: 'In-person meeting' },
  { key: 'email', label: 'Email & correspondence' },
  { key: 'research', label: 'Research' },
  { key: 'documents', label: 'Documents & reports' },
  { key: 'travel', label: 'Travel' },
  { key: 'other', label: 'Other' },
] as const
export type TimeActivity = (typeof TIME_ACTIVITIES)[number]['key']
const ACTIVITY_KEYS = TIME_ACTIVITIES.map(a => a.key) as [TimeActivity, ...TimeActivity[]]

export function activityLabel(key: string): string {
  return TIME_ACTIVITIES.find(a => a.key === key)?.label ?? key
}

/** Longest single entry; anything longer is almost certainly a typo or a forgotten timer */
export const MAX_ENTRY_HOURS = 24
export const MAX_TASK_LENGTH = 2000
/** Most entries one list, report or bulk change handles */
export const MAX_ENTRIES = 2000

const iso = z.iso.datetime({ offset: true })

export const timeEntryFieldsSchema = z.object({
  clientId: z.uuid(),
  projectId: z.uuid().nullable().optional(),
  activity: z.enum(ACTIVITY_KEYS),
  task: z.string().trim().min(1, 'Describe the task').max(MAX_TASK_LENGTH),
  startedAt: iso,
  /** null = timer still running */
  endedAt: iso.nullable().optional(),
  billed: z.boolean().optional(),
})
export type TimeEntryFields = z.infer<typeof timeEntryFieldsSchema>
export const timeEntryPatchSchema = timeEntryFieldsSchema.partial()

/** Problem with an entry's times, or null when they're fine */
export function checkEntryTimes(startedAt: Date, endedAt: Date | null): string | null {
  if (!endedAt) return null
  const ms = endedAt.getTime() - startedAt.getTime()
  if (ms <= 0) return 'The end must be after the start'
  if (ms > MAX_ENTRY_HOURS * 3_600_000) return `An entry can be at most ${MAX_ENTRY_HOURS} hours`
  return null
}

export const billedUpdateSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(MAX_ENTRIES),
  billed: z.boolean(),
})

export const BILLED_FILTERS = ['all', 'unbilled', 'billed'] as const
export type BilledFilter = (typeof BILLED_FILTERS)[number]

/** List and report filters, as query-string values. `user`: 'me', 'all' (owners and admins) or a user id */
export const timeFilterSchema = z.object({
  client: z.uuid().optional(),
  project: z.uuid().optional(),
  from: iso.optional(),
  to: iso.optional(),
  billed: z.enum(BILLED_FILTERS).optional(),
  user: z.union([z.literal('me'), z.literal('all'), z.uuid()]).optional(),
  /** '1' = only running timers */
  running: z.literal('1').optional(),
})
export type TimeFilter = z.infer<typeof timeFilterSchema>

export function parseTimeFilter(params: URLSearchParams) {
  const raw: Record<string, string> = {}
  for (const key of ['client', 'project', 'from', 'to', 'billed', 'user', 'running']) {
    const v = params.get(key)
    if (v) raw[key] = v
  }
  return timeFilterSchema.safeParse(raw)
}

// ---- Durations ----

export function durationMinutes(startedAt: Date | string, endedAt: Date | string): number {
  return Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60_000))
}

/** 95 -> "1:35" */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

/** 95 -> "1.58" (decimal hours, as billed) */
export function formatHours(minutes: number): string {
  return (Math.max(0, minutes) / 60).toFixed(2)
}

const HOURS = '(?:h|hr|hrs|hours?)'
const MINS = '(?:m|min|mins|minutes?)'

/** Reads "1:30", "1.5" or "2" (hours), "1.5h", "90m" or "1h 30m" into minutes; null if unreadable */
export function parseDuration(text: string): number | null {
  const s = text.trim().toLowerCase().replace(/\s+/g, ' ')
  let m: RegExpMatchArray | null
  if ((m = s.match(/^(\d+):([0-5]\d)$/))) return Number(m[1]) * 60 + Number(m[2])
  if ((m = s.match(new RegExp(`^(\\d+(?:\\.\\d+)?|\\.\\d+) ?${HOURS}?$`)))) return Math.round(Number(m[1]) * 60)
  if ((m = s.match(new RegExp(`^(\\d+) ?${MINS}$`)))) return Number(m[1])
  if ((m = s.match(new RegExp(`^(\\d+) ?${HOURS} ?(\\d+) ?${MINS}?$`)))) return Number(m[1]) * 60 + Number(m[2])
  return null
}

// ---- Local date and time fields (the entry form works in the browser's time zone) ----

const pad = (n: number) => String(n).padStart(2, '0')

/** Date -> { date: "yyyy-MM-dd", time: "HH:mm" } in local time */
export function splitLocal(d: Date): { date: string; time: string } {
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

/** "yyyy-MM-dd" + "HH:mm" in local time -> Date; null if either is missing or invalid */
export function combineLocal(date: string, time: string): Date | null {
  const dm = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const tm = time.match(/^(\d{1,2}):(\d{2})$/)
  if (!dm || !tm) return null
  const d = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(tm[1]), Number(tm[2]))
  return Number.isNaN(d.getTime()) ? null : d
}

/** End from a start date/time and an end clock time; an end at or before the start means the next day */
export function endFromClock(start: Date, endTime: string): Date | null {
  const end = combineLocal(splitLocal(start).date, endTime)
  if (!end) return null
  if (end.getTime() <= start.getTime()) end.setDate(end.getDate() + 1)
  return end
}

/** Midnight at the start of a local "yyyy-MM-dd" day, and midnight at the start of the next one */
export function localDayStart(date: string): Date | null {
  return combineLocal(date, '00:00')
}
export function localDayEnd(date: string): Date | null {
  const d = combineLocal(date, '00:00')
  if (d) d.setDate(d.getDate() + 1)
  return d
}

export const PERIODS = [
  { key: 'this-week', label: 'This week' },
  { key: 'last-week', label: 'Last week' },
  { key: 'this-month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
  { key: 'this-year', label: 'This year' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom dates' },
] as const
export type Period = (typeof PERIODS)[number]['key']

/** First and last day ("yyyy-MM-dd", inclusive) of a preset period around `today`; weeks start on Monday. null = no limit */
export function periodRange(period: Exclude<Period, 'custom'>, today = new Date()): { from: string; to: string } | null {
  const y = today.getFullYear()
  const m = today.getMonth()
  const day = (yy: number, mm: number, dd: number) => splitLocal(new Date(yy, mm, dd)).date
  const monday = today.getDate() - ((today.getDay() + 6) % 7)
  switch (period) {
    case 'this-week': return { from: day(y, m, monday), to: day(y, m, monday + 6) }
    case 'last-week': return { from: day(y, m, monday - 7), to: day(y, m, monday - 1) }
    case 'this-month': return { from: day(y, m, 1), to: day(y, m + 1, 0) }
    case 'last-month': return { from: day(y, m - 1, 1), to: day(y, m, 0) }
    case 'this-year': return { from: day(y, 0, 1), to: day(y, 11, 31) }
    case 'all': return null
  }
}

// ---- Totals and the report ----

export type ReportEntry = {
  startedAt: string
  endedAt: string | null
  activity: string
  task: string
  projectName: string | null
  userName: string
  billed: boolean
}

/** Finished entries only: a running timer has no duration to bill yet */
export function summarizeEntries(entries: ReportEntry[]) {
  const byActivity = new Map<string, number>()
  let total = 0
  let unbilled = 0
  for (const e of entries) {
    if (!e.endedAt) continue
    const min = durationMinutes(e.startedAt, e.endedAt)
    total += min
    if (!e.billed) unbilled += min
    byActivity.set(e.activity, (byActivity.get(e.activity) ?? 0) + min)
  }
  // In the order of the type list
  const rank = (k: string) => {
    const i = ACTIVITY_KEYS.indexOf(k as TimeActivity)
    return i < 0 ? ACTIVITY_KEYS.length : i
  }
  return {
    totalMinutes: total,
    unbilledMinutes: unbilled,
    byActivity: [...byActivity]
      .sort(([a], [b]) => rank(a) - rank(b))
      .map(([key, minutes]) => ({ key, label: activityLabel(key), minutes })),
  }
}

/** Spreadsheet cells starting with these run as formulas in Excel; prefix them so they stay text */
const FORMULA_START = /^[=+\-@\t\r]/

function csvCell(v: string | number): string {
  let s = String(v)
  if (typeof v === 'string' && FORMULA_START.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV of finished entries, oldest first, times in the given (browser) time zone */
export function timeEntriesCsv(entries: ReportEntry[], opts: { clientName: string; includePerson: boolean }): string {
  const header = ['Date', 'Client', 'Project', 'Type', 'Task', 'Start', 'End', 'Duration (h:mm)', 'Hours', 'Billed']
  if (opts.includePerson) header.splice(1, 0, 'Person')
  const rows = entries
    .filter(e => e.endedAt)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map(e => {
      const start = new Date(e.startedAt)
      const end = new Date(e.endedAt!)
      const min = durationMinutes(start, end)
      const row: (string | number)[] = [
        splitLocal(start).date, opts.clientName, e.projectName ?? '', activityLabel(e.activity), e.task,
        splitLocal(start).time, splitLocal(end).time, formatDuration(min), formatHours(min), e.billed ? 'Yes' : 'No',
      ]
      if (opts.includePerson) row.splice(1, 0, e.userName)
      return row
    })
  return [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
