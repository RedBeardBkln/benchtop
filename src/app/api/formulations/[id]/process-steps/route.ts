import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { processSteps } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { lossFields, lossFieldsError } from '@/lib/process-loss-fields'
import { paramPatchError } from '@/lib/step-measurements'

type Ctx = { params: Promise<{ id: string }> }

const postSchema = z.object({
  instruction: z.string().min(1).max(2000),
  // Keys are merged into the step's existing params; null/'' clears a key
  params: z.record(z.string().regex(/^[a-z_]{1,40}$/), z.string().max(2000).nullable()).optional(),
  equipmentId: z.string().uuid().nullable().optional(),
  // Loss is sent as a unit: type + amount + unit together, or lossType null to clear it
  lossType: z.enum(['production', 'moisture']).nullable().optional(),
  lossAmount: z.number().positive().nullable().optional(),
  lossUnit: z.enum(['g', 'pct']).optional(),
})

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const steps = await db
    .select()
    .from(processSteps)
    .where(eq(processSteps.formulationId, id))
    .orderBy(processSteps.stepNo)

  return NextResponse.json(steps)
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const parsed = postSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const lossError = lossFieldsError(parsed.data)
  if (lossError) return NextResponse.json({ error: lossError }, { status: 400 })
  const paramError = paramPatchError(parsed.data.params ?? {})
  if (paramError) return NextResponse.json({ error: paramError }, { status: 400 })

  const [{ maxStepNo }] = await db
    .select({ maxStepNo: sql<number>`coalesce(max(${processSteps.stepNo}), 0)` })
    .from(processSteps)
    .where(eq(processSteps.formulationId, id))

  const [row] = await db
    .insert(processSteps)
    .values({
      formulationId: id,
      stepNo: maxStepNo + 1,
      instruction: parsed.data.instruction,
      params: Object.fromEntries(Object.entries(parsed.data.params ?? {}).filter(([, v]) => v)),
      equipmentId: parsed.data.equipmentId ?? null,
      ...lossFields(parsed.data),
    })
    .returning()

  return NextResponse.json(row, { status: 201 })
}
