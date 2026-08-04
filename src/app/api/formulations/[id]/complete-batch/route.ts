import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import {
  formulations, formulationLines, ingredients, batchRuns,
} from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { z } from 'zod'

type Ctx = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  multiplier: z.number().positive().max(1000).default(1),
  notes: z.string().max(500).optional(),
})

export async function POST(req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [formulation] = await db
    .select({ id: formulations.id, name: formulations.name })
    .from(formulations)
    .where(eq(formulations.id, id))
    .limit(1)
  if (!formulation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { multiplier, notes } = parsed.data

  // Load lines with ingredient name and current stock
  const lines = await db
    .select({
      ingredientId: formulationLines.ingredientId,
      ingredientName: ingredients.name,
      weightG: formulationLines.weightG,
      stockG: ingredients.stockG,
    })
    .from(formulationLines)
    .innerJoin(ingredients, eq(formulationLines.ingredientId, ingredients.id))
    .where(eq(formulationLines.formulationId, id))

  if (lines.length === 0)
    return NextResponse.json({ error: 'Formulation has no ingredient lines' }, { status: 422 })

  type Depletion = {
    ingredientId: string
    ingredientName: string
    depletedG: number
    remainingG: number | null
  }

  const depletions: Depletion[] = lines.map(l => {
    const depletedG = parseFloat(l.weightG) * multiplier
    const remainingG = l.stockG != null ? parseFloat(l.stockG) - depletedG : null
    return { ingredientId: l.ingredientId, ingredientName: l.ingredientName, depletedG, remainingG }
  })

  const result = await db.transaction(async tx => {
    // Deplete stock for ingredients that have tracking enabled
    for (const l of lines) {
      if (l.stockG == null) continue
      const depletedG = parseFloat(l.weightG) * multiplier
      await tx
        .update(ingredients)
        .set({ stockG: sql`${ingredients.stockG} - ${depletedG.toString()}::numeric` })
        .where(and(eq(ingredients.id, l.ingredientId)))
    }

    const [run] = await tx
      .insert(batchRuns)
      .values({
        formulationId: id,
        batchMultiplier: multiplier.toString(),
        notes: notes ?? null,
      })
      .returning({ id: batchRuns.id })

    return run
  })

  return NextResponse.json({ batchRunId: result.id, depletions })
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const runs = await db
    .select({
      id: batchRuns.id,
      batchMultiplier: batchRuns.batchMultiplier,
      notes: batchRuns.notes,
      runAt: batchRuns.runAt,
    })
    .from(batchRuns)
    .where(eq(batchRuns.formulationId, id))
    .orderBy(sql`${batchRuns.runAt} desc`)

  return NextResponse.json(runs)
}
