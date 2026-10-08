import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { formulations, formulationLines, ingredientNutrients, nutrients, projects } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { solve } from '@/lib/solver'
import type { SolverInput, SolverLine } from '@/lib/solver'
import { loadConcentrationYieldPct } from '@/lib/formulation-yield'
import { getOwnedFormulation, notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string }> }

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
      key: line.id,
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

  const input: SolverInput = {
    lines: solverLines,
    targets: (project?.targets ?? []) as SolverInput['targets'],
    yieldPct: await loadConcentrationYieldPct(id, solverLines.reduce((s, l) => s + l.weightG, 0), ctx.account.id),
    servingSizeG: formulation.servingSizeG ? parseFloat(formulation.servingSizeG) : null,
  }

  const result = solve(input)
  return NextResponse.json(result)
}
