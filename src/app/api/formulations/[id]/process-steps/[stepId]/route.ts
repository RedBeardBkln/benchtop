import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { processSteps } from '@/lib/db/schema'
import { and, eq, gt, sql } from 'drizzle-orm'
import { z } from 'zod'
import { lossFields, lossFieldsError } from '@/lib/process-loss-fields'
import { paramPatchError } from '@/lib/step-measurements'

type Ctx = { params: Promise<{ id: string; stepId: string }> }

const patchSchema = z.object({
  instruction: z.string().min(1).max(2000).optional(),
  // Keys are merged into the step's existing params; null/'' clears a key
  params: z.record(z.string().regex(/^[a-z_]{1,40}$/), z.string().max(2000).nullable()).optional(),
  equipmentId: z.string().uuid().nullable().optional(),
  // Loss is sent as a unit: type + amount + unit together, or lossType null to clear it
  lossType: z.enum(['production', 'moisture']).nullable().optional(),
  lossAmount: z.number().positive().nullable().optional(),
  lossUnit: z.enum(['g', 'pct']).optional(),
})

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, stepId } = await params
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updates: Record<string, unknown> = {}
  const d = parsed.data
  if (d.instruction !== undefined) updates.instruction = d.instruction
  if (d.params !== undefined) {
    const paramError = paramPatchError(d.params)
    if (paramError) return NextResponse.json({ error: paramError }, { status: 400 })
    // Merge in SQL so two quick edits to different fields can't overwrite each other
    let merged = sql`coalesce(${processSteps.params}, '{}'::jsonb) || ${JSON.stringify(
      Object.fromEntries(Object.entries(d.params).filter(([, v]) => v)),
    )}::jsonb`
    for (const [key, value] of Object.entries(d.params)) {
      if (!value) merged = sql`${merged} - ${key}::text`
    }
    updates.params = merged
  }
  if (d.equipmentId !== undefined) updates.equipmentId = d.equipmentId
  if (d.lossType !== undefined) {
    const lossError = lossFieldsError(d)
    if (lossError) return NextResponse.json({ error: lossError }, { status: 400 })
    Object.assign(updates, lossFields(d))
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const [row] = await db
    .update(processSteps)
    .set(updates)
    .where(and(eq(processSteps.id, stepId), eq(processSteps.formulationId, id)))
    .returning()

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, stepId } = await params

  await db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(processSteps)
      .where(and(eq(processSteps.id, stepId), eq(processSteps.formulationId, id)))
      .returning()

    if (!deleted) return

    // Close the gap so remaining steps stay contiguous
    await tx
      .update(processSteps)
      .set({ stepNo: sql`${processSteps.stepNo} - 1` })
      .where(and(eq(processSteps.formulationId, id), gt(processSteps.stepNo, deleted.stepNo)))
  })

  return NextResponse.json({ ok: true })
}
