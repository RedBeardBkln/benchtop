import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { formulations, formulationLines, ingredientNutrients, nutrients, projects } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { solve } from '@/lib/solver'
import type { SolverInput, SolverLine } from '@/lib/solver'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Load formulation + project targets
  const [formulation] = await db
    .select()
    .from(formulations)
    .where(eq(formulations.id, id))
    .limit(1)

  if (!formulation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [project] = await db
    .select({ targets: projects.targets })
    .from(projects)
    .where(eq(projects.id, formulation.projectId))
    .limit(1)

  // Load formulation lines with nutrients
  const lines = await db
    .select({
      id: formulationLines.id,
      ingredientId: formulationLines.ingredientId,
      weightG: formulationLines.weightG,
      locked: formulationLines.locked,
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
      locked: line.locked ?? false,
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
    yieldPct: parseFloat(formulation.yieldPct ?? '100'),
    servingSizeG: formulation.servingSizeG ? parseFloat(formulation.servingSizeG) : null,
  }

  const result = solve(input)
  return NextResponse.json(result)
}
