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
import { COST_UNITS } from '@/lib/preferences'
import { z } from 'zod'
import { duplicateResponse, findDuplicate, loadIdentityRows } from '@/lib/ingredient-duplicates'
import { identityKey } from '@/lib/ingredient-identity'
import { formatIngredientName } from '@/lib/ingredient-name'
import { getOwnedIngredient, notFoundResponse, isUuid, visibleProjects } from '@/lib/tenancy'
import { canonicalTerm, categoryOptions } from '@/lib/ingredient-categories'
import { loadTaxonomyEntries } from '@/lib/ingredient-taxonomy'

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
          projectClient: projects.client,
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
          useForCost: ingredientSuppliers.useForCost,
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
      // Only formulations in projects the caller can see
      formulations: visibleProjects(
        ctx,
        formulationRows.map(r => ({ ...r, id: r.projectId, client: r.projectClient })),
      ).map(({ formulationId, formulationName, projectId, projectName }) => ({
        formulationId, formulationName, projectId, projectName,
      })),
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
  defaultCostPerKg: z.number().positive().max(1e6).nullable().optional(),
  costUnit: z.enum(COST_UNITS).optional(),
  moisturePct: z.number().min(0).max(100).nullable().optional(),
  stockG: z.number().nullable().optional(),
  category: z.string().trim().max(120).nullable().optional(),
  subcategory: z.string().trim().max(120).nullable().optional(),
  microCategory: z.string().trim().max(120).nullable().optional(),
  onHand: z.boolean().optional(),
})

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ libraryEdit: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  if (!isUuid(id)) return notFoundResponse()
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    const current = parsed.data.name !== undefined || parsed.data.brandName !== undefined
      || parsed.data.supplierName !== undefined || parsed.data.itemCode !== undefined
      ? await getOwnedIngredient(ctx, id)
      : undefined
    if (current === null) return notFoundResponse()
    // Forms resend the name on every save; only a real rename goes through the naming rule, so a
    // legacy name is left as it is until someone actually renames it
    const name = parsed.data.name === undefined || parsed.data.name === current?.name
      ? undefined
      : formatIngredientName(parsed.data.name)
    const d = { ...parsed.data, name }
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
    if (d.costUnit !== undefined) updateValues.costUnit = d.costUnit
    if (d.moisturePct !== undefined) updateValues.moisturePct = d.moisturePct?.toString() ?? null
    if (d.stockG !== undefined) updateValues.stockG = d.stockG?.toString() ?? null
    if (d.category !== undefined || d.subcategory !== undefined || d.microCategory !== undefined) {
      // New values are allowed; ones matching an existing value (ignoring case) take its spelling
      const known = await loadTaxonomyEntries(ctx.account.id)
      if (d.category !== undefined) updateValues.category = canonicalTerm(d.category, categoryOptions(known))
      if (d.subcategory !== undefined) updateValues.subcategory = canonicalTerm(d.subcategory, known.map(k => k.subcategory))
      if (d.microCategory !== undefined) updateValues.microCategory = canonicalTerm(d.microCategory, known.map(k => k.microCategory))
    }
    if (d.onHand !== undefined) updateValues.onHand = d.onHand

    // Only a change to name/brand/supplier/item code is checked, so an entry that is already part of a
    // duplicate pair can still have its other fields edited until it is renamed or merged.
    if (current) {
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
  const auth = await requireApi({ libraryEdit: true })
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
