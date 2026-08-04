import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { batchRuns, formulationLines, formulations, ingredients } from '@/lib/db/schema'
import { eq, desc, sql } from 'drizzle-orm'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [ingredient] = await db
    .select({ id: ingredients.id, name: ingredients.name, stockG: ingredients.stockG })
    .from(ingredients)
    .where(eq(ingredients.id, id))
    .limit(1)
  if (!ingredient) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Find all batch runs that involved this ingredient
  const runs = await db
    .select({
      runId: batchRuns.id,
      runAt: batchRuns.runAt,
      batchMultiplier: batchRuns.batchMultiplier,
      notes: batchRuns.notes,
      formulationId: formulations.id,
      formulationName: formulations.name,
      weightG: formulationLines.weightG,
    })
    .from(batchRuns)
    .innerJoin(formulations, eq(batchRuns.formulationId, formulations.id))
    .innerJoin(formulationLines, eq(formulationLines.formulationId, formulations.id))
    .where(eq(formulationLines.ingredientId, id))
    .orderBy(desc(batchRuns.runAt))
    .limit(100)

  const depletions = runs.map(r => ({
    runId: r.runId,
    runAt: r.runAt,
    formulationId: r.formulationId,
    formulationName: r.formulationName,
    batchMultiplier: parseFloat(r.batchMultiplier),
    depletedG: parseFloat(r.weightG) * parseFloat(r.batchMultiplier),
    notes: r.notes,
  }))

  return NextResponse.json({
    id: ingredient.id,
    name: ingredient.name,
    stockG: ingredient.stockG,
    depletions,
  })
}
