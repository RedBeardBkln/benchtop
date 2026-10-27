import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { timeEntries } from '@/lib/db/schema'
import { checkEntryTimes, timeEntryPatchSchema } from '@/lib/time-tracking'
import {
  checkClientAndProject, isRunningTimerConflict, loadEntryForEdit, loadTimeOptions, runningTimerResponse,
} from '@/lib/time-entries-server'

type Ctx = { params: Promise<{ id: string }> }

// Changes one entry (stopping a timer is a PATCH with endedAt). Your own entries; owners and admins: anyone's.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const loaded = await loadEntryForEdit(ctx, (await params).id)
  if (!loaded.ok) return loaded.res
  const { entry } = loaded

  const parsed = timeEntryPatchSchema.strict().safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid time entry' }, { status: 400 })
  }
  const d = parsed.data

  const startedAt = d.startedAt ? new Date(d.startedAt) : entry.startedAt
  const endedAt = d.endedAt !== undefined ? (d.endedAt ? new Date(d.endedAt) : null) : entry.endedAt
  // A finished entry can't be turned back into a running timer
  if (!endedAt && entry.endedAt) return NextResponse.json({ error: 'Set an end time' }, { status: 400 })
  const timeError = checkEntryTimes(startedAt, endedAt)
  if (timeError) return NextResponse.json({ error: timeError }, { status: 400 })

  const clientId = d.clientId ?? entry.clientId
  // A new client drops the old client's project unless a project comes with it
  const projectId = d.projectId !== undefined ? d.projectId : clientId !== entry.clientId ? null : entry.projectId
  // Only a changed client or project is checked, so entries for since-archived clients stay editable
  if (clientId !== entry.clientId || projectId !== entry.projectId) {
    const bad = checkClientAndProject(await loadTimeOptions(ctx), clientId, projectId)
    if (bad) return bad
  }

  const billed = d.billed ?? entry.billed
  try {
    const [row] = await db
      .update(timeEntries)
      .set({
        clientId,
        projectId,
        activity: d.activity ?? entry.activity,
        task: d.task ?? entry.task,
        startedAt,
        endedAt,
        billed,
        billedAt: billed === entry.billed ? entry.billedAt : billed ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(timeEntries.id, entry.id))
      .returning({ id: timeEntries.id })
    return NextResponse.json(row)
  } catch (err) {
    if (isRunningTimerConflict(err)) return runningTimerResponse()
    throw err
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res

  const loaded = await loadEntryForEdit(auth.ctx, (await params).id)
  if (!loaded.ok) return loaded.res
  await db.delete(timeEntries).where(eq(timeEntries.id, loaded.entry.id))
  return new NextResponse(null, { status: 204 })
}
