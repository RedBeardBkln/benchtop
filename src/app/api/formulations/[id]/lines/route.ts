import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { formulationLines, formulations, processSteps } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { hasValidWeightPrecision } from '@/lib/weight'
import { WEIGHT_UNITS } from '@/lib/weight-units'
import { assertIngredientsOwned, notFoundResponse, loadFormulationForEdit } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string }> }

const lineSchema = z.object({
  ingredientId: z.string().uuid(),
  position: z.number().int().min(1),
  weightG: z.number().min(0).refine(hasValidWeightPrecision, 'Weights can have at most 4 decimal places'),
  locked: z.boolean().default(false),
  pctLocked: z.boolean().default(false),
  // The line's own display unit; null follows the formulation's column unit
  weightUnit: z.enum(WEIGHT_UNITS).nullable().optional(),
  // For a line added after a process step, % of the batch weight leaving that step
  lockedPct: z.number().min(0).max(100).nullable().optional(),
  // Process step of this formulation the line is added after; null = the starting blend
  addedAfterStepId: z.string().uuid().nullable().optional(),
  minPct: z.number().min(0).max(100).nullable().optional(),
  maxPct: z.number().min(0).max(100).nullable().optional(),
})

const bodySchema = z.object({
  lines: z.array(lineSchema).max(200),
})

export async function PUT(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const loaded = await loadFormulationForEdit(ctx, id)
  if (!loaded.ok) return loaded.res

  const { lines } = parsed.data
  // Ingredient ids come from the request body: every one must belong to the caller's account
  if (!(await assertIngredientsOwned(ctx, lines.map(l => l.ingredientId)))) {
    return notFoundResponse('One or more ingredients were not found')
  }
  const totalWeightG = lines.reduce((s, l) => s + l.weightG, 0)

  // Step ids come from the request body: each must be a step of this formulation
  const stepIds = new Set(lines.flatMap(l => (l.addedAfterStepId ? [l.addedAfterStepId] : [])))
  if (stepIds.size > 0) {
    const own = await db
      .select({ id: processSteps.id })
      .from(processSteps)
      .where(eq(processSteps.formulationId, id))
    const ownIds = new Set(own.map(s => s.id))
    if ([...stepIds].some(s => !ownIds.has(s))) return notFoundResponse('Process step not found')
  }

  await db.transaction(async tx => {
    await tx.delete(formulationLines).where(eq(formulationLines.formulationId, id))

    if (lines.length > 0) {
      await tx.insert(formulationLines).values(
        lines.map(l => ({
          formulationId: id,
          ingredientId: l.ingredientId,
          position: l.position,
          weightG: l.weightG.toString(),
          // A %-locked line stores the exact locked value rather than a recomputed (rounded) one; a staged
          // line's locked value is of the mass after its step, so it goes in stage_pct instead
          pct: l.pctLocked && l.lockedPct != null && !l.addedAfterStepId
            ? l.lockedPct.toString()
            : totalWeightG > 0
              ? ((l.weightG / totalWeightG) * 100).toString()
              : '0',
          locked: l.locked,
          pctLocked: l.pctLocked,
          weightUnit: l.weightUnit ?? null,
          addedAfterStepId: l.addedAfterStepId ?? null,
          stagePct: l.addedAfterStepId && l.pctLocked && l.lockedPct != null ? l.lockedPct.toString() : null,
          minPct: l.minPct?.toString() ?? null,
          maxPct: l.maxPct?.toString() ?? null,
        }))
      )
    }

    await tx
      .update(formulations)
      .set({ updatedAt: new Date() })
      .where(and(eq(formulations.id, id), eq(formulations.accountId, ctx.account.id)))
  })

  return NextResponse.json({ ok: true, lineCount: lines.length })
}
