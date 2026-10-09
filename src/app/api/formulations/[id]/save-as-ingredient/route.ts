import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import {
  formulations, formulationLines, processSteps, ingredients, ingredientNutrients,
  ingredientAllergens, subIngredients, nutrients,
} from '@/lib/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { getOwnedFormulation, getOwnedIngredient, notFoundResponse } from '@/lib/tenancy'
import { duplicateResponse, findDuplicate } from '@/lib/ingredient-duplicates'
import { toLossStep } from '@/lib/process-loss'
import { deriveIngredientFromFormulation, type SourceLine } from '@/lib/formulation-to-ingredient'

type Ctx = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  // Refresh the ingredient previously saved from this formulation instead of creating another
  updateExisting: z.boolean().default(false),
})

async function findExisting(accountId: string, formulationId: string) {
  const [row] = await db
    .select({ id: ingredients.id, name: ingredients.name })
    .from(ingredients)
    .where(and(eq(ingredients.sourceFormulationId, formulationId), eq(ingredients.accountId, accountId)))
    .limit(1)
  return row ?? null
}

// Which ingredient (if any) this formulation was already saved as
export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  if (!(await getOwnedFormulation(ctx, id))) return notFoundResponse()

  return NextResponse.json({ existing: await findExisting(ctx.account.id, id) })
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const formulation = await getOwnedFormulation(ctx, id)
  if (!formulation) return notFoundResponse()

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat().find(Boolean) ?? 'Invalid input'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  const { name, updateExisting } = parsed.data

  // Only a finalized formulation is stable enough to become a reusable ingredient
  if (formulation.status !== 'locked')
    return NextResponse.json({ error: 'Finalize the formulation before saving it as an ingredient' }, { status: 422 })

  const lineRows = await db
    .select({
      ingredientId: formulationLines.ingredientId,
      weightG: formulationLines.weightG,
      ingredientName: ingredients.name,
      labelName: ingredients.labelName,
      verification: ingredients.verification,
      naturallyDerived: ingredients.naturallyDerived,
      costPerKg: ingredients.defaultCostPerKg,
    })
    .from(formulationLines)
    .innerJoin(ingredients, eq(formulationLines.ingredientId, ingredients.id))
    .where(and(eq(formulationLines.formulationId, id), eq(ingredients.accountId, ctx.account.id)))
    .orderBy(formulationLines.position)

  if (lineRows.length === 0)
    return NextResponse.json({ error: 'Formulation has no ingredient lines' }, { status: 422 })

  const ingredientIds = [...new Set(lineRows.map(l => l.ingredientId))]
  const [nutrientRows, allergenRows, subRows, stepRows, allNutrients] = await Promise.all([
    db.select({
      ingredientId: ingredientNutrients.ingredientId,
      nutrientId: ingredientNutrients.nutrientId,
      amountPer100g: ingredientNutrients.amountPer100g,
    }).from(ingredientNutrients).where(inArray(ingredientNutrients.ingredientId, ingredientIds)),
    db.select({ ingredientId: ingredientAllergens.ingredientId, allergen: ingredientAllergens.allergen })
      .from(ingredientAllergens).where(inArray(ingredientAllergens.ingredientId, ingredientIds)),
    db.select({ ingredientId: subIngredients.ingredientId, name: subIngredients.name })
      .from(subIngredients).where(inArray(subIngredients.ingredientId, ingredientIds)).orderBy(subIngredients.position),
    db.select().from(processSteps).where(eq(processSteps.formulationId, id)).orderBy(processSteps.stepNo),
    db.select().from(nutrients),
  ])

  const group = <T extends { ingredientId: string }>(rows: T[]) => {
    const m = new Map<string, T[]>()
    for (const r of rows) m.set(r.ingredientId, [...(m.get(r.ingredientId) ?? []), r])
    return m
  }
  const nutrientsBy = group(nutrientRows)
  const allergensBy = group(allergenRows)
  const subsBy = group(subRows)

  const sourceLines: SourceLine[] = lineRows.map(l => ({
    weightG: parseFloat(l.weightG),
    ingredientName: l.ingredientName,
    labelName: l.labelName,
    verification: l.verification,
    naturallyDerived: l.naturallyDerived,
    costPerKg: l.costPerKg != null ? parseFloat(l.costPerKg) : null,
    nutrients: (nutrientsBy.get(l.ingredientId) ?? []).map(n => ({
      nutrientId: n.nutrientId,
      amountPer100g: parseFloat(n.amountPer100g),
    })),
    allergens: (allergensBy.get(l.ingredientId) ?? []).map(a => a.allergen),
    subIngredients: (subsBy.get(l.ingredientId) ?? []).map(s => s.name),
  }))

  const derived = deriveIngredientFromFormulation({
    lines: sourceLines,
    steps: stepRows.map(toLossStep),
    allNutrients: allNutrients.map(n => ({
      id: n.id, name: n.name, unit: n.unit, category: n.category,
      dailyValueAmount: n.dailyValueAmount != null ? Number(n.dailyValueAmount) : null,
    })),
  })
  if (!derived)
    return NextResponse.json({ error: 'Formulation has no weighed ingredients to save' }, { status: 422 })

  const existing = await findExisting(ctx.account.id, id)
  if (existing && !updateExisting) {
    return NextResponse.json(
      { error: `Already saved as "${existing.name}"`, existing },
      { status: 409 },
    )
  }

  // The library must not gain a second entry with the same identity. When refreshing the existing
  // saved ingredient its brand/supplier/code are kept, so only the name changes.
  const prior = existing ? await getOwnedIngredient(ctx, existing.id) : null
  const identity = {
    name,
    brandName: prior?.brandName ?? null,
    supplierName: prior?.supplierName ?? null,
    itemCode: prior?.itemCode ?? null,
  }
  const dupe = await findDuplicate(ctx.account.id, identity, existing?.id)
  if (dupe) return duplicateResponse(identity, dupe)

  const sourceRef = `Formulation: ${formulation.name} v${formulation.version}`
  const derivedFields = {
    sourceType: 'formulation' as const,
    sourceFormulationId: id,
    verification: derived.verification,
    naturallyDerived: derived.naturallyDerived,
    defaultCostPerKg: derived.costPerKg != null ? derived.costPerKg.toFixed(4) : null,
    moisturePct: derived.moisturePct != null ? derived.moisturePct.toFixed(4) : null,
    updatedAt: new Date(),
  }

  const ingredient = await db.transaction(async tx => {
    let row: typeof ingredients.$inferSelect
    if (existing) {
      // Keep what the user maintains by hand (brand, supplier, stock, docs, certs); refresh what is calculated
      ;[row] = await tx
        .update(ingredients)
        .set({ ...derivedFields, name })
        .where(and(eq(ingredients.id, existing.id), eq(ingredients.accountId, ctx.account.id)))
        .returning()
      await tx.delete(ingredientNutrients).where(eq(ingredientNutrients.ingredientId, row.id))
      await tx.delete(subIngredients).where(eq(subIngredients.ingredientId, row.id))
    } else {
      ;[row] = await tx
        .insert(ingredients)
        .values({ ...derivedFields, accountId: ctx.account.id, name })
        .returning()
    }

    if (derived.nutrients.length > 0) {
      await tx.insert(ingredientNutrients).values(
        derived.nutrients.map(n => ({
          ingredientId: row.id,
          nutrientId: n.nutrientId,
          amountPer100g: n.amountPer100g.toFixed(6),
          sourceRef,
        })),
      )
    }
    if (derived.allergens.length > 0) {
      // Merge rather than replace, so an allergen the user added by hand is never silently dropped
      await tx.insert(ingredientAllergens)
        .values(derived.allergens.map(allergen => ({ ingredientId: row.id, allergen })))
        .onConflictDoNothing()
    }
    if (derived.subIngredientNames.length > 0) {
      await tx.insert(subIngredients).values(
        derived.subIngredientNames.map((n, i) => ({ ingredientId: row.id, position: i + 1, name: n })),
      )
    }
    return row
  })

  return NextResponse.json(
    { ingredient, updated: !!existing, costKnown: derived.costPerKg != null },
    { status: existing ? 200 : 201 },
  )
}
