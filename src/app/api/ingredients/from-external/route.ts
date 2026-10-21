import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { ingredients, ingredientNutrients, nutrients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { duplicateResponse, findDuplicate } from '@/lib/ingredient-duplicates'
import { formatIngredientName } from '@/lib/ingredient-name'
import { convertToUnit } from '@/lib/units'

const bodySchema = z.object({
  name: z.string().min(1).max(255),
  sourceType: z.enum(['manual', 'supplier', 'ai_extracted']).default('manual'),
  sourceUrl: z.string().url().optional(),
  nutrients: z.array(z.object({
    name: z.string().min(1),
    amountPer100g: z.number().min(0),
    unit: z.string(),
  })).min(1),
})

export async function POST(req: NextRequest) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { sourceType, sourceUrl, nutrients: inputNutrients } = parsed.data
  const name = formatIngredientName(parsed.data.name)

  const dupe = await findDuplicate(ctx.account.id, { name })
  if (dupe) return duplicateResponse({ name }, dupe)

  // Load all DB nutrients to match by name (case-insensitive)
  const allNutrients = await db
    .select({ id: nutrients.id, name: nutrients.name, unit: nutrients.unit, category: nutrients.category })
    .from(nutrients)

  const nutrientRowsToInsert: Array<{
    nutrientId: string; amountPer100g: string; sourceRef: string; sourceUrl: string
  }> = []

  // Values arrive in whatever unit the source used (e.g. Vitamin K in mg); store them in the nutrient's own unit
  const unconvertible: string[] = []
  for (const n of inputNutrients) {
    const match = allNutrients.find(dbN => dbN.name.toLowerCase() === n.name.toLowerCase())
    if (match) {
      const amount = n.unit.trim() ? convertToUnit(n.amountPer100g, n.unit, match.unit) : n.amountPer100g
      if (amount == null) {
        unconvertible.push(`${n.name} (${n.unit} → ${match.unit})`)
        continue
      }
      nutrientRowsToInsert.push({
        nutrientId: match.id,
        amountPer100g: amount.toString(),
        sourceRef: sourceUrl ? `External: ${sourceUrl}` : 'Manual entry',
        sourceUrl: sourceUrl ?? '',
      })
    }
  }

  if (nutrientRowsToInsert.length === 0) {
    const why = unconvertible.length > 0
      ? `None of the nutrients could be saved — units couldn't be converted: ${unconvertible.join(', ')}`
      : 'None of the provided nutrient names matched the database'
    return NextResponse.json({ error: why }, { status: 422 })
  }

  // Create ingredient
  const [row] = await db
    .insert(ingredients)
    .values({
      accountId: ctx.account.id,
      name,
      sourceType,
      verification: 'unverified',
      naturallyDerived: true,
      notes: sourceUrl
        ? `Nutritional data extracted from: ${sourceUrl}`
        : 'Manually entered nutritional data',
    })
    .returning()

  // Insert nutrients
  await db.insert(ingredientNutrients).values(
    nutrientRowsToInsert.map(r => ({ ...r, ingredientId: row.id }))
  )

  // Return ingredient + full nutrient list for the wizard
  const resultNutrients = await db
    .select({
      nutrientId: ingredientNutrients.nutrientId,
      amountPer100g: ingredientNutrients.amountPer100g,
      name: nutrients.name,
      unit: nutrients.unit,
      category: nutrients.category,
    })
    .from(ingredientNutrients)
    .innerJoin(nutrients, eq(ingredientNutrients.nutrientId, nutrients.id))
    .where(eq(ingredientNutrients.ingredientId, row.id))

  return NextResponse.json({
    ingredientId: row.id,
    ingredientName: row.name,
    // Nutrients left out because their unit can't be converted to the stored one (e.g. IU → mcg)
    unconvertible,
    nutrients: resultNutrients.map(n => ({
      nutrientId: n.nutrientId,
      amountPer100g: parseFloat(n.amountPer100g),
      name: n.name,
      unit: n.unit,
      category: n.category,
    })),
  }, { status: 201 })
}
