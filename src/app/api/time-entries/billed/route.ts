import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { timeEntries } from '@/lib/db/schema'
import { billedUpdateSchema } from '@/lib/time-tracking'
import { editableEntryIds } from '@/lib/time-entries-server'

// Marks several entries billed or not billed at once (e.g. everything on a report just sent).
// Entries the caller may not change are skipped; the reply says how many changed.
export async function POST(req: NextRequest) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res

  const parsed = billedUpdateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Choose at least one entry' }, { status: 400 })
  const { ids, billed } = parsed.data

  const editable = await editableEntryIds(auth.ctx, [...new Set(ids)])
  if (editable.length === 0) return NextResponse.json({ updated: 0 })

  const now = new Date()
  const rows = await db
    .update(timeEntries)
    .set({ billed, billedAt: billed ? now : null, updatedAt: now })
    // Only rows whose status actually changes, so an earlier billed date is kept
    .where(and(inArray(timeEntries.id, editable), eq(timeEntries.billed, !billed)))
    .returning({ id: timeEntries.id })
  return NextResponse.json({ updated: rows.length })
}
