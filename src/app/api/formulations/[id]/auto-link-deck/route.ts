import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { ingredientNutrients, nutrients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { importUsdaIngredient, FDC_BASE } from '@/lib/usda-import'

type Ctx = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  items: z.array(z.object({
    id: z.string(),            // wizard deck-item id (client-side)
    rawName: z.string(),
    searchQuery: z.string(),   // AI-suggested USDA search term
    fdcId: z.number().optional(), // if provided, skip search and import this specific item
  })),
})

// Preferred data types in priority order
const DATA_TYPE_RANK: Record<string, number> = {
  Foundation: 0,
  'SR Legacy': 1,
  'Survey (FNDDS)': 2,
  Branded: 3,
}

export async function POST(req: NextRequest, { params: _params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.USDA_FDC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'USDA_FDC_API_KEY not configured' }, { status: 500 })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const results = await Promise.all(parsed.data.items.map(async (item) => {
    try {
      let fdcIdToImport: number
      let fallbackDescription = item.rawName
      let fallbackFoodNutrients: unknown[] | undefined

      if (item.fdcId) {
        // User selected a specific USDA candidate — skip search
        fdcIdToImport = item.fdcId
      } else {
        // 1. Search USDA for the query term
        const searchRes = await fetch(`${FDC_BASE}/foods/search?api_key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: item.searchQuery || item.rawName,
            dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'],
            pageSize: 5,
            pageNumber: 1,
          }),
          cache: 'no-store',
        })

        if (!searchRes.ok) {
          return { id: item.id, status: 'not_found' as const, rawName: item.rawName }
        }

        const searchData = await searchRes.json()
        const foods: Array<{ fdcId: number; description: string; dataType: string; foodNutrients?: unknown[] }> =
          searchData.foods ?? []

        if (foods.length === 0) {
          return { id: item.id, status: 'not_found' as const, rawName: item.rawName }
        }

        // 2. Pick best result: prefer Foundation > SR Legacy > Survey > Branded
        const best = foods.slice().sort((a, b) =>
          (DATA_TYPE_RANK[a.dataType] ?? 99) - (DATA_TYPE_RANK[b.dataType] ?? 99)
        )[0]

        fdcIdToImport = best.fdcId
        fallbackDescription = best.description
        fallbackFoodNutrients = best.foodNutrients
      }

      // 3. Import (or fetch existing)
      const result = await importUsdaIngredient(fdcIdToImport, {
        nameOverride: item.rawName,          // keep the label's name as written
        sourceType: 'ai_extracted',
        fallbackFood: fallbackFoodNutrients
          ? { description: fallbackDescription, foodNutrients: fallbackFoodNutrients }
          : undefined,
      })

      // 4. Load full nutrient list for wizard
      const nutrientRows = await db
        .select({
          nutrientId: ingredientNutrients.nutrientId,
          amountPer100g: ingredientNutrients.amountPer100g,
          sourceUrl: ingredientNutrients.sourceUrl,
          nutrient: {
            id: nutrients.id,
            name: nutrients.name,
            unit: nutrients.unit,
            category: nutrients.category,
          },
        })
        .from(ingredientNutrients)
        .innerJoin(nutrients, eq(ingredientNutrients.nutrientId, nutrients.id))
        .where(eq(ingredientNutrients.ingredientId, result.ingredient.id))

      return {
        id: item.id,
        status: 'linked' as const,
        rawName: item.rawName,
        ingredientId: result.ingredient.id,
        ingredientName: result.ingredient.name,
        fdcId: result.ingredient.fdcId,
        sourceUrl: result.sourceUrl,
        created: result.created,
        nutrients: nutrientRows.map(n => ({
          nutrientId: n.nutrientId,
          amountPer100g: parseFloat(n.amountPer100g),
          name: n.nutrient.name,
          unit: n.nutrient.unit,
          category: n.nutrient.category,
        })),
      }
    } catch (err) {
      console.error(`[auto-link-deck] failed for "${item.rawName}":`, err)
      return { id: item.id, status: 'error' as const, rawName: item.rawName, error: String(err) }
    }
  }))

  return NextResponse.json({ results })
}
