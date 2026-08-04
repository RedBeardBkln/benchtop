import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { formulationLines, formulations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

type Ctx = { params: Promise<{ id: string }> }

const lineSchema = z.object({
  ingredientId: z.string().uuid(),
  position: z.number().int().min(1),
  weightG: z.number().min(0),
  locked: z.boolean().default(false),
  minPct: z.number().min(0).max(100).nullable().optional(),
  maxPct: z.number().min(0).max(100).nullable().optional(),
})

const bodySchema = z.object({
  lines: z.array(lineSchema).max(200),
})

export async function PUT(req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { lines } = parsed.data
  const totalWeightG = lines.reduce((s, l) => s + l.weightG, 0)

  await db.transaction(async tx => {
    await tx.delete(formulationLines).where(eq(formulationLines.formulationId, id))

    if (lines.length > 0) {
      await tx.insert(formulationLines).values(
        lines.map(l => ({
          formulationId: id,
          ingredientId: l.ingredientId,
          position: l.position,
          weightG: l.weightG.toString(),
          pct: totalWeightG > 0
            ? ((l.weightG / totalWeightG) * 100).toString()
            : '0',
          locked: l.locked,
          minPct: l.minPct?.toString() ?? null,
          maxPct: l.maxPct?.toString() ?? null,
        }))
      )
    }

    await tx
      .update(formulations)
      .set({ updatedAt: new Date() })
      .where(eq(formulations.id, id))
  })

  return NextResponse.json({ ok: true, lineCount: lines.length })
}
