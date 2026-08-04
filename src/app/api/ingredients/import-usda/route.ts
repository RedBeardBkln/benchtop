import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { ingredients, ingredientNutrients, nutrients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1'

// USDA FDC characterization code (nutrient_nbr) → FDC database ID
// Needed for abridged POST /foods responses which only carry char codes (e.g. 203),
// while our seeds store FDC database IDs (e.g. 1003). Char codes are always < 1000.
const FDC_CHAR_TO_ID: Record<number, number> = {
  203: 1003, 204: 1004, 205: 1005, 208: 1008, 269: 2000, 291: 1079, 539: 1235,
  601: 1253, 605: 1257, 606: 1258, 645: 1292, 646: 1293,
  301: 1087, 303: 1089, 304: 1090, 305: 1091, 306: 1092, 307: 1093,
  309: 1095, 312: 1098, 313: 1096, 314: 1100, 315: 1101, 316: 1102, 317: 1103,
  318: 1106, 323: 1109, 328: 1114, 401: 1162,
  404: 1165, 405: 1166, 406: 1167, 410: 1170, 415: 1175,
  416: 1176, 418: 1178, 421: 1180, 430: 1185, 435: 1177,
}

const importSchema = z.object({
  fdcId: z.number().int().positive(),
  nameOverride: z.string().min(1).max(255).optional(),
  // Nutrient data from the search result, used as last-resort fallback when
  // both individual and bulk USDA endpoints return nothing for this fdcId.
  fallbackFood: z.object({
    description: z.string(),
    foodNutrients: z.array(z.record(z.string(), z.unknown())).optional(),
  }).optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const parsed = importSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { fdcId, nameOverride, fallbackFood } = parsed.data

  // Duplicate check — if the ingredient exists but has 0 nutrients (imported before
  // the parser was fixed), fall through to re-fetch nutrients and repair it.
  const existing = await db
    .select({ id: ingredients.id, name: ingredients.name })
    .from(ingredients)
    .where(eq(ingredients.fdcId, fdcId))
    .limit(1)

  let repairIngredientId: string | null = null

  if (existing.length > 0) {
    const existingNutrientRows = await db
      .select({ id: ingredientNutrients.id })
      .from(ingredientNutrients)
      .where(eq(ingredientNutrients.ingredientId, existing[0].id))
      .limit(1)

    if (existingNutrientRows.length > 0) {
      // Already has nutrients — standard 409
      return NextResponse.json(
        { error: 'Already imported', existingId: existing[0].id, existingName: existing[0].name },
        { status: 409 },
      )
    }

    // 0 nutrients — fall through to fetch and repair
    repairIngredientId = existing[0].id
  }

  const apiKey = process.env.USDA_FDC_API_KEY
  if (!apiKey) {
    console.error('USDA_FDC_API_KEY is not set in environment')
    return NextResponse.json({ error: 'USDA API key not configured on server' }, { status: 500 })
  }

  // Fetch food from USDA (not cached — we want fresh data at import time)
  // Some food items 404 on the individual /food/{id} endpoint even though they appear
  // in search results — the bulk /foods endpoint often serves them successfully.
  let fdcFood: Record<string, unknown>
  try {
    const single = await fetch(`${FDC_BASE}/food/${fdcId}?api_key=${apiKey}`, { cache: 'no-store' })

    if (single.ok) {
      fdcFood = await single.json()
    } else if (single.status === 404) {
      console.warn(`USDA /food/${fdcId} returned 404 — trying POST /foods`)
      const bulk = await fetch(`${FDC_BASE}/foods?api_key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fdcIds: [fdcId] }),
        cache: 'no-store',
      })
      if (bulk.ok) {
        const items = await bulk.json() as unknown[]
        if (Array.isArray(items) && items.length > 0) {
          fdcFood = items[0] as Record<string, unknown>
        } else if (fallbackFood) {
          console.warn(`Using search-result nutrients for fdcId ${fdcId} (USDA individual/bulk unavailable)`)
          fdcFood = {
            description: fallbackFood.description,
            foodNutrients: fallbackFood.foodNutrients ?? [],
          }
        } else {
          return NextResponse.json(
            { error: 'This food item is not available in the USDA database. Try a different result.' },
            { status: 404 },
          )
        }
      } else {
        const bulkBody = await bulk.text()
        console.error(`USDA POST /foods HTTP ${bulk.status} for fdcId ${fdcId}:`, bulkBody.slice(0, 200))
        if (fallbackFood) {
          console.warn(`Using search-result nutrients for fdcId ${fdcId} after bulk error`)
          fdcFood = {
            description: fallbackFood.description,
            foodNutrients: fallbackFood.foodNutrients ?? [],
          }
        } else {
          return NextResponse.json(
            { error: 'This food item is not available in the USDA database. Try a different result.' },
            { status: 404 },
          )
        }
      }
    } else {
      const singleBody = await single.text()
      console.error(`USDA import HTTP ${single.status} for fdcId ${fdcId}:`, singleBody.slice(0, 200))
      if (single.status === 429) {
        return NextResponse.json({ error: 'USDA rate limit reached — wait a minute and try again' }, { status: 429 })
      }
      return NextResponse.json({ error: `USDA API returned ${single.status}` }, { status: 502 })
    }
  } catch (err) {
    console.error('USDA import fetch error:', err)
    return NextResponse.json({ error: `USDA fetch failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 502 })
  }

  // Build fdcNutrientNumber → nutrient.id map
  const allNutrients = await db
    .select({ id: nutrients.id, fdcNutrientNumber: nutrients.fdcNutrientNumber })
    .from(nutrients)

  const nutrientMap = new Map(
    allNutrients
      .filter(n => n.fdcNutrientNumber != null)
      .map(n => [n.fdcNutrientNumber!, n.id]),
  )

  // Normalise the USDA nutrient array — three response shapes exist in FDC API.
  // Seeds store fdcNutrientNumber as the FDC *database ID* (e.g. 1003 for Protein),
  // NOT the characterisation code (e.g. "203"). Use the ID fields accordingly:
  //
  //   full (GET /food):       { nutrient: { id: 1003, number: "203" }, amount }
  //   SR Legacy flat:         { nutrientId: 1003, nutrientNumber: "203", value }
  //   abridged (POST /foods): { number: 203, amount }  ← only has characterisation code
  type RawNutrient = { fdcNutrientId: number; value: number }
  const rawNutrients = ((fdcFood.foodNutrients as unknown[]) ?? [])
    .map((fn: unknown): RawNutrient | null => {
      const f = fn as Record<string, unknown>
      const nutrient = f.nutrient as Record<string, unknown> | undefined
      // Prefer the 4-digit FDC nutrient database ID; fall back to characterisation code
      const idRaw = (nutrient?.id ?? f.nutrientId ?? f.number ?? f.nutrientNumber) as string | number | undefined
      const value = (nutrient ? f.amount : (f.value ?? f.amount)) as number | undefined
      if (idRaw == null || value == null) return null
      let fdcNutrientId = typeof idRaw === 'number' ? idRaw : parseInt(idRaw, 10)
      if (isNaN(fdcNutrientId)) return null
      // Char codes (abridged format) are < 1000; map to FDC DB IDs used in seeds
      if (fdcNutrientId < 1000) fdcNutrientId = FDC_CHAR_TO_ID[fdcNutrientId] ?? fdcNutrientId
      return { fdcNutrientId, value }
    })
    .filter((n): n is RawNutrient => n !== null)

  // Map raw FDC nutrient IDs → our nutrient table UUIDs
  const nutrientRows = rawNutrients
    .map(fn => {
      const nutrientId = nutrientMap.get(fn.fdcNutrientId)
      if (!nutrientId || fn.value < 0) return null
      const targetId = repairIngredientId ?? '' // filled below after ingredient insert
      return {
        ingredientId: targetId,
        nutrientId,
        amountPer100g: fn.value.toString(),
        sourceRef: `USDA FDC ${fdcId}`,
        sourceUrl: `https://fdc.nal.usda.gov/food-details/${fdcId}/nutrients`,
      }
    })
    .filter(Boolean) as Array<{
      ingredientId: string
      nutrientId: string
      amountPer100g: string
      sourceRef: string
      sourceUrl: string
    }>

  console.log(`[import-usda] fdcId=${fdcId} rawNutrients=${rawNutrients.length} mapped=${nutrientRows.length}`)

  // Repair path: ingredient exists but had 0 nutrients
  if (repairIngredientId) {
    const rows = nutrientRows.map(r => ({ ...r, ingredientId: repairIngredientId! }))
    if (rows.length > 0) await db.insert(ingredientNutrients).values(rows)
    const [repaired] = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.id, repairIngredientId))
      .limit(1)
    return NextResponse.json(
      { ...repaired, nutrientCount: rows.length, repaired: true },
      { status: 200 },
    )
  }

  // New ingredient path
  const ingredientName = nameOverride ?? (fdcFood.description as string) ?? `FDC ${fdcId}`
  const [ingredient] = await db
    .insert(ingredients)
    .values({
      name: ingredientName,
      sourceType: 'usda',
      fdcId,
      fdcFetchedAt: new Date(),
      verification: 'verified',
      naturallyDerived: true,
    })
    .returning()

  const rows = nutrientRows.map(r => ({ ...r, ingredientId: ingredient.id }))
  if (rows.length > 0) await db.insert(ingredientNutrients).values(rows)

  return NextResponse.json(
    { ...ingredient, nutrientCount: rows.length },
    { status: 201 },
  )
}
