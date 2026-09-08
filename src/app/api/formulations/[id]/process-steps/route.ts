import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { processSteps } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'

type Ctx = { params: Promise<{ id: string }> }

const postSchema = z.object({
  instruction: z.string().min(1).max(2000),
  params: z.record(z.string(), z.unknown()).optional(),
  lossPct: z.number().min(0).max(100).nullable().optional(),
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
      params: parsed.data.params ?? {},
      lossPct: parsed.data.lossPct != null ? parsed.data.lossPct.toString() : null,
    })
    .returning()

  return NextResponse.json(row, { status: 201 })
}
