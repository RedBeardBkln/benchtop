import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { timeEntries } from '@/lib/db/schema'
import { checkEntryTimes, parseTimeFilter, timeEntryFieldsSchema } from '@/lib/time-tracking'
import {
  checkClientAndProject, isRunningTimerConflict, loadTimeEntries, loadTimeOptions, runningTimerResponse,
} from '@/lib/time-entries-server'

// Billable time. GET lists the caller's entries (owners and admins: anyone's) matching the filters
// in the query string; POST logs an entry, or starts a timer when there's no end time.

export async function GET(req: NextRequest) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res

  const filter = parseTimeFilter(req.nextUrl.searchParams)
  if (!filter.success) return NextResponse.json({ error: 'Invalid filter' }, { status: 400 })
  return NextResponse.json(await loadTimeEntries(auth.ctx, filter.data))
}

export async function POST(req: NextRequest) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = timeEntryFieldsSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid time entry' }, { status: 400 })
  }
  const d = parsed.data
  const startedAt = new Date(d.startedAt)
  const endedAt = d.endedAt ? new Date(d.endedAt) : null
  const timeError = checkEntryTimes(startedAt, endedAt)
  if (timeError) return NextResponse.json({ error: timeError }, { status: 400 })

  const projectId = d.projectId ?? null
  const bad = checkClientAndProject(await loadTimeOptions(ctx), d.clientId, projectId)
  if (bad) return bad

  try {
    const [row] = await db
      .insert(timeEntries)
      .values({
        accountId: ctx.account.id,
        userId: ctx.user.id,
        clientId: d.clientId,
        projectId,
        activity: d.activity,
        task: d.task,
        startedAt,
        endedAt,
        billed: d.billed ?? false,
        billedAt: d.billed ? new Date() : null,
      })
      .returning({ id: timeEntries.id })
    return NextResponse.json(row, { status: 201 })
  } catch (err) {
    if (isRunningTimerConflict(err)) return runningTimerResponse()
    throw err
  }
}
