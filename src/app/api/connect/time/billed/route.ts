import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { timeEntries } from '@/lib/db/schema'
import { requireConnection, trackConnectionChange } from '@/lib/invoicing-connection-server'
import { connectionBilledSchema, planBilledChange } from '@/lib/invoicing-connection'
import { editableEntryIds } from '@/lib/time-entries-server'

// Invoicing connection: marks entries billed on an invoice when it's issued, or takes them off it
// when it's voided (see planBilledChange). Safe to retry. Entries the person may not change are
// reported as missing.
export async function POST(req: NextRequest) {
  const auth = await requireConnection(req)
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = connectionBilledSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Give the entries and the invoice' }, { status: 400 })
  const body = parsed.data

  const editable = await editableEntryIds(ctx, [...new Set(body.ids)])
  const rows = editable.length === 0 ? [] : await db
    .select({ id: timeEntries.id, billed: timeEntries.billed, billedRef: timeEntries.billedRef })
    .from(timeEntries)
    .where(and(eq(timeEntries.accountId, ctx.account.id), inArray(timeEntries.id, editable)))
  const plan = planBilledChange(body, rows)

  if (plan.change.length > 0) {
    const now = new Date()
    await db
      .update(timeEntries)
      .set(body.billed
        ? { billed: true, billedAt: now, billedRef: body.invoice, updatedAt: now }
        : { billed: false, billedAt: null, billedRef: null, updatedAt: now })
      // Same condition as the plan, so a change made in between is not overwritten
      .where(and(
        eq(timeEntries.accountId, ctx.account.id),
        inArray(timeEntries.id, plan.change),
        eq(timeEntries.billed, !body.billed),
        ...(body.billed ? [] : [eq(timeEntries.billedRef, body.invoice)]),
      ))
    await trackConnectionChange(ctx, req)
  }

  return NextResponse.json(plan)
}
