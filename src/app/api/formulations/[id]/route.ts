import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import {
  formulations, formulationLines, ingredients,
  ingredientNutrients, nutrients, projects, processSteps,
} from '@/lib/db/schema'
import { desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'

type Ctx = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  servingSizeG: z.number().positive().nullable().optional(),
  batchSizeG: z.number().positive().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  iterationNote: z.string().max(2000).nullable().optional(),
  status: z.enum(['draft', 'locked']).optional(),
  archived: z.boolean().optional(),
})

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [formulation] = await db
    .select()
    .from(formulations)
    .where(eq(formulations.id, id))
    .limit(1)

  if (!formulation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [project] = await db
    .select({ id: projects.id, name: projects.name, targets: projects.targets })
    .from(projects)
    .where(eq(projects.id, formulation.projectId))
    .limit(1)

  const lines = await db
    .select({
      id: formulationLines.id,
      ingredientId: formulationLines.ingredientId,
      ingredientName: ingredients.name,
      ingredientVerification: ingredients.verification,
      position: formulationLines.position,
      weightG: formulationLines.weightG,
      pct: formulationLines.pct,
      locked: formulationLines.locked,
      minPct: formulationLines.minPct,
      maxPct: formulationLines.maxPct,
    })
    .from(formulationLines)
    .innerJoin(ingredients, eq(formulationLines.ingredientId, ingredients.id))
    .where(eq(formulationLines.formulationId, id))
    .orderBy(formulationLines.position)

  const ingredientIds = [...new Set(lines.map(l => l.ingredientId))]
  const nutrientRows = ingredientIds.length > 0
    ? await db
        .select({
          ingredientId: ingredientNutrients.ingredientId,
          nutrientId: ingredientNutrients.nutrientId,
          amountPer100g: ingredientNutrients.amountPer100g,
          name: nutrients.name,
          unit: nutrients.unit,
          category: nutrients.category,
        })
        .from(ingredientNutrients)
        .innerJoin(nutrients, eq(ingredientNutrients.nutrientId, nutrients.id))
        .where(inArray(ingredientNutrients.ingredientId, ingredientIds))
    : []

  const byIngredient = new Map<string, typeof nutrientRows>()
  for (const row of nutrientRows) {
    const list = byIngredient.get(row.ingredientId) ?? []
    list.push(row)
    byIngredient.set(row.ingredientId, list)
  }

  const linesWithNutrients = lines.map(l => ({
    ...l,
    nutrients: (byIngredient.get(l.ingredientId) ?? []).map(n => ({
      nutrientId: n.nutrientId,
      amountPer100g: n.amountPer100g,
      name: n.name,
      unit: n.unit,
      category: n.category,
    })),
  }))

  const steps = await db
    .select()
    .from(processSteps)
    .where(eq(processSteps.formulationId, id))
    .orderBy(processSteps.stepNo)

  const iterations = await db
    .select({
      id: formulations.id,
      version: formulations.version,
      status: formulations.status,
      iterationNote: formulations.iterationNote,
      updatedAt: formulations.updatedAt,
    })
    .from(formulations)
    .where(eq(formulations.familyId, formulation.familyId))
    .orderBy(desc(formulations.version))

  return NextResponse.json({ ...formulation, lines: linesWithNutrients, processSteps: steps, project, iterations })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  const d = parsed.data
  if (d.name !== undefined) updates.name = d.name
  if (d.servingSizeG !== undefined) updates.servingSizeG = d.servingSizeG?.toString() ?? null
  if (d.batchSizeG !== undefined) updates.batchSizeG = d.batchSizeG?.toString() ?? null
  if (d.notes !== undefined) updates.notes = d.notes
  if (d.iterationNote !== undefined) updates.iterationNote = d.iterationNote?.trim() || null
  if (d.status !== undefined) {
    updates.status = d.status
    if (d.status === 'locked') updates.lockedAt = new Date()
  }
  if (d.archived !== undefined) {
    updates.archivedAt = d.archived ? new Date() : null
  }

  const [row] = await db
    .update(formulations)
    .set(updates)
    .where(eq(formulations.id, id))
    .returning()

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Name and archived state belong to the formulation as a whole, so keep every iteration in sync
  const familyUpdates: Record<string, unknown> = {}
  if (d.name !== undefined) familyUpdates.name = d.name
  if (d.archived !== undefined) familyUpdates.archivedAt = updates.archivedAt
  if (Object.keys(familyUpdates).length > 0) {
    await db.update(formulations).set(familyUpdates).where(eq(formulations.familyId, row.familyId))
  }

  return NextResponse.json(row)
}
