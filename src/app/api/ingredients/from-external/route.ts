import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { ingredients, ingredientNutrients, nutrients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  name: z.string().min(1).max(255),
  sourceType: z.enum(['manual', 'ai_extracted']).default('manual'),
  sourceUrl: z.string().url().optional(),
  nutrients: z.array(z.object({
    name: z.string().min(1),
    amountPer100g: z.number().min(0),
    unit: z.string(),
  })).min(1),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, sourceType, sourceUrl, nutrients: inputNutrients } = parsed.data

  // Load all DB nutrients to match by name (case-insensitive)
  const allNutrients = await db
    .select({ id: nutrients.id, name: nutrients.name, unit: nutrients.unit, category: nutrients.category })
    .from(nutrients)

  const nutrientRowsToInsert: Array<{
    nutrientId: string; amountPer100g: string; sourceRef: string; sourceUrl: string
  }> = []

  for (const n of inputNutrients) {
    const match = allNutrients.find(dbN => dbN.name.toLowerCase() === n.name.toLowerCase())
    if (match) {
      nutrientRowsToInsert.push({
        nutrientId: match.id,
        amountPer100g: n.amountPer100g.toString(),
        sourceRef: sourceUrl ? `External: ${sourceUrl}` : 'Manual entry',
        sourceUrl: sourceUrl ?? '',
      })
    }
  }

  if (nutrientRowsToInsert.length === 0) {
    return NextResponse.json({ error: 'None of the provided nutrient names matched the database' }, { status: 422 })
  }

  // Create ingredient
  const [row] = await db
    .insert(ingredients)
    .values({
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
    nutrients: resultNutrients.map(n => ({
      nutrientId: n.nutrientId,
      amountPer100g: parseFloat(n.amountPer100g),
      name: n.name,
      unit: n.unit,
      category: n.category,
    })),
  }, { status: 201 })
}
