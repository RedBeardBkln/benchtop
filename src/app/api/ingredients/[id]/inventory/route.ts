import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { batchRuns, formulationLines, formulations, ingredients } from '@/lib/db/schema'
import { and, eq, desc } from 'drizzle-orm'
import { getOwnedIngredient, notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params

  const ingredient = await getOwnedIngredient(ctx, id)
  if (!ingredient) return notFoundResponse()

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
    .where(and(eq(formulationLines.ingredientId, id), eq(formulations.accountId, ctx.account.id)))
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
