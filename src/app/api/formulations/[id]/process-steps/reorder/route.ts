import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { processSteps } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

type Ctx = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  order: z.array(z.string().uuid()).min(1),
})

export async function PUT(req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { order } = parsed.data

  await db.transaction(async (tx) => {
    // Two passes avoid transient step_no collisions if the DB enforces uniqueness later
    for (let i = 0; i < order.length; i++) {
      await tx
        .update(processSteps)
        .set({ stepNo: -(i + 1) })
        .where(and(eq(processSteps.id, order[i]), eq(processSteps.formulationId, id)))
    }
    for (let i = 0; i < order.length; i++) {
      await tx
        .update(processSteps)
        .set({ stepNo: i + 1 })
        .where(and(eq(processSteps.id, order[i]), eq(processSteps.formulationId, id)))
    }
  })

  const steps = await db
    .select()
    .from(processSteps)
    .where(eq(processSteps.formulationId, id))
    .orderBy(processSteps.stepNo)

  return NextResponse.json(steps)
}
