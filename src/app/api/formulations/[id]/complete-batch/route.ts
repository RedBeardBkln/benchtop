import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { ingredients, batchRuns } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getOwnedFormulation, notFoundResponse, loadFormulationForEdit } from '@/lib/tenancy'
import { computeDepletions, loadBatchLines } from '@/lib/batch-depletion'

type Ctx = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  multiplier: z.number().positive().max(1000).default(1),
  notes: z.string().max(500).optional(),
})

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params

  const loaded = await loadFormulationForEdit(ctx, id)
  if (!loaded.ok) return loaded.res

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { multiplier, notes } = parsed.data

  const lines = await loadBatchLines(ctx.account.id, id)
  if (lines.length === 0)
    return NextResponse.json({ error: 'Formulation has no ingredient lines' }, { status: 422 })

  const depletions = computeDepletions(lines, multiplier)

  const result = await db.transaction(async tx => {
    // Deplete stock for ingredients that have tracking enabled
    for (const d of depletions) {
      if (d.remainingG == null) continue
      await tx
        .update(ingredients)
        .set({ stockG: sql`${ingredients.stockG} - ${d.depletedG.toString()}::numeric` })
        .where(and(eq(ingredients.id, d.ingredientId), eq(ingredients.accountId, ctx.account.id)))
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
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  if (!(await getOwnedFormulation(ctx, id))) return notFoundResponse()

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
