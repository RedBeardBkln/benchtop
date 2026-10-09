import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
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
import { and, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { duplicateResponse, findDuplicate, loadIdentityRows } from '@/lib/ingredient-duplicates'
import { identityKey } from '@/lib/ingredient-identity'
import { getOwnedIngredient, notFoundResponse, isUuid } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params

  try {
    const ingredient = await getOwnedIngredient(ctx, id)
    if (!ingredient) return notFoundResponse()

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
        .where(and(eq(formulationLines.ingredientId, id), eq(formulations.accountId, ctx.account.id))),
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

    // Other entries with the same name + brand + supplier + item code (pre-existing duplicates)
    const myKey = identityKey(ingredient)
    const groupIds = (await loadIdentityRows(ctx.account.id))
      .filter(r => r.id !== id && identityKey(r) === myKey)
      .map(r => r.id)
    const duplicates = groupIds.length === 0 ? [] : await db
      .select({
        id: ingredients.id,
        name: ingredients.name,
        brandName: ingredients.brandName,
        supplierName: ingredients.supplierName,
        itemCode: ingredients.itemCode,
        stockG: ingredients.stockG,
        createdAt: ingredients.createdAt,
        formulationCount: sql<number>`(select count(*)::int from formulation_lines fl where fl.ingredient_id = ${ingredients.id})`,
        nutrientCount: sql<number>`(select count(*)::int from ingredient_nutrients n where n.ingredient_id = ${ingredients.id})`,
      })
      .from(ingredients)
      .where(and(eq(ingredients.accountId, ctx.account.id), inArray(ingredients.id, groupIds)))
      .orderBy(ingredients.createdAt)

    return NextResponse.json({
      ...ingredient,
      duplicates,
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
  brandName: z.string().max(255).nullable().optional(),
  supplierName: z.string().max(255).nullable().optional(),
  itemCode: z.string().max(100).nullable().optional(),
  verification: z.enum(['verified', 'unverified']).optional(),
  naturallyDerived: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
  defaultCostPerKg: z.number().positive().nullable().optional(),
  moisturePct: z.number().min(0).max(100).nullable().optional(),
  stockG: z.number().nullable().optional(),
})

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  if (!isUuid(id)) return notFoundResponse()
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data
  const updateValues: Record<string, unknown> = { updatedAt: new Date() }
  if (d.name !== undefined) updateValues.name = d.name
  if (d.labelName !== undefined) updateValues.labelName = d.labelName
  if (d.brandName !== undefined) updateValues.brandName = d.brandName
  if (d.supplierName !== undefined) updateValues.supplierName = d.supplierName
  if (d.itemCode !== undefined) updateValues.itemCode = d.itemCode
  if (d.verification !== undefined) updateValues.verification = d.verification
  if (d.naturallyDerived !== undefined) updateValues.naturallyDerived = d.naturallyDerived
  if (d.notes !== undefined) updateValues.notes = d.notes
  if (d.defaultCostPerKg !== undefined) updateValues.defaultCostPerKg = d.defaultCostPerKg?.toString() ?? null
  if (d.moisturePct !== undefined) updateValues.moisturePct = d.moisturePct?.toString() ?? null
  if (d.stockG !== undefined) updateValues.stockG = d.stockG?.toString() ?? null

  try {
    // Only a change to name/brand/supplier/item code is checked, so an entry that is already part of a
    // duplicate pair can still have its other fields edited until it is renamed or merged.
    if (d.name !== undefined || d.brandName !== undefined || d.supplierName !== undefined || d.itemCode !== undefined) {
      const current = await getOwnedIngredient(ctx, id)
      if (!current) return notFoundResponse()
      const next = {
        name: d.name ?? current.name,
        brandName: d.brandName !== undefined ? d.brandName : current.brandName,
        supplierName: d.supplierName !== undefined ? d.supplierName : current.supplierName,
        itemCode: d.itemCode !== undefined ? d.itemCode : current.itemCode,
      }
      if (identityKey(next) !== identityKey(current)) {
        const dupe = await findDuplicate(ctx.account.id, next, id)
        if (dupe) return duplicateResponse(next, dupe)
      }
    }

    const [row] = await db
      .update(ingredients)
      .set(updateValues)
      .where(and(eq(ingredients.id, id), eq(ingredients.accountId, ctx.account.id)))
      .returning()
    if (!row) return notFoundResponse()
    return NextResponse.json(row)
  } catch (err) {
    console.error('PATCH /api/ingredients/[id] error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  try {
    const ingredient = await getOwnedIngredient(ctx, id)
    if (!ingredient) return notFoundResponse()
    await db.delete(ingredients).where(and(eq(ingredients.id, id), eq(ingredients.accountId, ctx.account.id)))
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('DELETE /api/ingredients/[id] error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
