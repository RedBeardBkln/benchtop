import { NextRequest, NextResponse } from 'next/server'
import { requireConnection } from '@/lib/invoicing-connection-server'
import { activityLabel, durationMinutes, parseTimeFilter } from '@/lib/time-tracking'
import { loadTimeEntries } from '@/lib/time-entries-server'

// Invoicing connection: the connected person's finished, unbilled time for one client (optionally
// within from/to, ISO times on the start), oldest first. The person's own view, so a member gets
// only their own entries.
export async function GET(req: NextRequest) {
  const auth = await requireConnection(req)
  if (!auth.ok) return auth.res

  const filter = parseTimeFilter(req.nextUrl.searchParams)
  if (!filter.success || !filter.data.client) return NextResponse.json({ error: 'Choose a client' }, { status: 400 })

  const { client, from, to } = filter.data
  const { entries, truncated } = await loadTimeEntries(auth.ctx, { client, from, to, billed: 'unbilled' })
  return NextResponse.json({
    entries: entries
      .filter(e => e.endedAt)
      .reverse()
      .map(e => ({
        id: e.id,
        startedAt: e.startedAt,
        endedAt: e.endedAt,
        minutes: durationMinutes(e.startedAt, e.endedAt!),
        activity: activityLabel(e.activity),
        task: e.task,
        projectName: e.projectName,
        person: e.userName,
      })),
    truncated,
  })
}
