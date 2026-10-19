import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { assertIngredientsOwned, getOwnedFormulation, notFoundResponse } from '@/lib/tenancy'
import { reverseSolve, targetsInNutrientUnits } from '@/lib/solver'
import { loadConcentrationYieldPct } from '@/lib/formulation-yield'
import type { ReverseInput, SolverLine, NutrientTarget, SolverResult } from '@/lib/solver'
import { db } from '@/lib/db'
import { nutrients } from '@/lib/db/schema'
import { z } from 'zod'

type Ctx = { params: Promise<{ id: string }> }

function withUnconvertibleNote(result: SolverResult, skipped: string[]): SolverResult {
  if (skipped.length === 0) return result
  const note = `Skipped target${skipped.length !== 1 ? 's' : ''} with a unit that can't be converted to the nutrient's unit: ${skipped.join(', ')}`
  return { ...result, message: result.message ? `${result.message} — ${note}` : note }
}

const bodySchema = z.object({
  targetNutrients: z.array(z.object({
    name: z.string().min(1),
    value: z.number().min(0),
    unit: z.string().min(1),
  })),
  candidates: z.array(z.object({
    ingredientId: z.string().uuid(),
    minPct: z.number().min(0).max(100).default(0),
    maxPct: z.number().min(0).max(100).default(100),
    nutrients: z.array(z.object({
      name: z.string(),
      amountPer100g: z.number(),
    })),
  })),
  servingSizeG: z.number().positive().nullable().optional(),
})

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params

  const formulation = await getOwnedFormulation(ctx, id)
  if (!formulation) return notFoundResponse()

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { targetNutrients, candidates, servingSizeG: bodyServingSizeG } = parsed.data

  // Candidate ingredient ids come from the request body: they must belong to the caller's account
  if (!(await assertIngredientsOwned(ctx, candidates.map(c => c.ingredientId)))) {
    return notFoundResponse('One or more ingredients were not found')
  }

  const solverLines: SolverLine[] = candidates.map(c => ({
    key: c.ingredientId,
    ingredientName: c.ingredientId,
    weightG: 0,
    locked: false,
    minPct: c.minPct,
    maxPct: c.maxPct,
    nutrients: c.nutrients,
  }))

  // Prefer the label's serving size sent in the request body; fall back to the
  // formulation's own serving size if not provided.
  const servingSizeG =
    bodyServingSizeG ??
    (formulation.servingSizeG ? parseFloat(formulation.servingSizeG) : null)

  // Label targets can arrive in the panel's unit (e.g. mg); ingredient amounts are in the nutrient's own unit
  const units = await db.select({ name: nutrients.name, unit: nutrients.unit }).from(nutrients)
  const { targets, unconvertible } = targetsInNutrientUnits(
    targetNutrients as NutrientTarget[],
    t => t.name,
    new Map(units.map(u => [u.name, u.unit])),
  )

  const input: ReverseInput = {
    candidates: solverLines,
    targetNutrients: targets,
    yieldPct: await loadConcentrationYieldPct(id, parseFloat(formulation.batchSizeG ?? '0'), ctx.account.id),
    servingSizeG,
  }

  return NextResponse.json(withUnconvertibleNote(reverseSolve(input), unconvertible.map(t => `${t.name} (${t.unit})`)))
}
