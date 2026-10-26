import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { formulations, formulationLines, ingredientNutrients, nutrients, projects } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { solve, targetsInNutrientUnits } from '@/lib/solver'
import type { SolverInput, SolverLine, SolverResult } from '@/lib/solver'
import { loadConcentrationYieldPct } from '@/lib/formulation-yield'
import { getOwnedFormulation, notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string }> }

function withUnconvertibleNote(result: SolverResult, skipped: string[]): SolverResult {
  if (skipped.length === 0) return result
  const note = `Skipped target${skipped.length !== 1 ? 's' : ''} with a unit that can't be converted to the nutrient's unit: ${skipped.join(', ')}`
  return { ...result, message: result.message ? `${result.message} — ${note}` : note }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params

  // Load formulation + project targets
  const formulation = await getOwnedFormulation(ctx, id)
  if (!formulation) return notFoundResponse()

  const [project] = await db
    .select({ targets: projects.targets })
    .from(projects)
    .where(and(eq(projects.id, formulation.projectId), eq(projects.accountId, ctx.account.id)))
    .limit(1)

  // Load formulation lines with nutrients
  const lines = await db
    .select({
      id: formulationLines.id,
      ingredientId: formulationLines.ingredientId,
      weightG: formulationLines.weightG,
      locked: formulationLines.locked,
      pctLocked: formulationLines.pctLocked,
      minPct: formulationLines.minPct,
      maxPct: formulationLines.maxPct,
      position: formulationLines.position,
    })
    .from(formulationLines)
    .where(eq(formulationLines.formulationId, id))

  // For each line, get nutrients
  const solverLines: SolverLine[] = []

  for (const line of lines) {
    const lineNutrients = await db
      .select({
        name: nutrients.name,
        amountPer100g: ingredientNutrients.amountPer100g,
      })
      .from(ingredientNutrients)
      .innerJoin(nutrients, eq(ingredientNutrients.nutrientId, nutrients.id))
      .where(eq(ingredientNutrients.ingredientId, line.ingredientId))

    solverLines.push({
      // Keyed by ingredient (each appears once per formulation): line ids change on every save,
      // so the editor would no longer match them after saving
      key: line.ingredientId,
      ingredientName: line.ingredientId,
      weightG: parseFloat(line.weightG ?? '0'),
      // A %-locked line is as fixed for the solver as a quantity-locked one
      locked: (line.locked || line.pctLocked) ?? false,
      minPct: line.minPct != null ? parseFloat(line.minPct) : 0,
      maxPct: line.maxPct != null ? parseFloat(line.maxPct) : 100,
      nutrients: lineNutrients.map(n => ({
        name: n.name,
        amountPer100g: parseFloat(n.amountPer100g ?? '0'),
      })),
    })
  }

  // Targets go into each nutrient's own unit, the unit ingredient amounts are stored in
  const units = await db
    .select({ name: nutrients.name, unit: nutrients.unit, dv: nutrients.dailyValueAmount })
    .from(nutrients)
  const { targets, unconvertible } = targetsInNutrientUnits(
    (project?.targets ?? []) as SolverInput['targets'],
    t => t.nutrient,
    new Map(units.map(u => [u.name, u.unit])),
    new Map(units.map(u => [u.name, u.dv != null ? parseFloat(u.dv) : null])),
  )

  const input: SolverInput = {
    lines: solverLines,
    targets,
    yieldPct: await loadConcentrationYieldPct(id, solverLines.reduce((s, l) => s + l.weightG, 0), ctx.account.id),
    servingSizeG: formulation.servingSizeG ? parseFloat(formulation.servingSizeG) : null,
  }

  const result = solve(input)
  return NextResponse.json(withUnconvertibleNote(result, unconvertible.map(t => `${t.label || t.nutrient} (${t.unit})`)))
}
