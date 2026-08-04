import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import {
  ingredients,
  ingredientNutrients,
  ingredientAllergens,
  ingredientCerts,
  subIngredients,
  ingredientDocs,
  nutrients,
  formulationLines,
  formulations,
  projects,
  ingredientSuppliers,
  suppliers,
} from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const [ingredient] = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.id, id))
      .limit(1)

    if (!ingredient) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const [nutrientRows, allergenRows, certRows, subRows, docRows, formulationRows, supplierRows] = await Promise.all([
      db
        .select({
          id: ingredientNutrients.id,
          nutrientId: ingredientNutrients.nutrientId,
          amountPer100g: ingredientNutrients.amountPer100g,
          sourceRef: ingredientNutrients.sourceRef,
          sourceUrl: ingredientNutrients.sourceUrl,
          nutrient: {
            id: nutrients.id,
            name: nutrients.name,
            unit: nutrients.unit,
            fdcNutrientNumber: nutrients.fdcNutrientNumber,
            dailyValueAmount: nutrients.dailyValueAmount,
            displayOrder: nutrients.displayOrder,
            category: nutrients.category,
          },
        })
        .from(ingredientNutrients)
        .innerJoin(nutrients, eq(ingredientNutrients.nutrientId, nutrients.id))
        .where(eq(ingredientNutrients.ingredientId, id))
        .orderBy(nutrients.displayOrder),
      db.select().from(ingredientAllergens).where(eq(ingredientAllergens.ingredientId, id)),
      db.select().from(ingredientCerts).where(eq(ingredientCerts.ingredientId, id)),
      db.select().from(subIngredients).where(eq(subIngredients.ingredientId, id)).orderBy(subIngredients.position),
      db.select().from(ingredientDocs).where(eq(ingredientDocs.ingredientId, id)),
      db
        .select({
          formulationId: formulations.id,
          formulationName: formulations.name,
          projectId: projects.id,
          projectName: projects.name,
        })
        .from(formulationLines)
        .innerJoin(formulations, eq(formulationLines.formulationId, formulations.id))
        .innerJoin(projects, eq(formulations.projectId, projects.id))
        .where(eq(formulationLines.ingredientId, id)),
      db
        .select({
          id: ingredientSuppliers.id,
          ingredientId: ingredientSuppliers.ingredientId,
          supplierId: ingredientSuppliers.supplierId,
          packSize: ingredientSuppliers.packSize,
          packUnit: ingredientSuppliers.packUnit,
          costPerUnit: ingredientSuppliers.costPerUnit,
          isPreferred: ingredientSuppliers.isPreferred,
          notes: ingredientSuppliers.notes,
          createdAt: ingredientSuppliers.createdAt,
          supplierName: suppliers.name,
          supplierWebsiteUrl: suppliers.websiteUrl,
        })
        .from(ingredientSuppliers)
        .innerJoin(suppliers, eq(ingredientSuppliers.supplierId, suppliers.id))
        .where(eq(ingredientSuppliers.ingredientId, id))
        .orderBy(ingredientSuppliers.createdAt),
    ])

    return NextResponse.json({
      ...ingredient,
      nutrients: nutrientRows,
      allergens: allergenRows,
      certs: certRows,
      subIngredients: subRows,
      docs: docRows,
      formulations: formulationRows,
      suppliers: supplierRows,
    })
  } catch (err) {
    console.error('GET /api/ingredients/[id] error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  labelName: z.string().max(500).nullable().optional(),
  verification: z.enum(['verified', 'unverified']).optional(),
  isAbSpi: z.boolean().optional(),
  isIsolateOrConcentrate: z.boolean().optional(),
  naturallyDerived: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
  defaultCostPerKg: z.number().positive().nullable().optional(),
  moisturePct: z.number().min(0).max(100).nullable().optional(),
  stockG: z.number().nullable().optional(),
})

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data
  const updateValues: Record<string, unknown> = { updatedAt: new Date() }
  if (d.name !== undefined) updateValues.name = d.name
  if (d.labelName !== undefined) updateValues.labelName = d.labelName
  if (d.verification !== undefined) updateValues.verification = d.verification
  if (d.isAbSpi !== undefined) updateValues.isAbSpi = d.isAbSpi
  if (d.isIsolateOrConcentrate !== undefined) updateValues.isIsolateOrConcentrate = d.isIsolateOrConcentrate
  if (d.naturallyDerived !== undefined) updateValues.naturallyDerived = d.naturallyDerived
  if (d.notes !== undefined) updateValues.notes = d.notes
  if (d.defaultCostPerKg !== undefined) updateValues.defaultCostPerKg = d.defaultCostPerKg?.toString() ?? null
  if (d.moisturePct !== undefined) updateValues.moisturePct = d.moisturePct?.toString() ?? null
  if (d.stockG !== undefined) updateValues.stockG = d.stockG?.toString() ?? null

  try {
    const [row] = await db
      .update(ingredients)
      .set(updateValues)
      .where(eq(ingredients.id, id))
      .returning()
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(row)
  } catch (err) {
    console.error('PATCH /api/ingredients/[id] error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    await db.delete(ingredients).where(eq(ingredients.id, id))
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('DELETE /api/ingredients/[id] error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
