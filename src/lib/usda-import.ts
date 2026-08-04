// Shared USDA FoodData Central import logic.
// Used by both /api/ingredients/import-usda and /api/formulations/[id]/auto-link-deck.
// Server-only — never import this client-side.

import { db as defaultDb } from '@/lib/db'
import { ingredients, ingredientNutrients, nutrients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

export const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1'

// Maps FDC characterisation codes (used in abridged POST /foods) to FDC database IDs
// (used in full GET /food and stored in our nutrients seed).
export const FDC_CHAR_TO_ID: Record<number, number> = {
  203: 1003, 204: 1004, 205: 1005, 208: 1008, 269: 2000, 291: 1079, 539: 1235,
  601: 1253, 605: 1257, 606: 1258, 645: 1292, 646: 1293,
  301: 1087, 303: 1089, 304: 1090, 305: 1091, 306: 1092, 307: 1093,
  309: 1095, 312: 1098, 313: 1096, 314: 1100, 315: 1101, 316: 1102, 317: 1103,
  318: 1106, 323: 1109, 328: 1114, 401: 1162,
  404: 1165, 405: 1166, 406: 1167, 410: 1170, 415: 1175,
  416: 1176, 418: 1178, 421: 1180, 430: 1185, 435: 1177,
}

type NutrientRow = {
  ingredientId: string
  nutrientId: string
  amountPer100g: string
  sourceRef: string
  sourceUrl: string
}

export function parseUsdaNutrients(
  foodNutrients: unknown[],
  nutrientMap: Map<number, string>,
  fdcId: number,
): Omit<NutrientRow, 'ingredientId'>[] {
  const sourceUrl = `https://fdc.nal.usda.gov/food-details/${fdcId}/nutrients`
  const sourceRef = `USDA FDC ${fdcId}`

  return foodNutrients
    .map((fn: unknown): Omit<NutrientRow, 'ingredientId'> | null => {
      const f = fn as Record<string, unknown>
      const nutrient = f.nutrient as Record<string, unknown> | undefined
      const idRaw = (nutrient?.id ?? f.nutrientId ?? f.number ?? f.nutrientNumber) as string | number | undefined
      const value = (nutrient ? f.amount : (f.value ?? f.amount)) as number | undefined
      if (idRaw == null || value == null) return null
      let fdcNutrientId = typeof idRaw === 'number' ? idRaw : parseInt(idRaw, 10)
      if (isNaN(fdcNutrientId)) return null
      if (fdcNutrientId < 1000) fdcNutrientId = FDC_CHAR_TO_ID[fdcNutrientId] ?? fdcNutrientId
      const nutrientId = nutrientMap.get(fdcNutrientId)
      if (!nutrientId || value < 0) return null
      return { nutrientId, amountPer100g: value.toString(), sourceRef, sourceUrl }
    })
    .filter((r): r is Omit<NutrientRow, 'ingredientId'> => r !== null)
}

export type ImportResult = {
  ingredient: {
    id: string; name: string; fdcId: number
    sourceType: string; notes: string | null
  }
  nutrientCount: number
  created: boolean   // false = already existed
  sourceUrl: string
}

export async function importUsdaIngredient(
  fdcId: number,
  opts: {
    nameOverride?: string
    sourceType?: 'usda' | 'ai_extracted'
    notes?: string
    fallbackFood?: { description: string; foodNutrients?: unknown[] }
    database?: PostgresJsDatabase<Record<string, never>>
  } = {},
): Promise<ImportResult> {
  const database = opts.database ?? defaultDb
  const sourceType = opts.sourceType ?? 'usda'
  const sourceUrl = `https://fdc.nal.usda.gov/food-details/${fdcId}/nutrients`

  // Check for existing ingredient
  const existing = await database
    .select({ id: ingredients.id, name: ingredients.name })
    .from(ingredients)
    .where(eq(ingredients.fdcId, fdcId))
    .limit(1)

  if (existing.length > 0) {
    const existingNutrients = await database
      .select({ id: ingredientNutrients.id })
      .from(ingredientNutrients)
      .where(eq(ingredientNutrients.ingredientId, existing[0].id))
      .limit(1)

    if (existingNutrients.length > 0) {
      const [row] = await database
        .select()
        .from(ingredients)
        .where(eq(ingredients.id, existing[0].id))
        .limit(1)
      return {
        ingredient: { id: row.id, name: row.name, fdcId, sourceType: row.sourceType, notes: row.notes },
        nutrientCount: existingNutrients.length,
        created: false,
        sourceUrl,
      }
    }
  }

  const apiKey = process.env.USDA_FDC_API_KEY
  if (!apiKey) throw new Error('USDA_FDC_API_KEY not configured')

  // Fetch food from USDA
  let fdcFood: Record<string, unknown>
  const single = await fetch(`${FDC_BASE}/food/${fdcId}?api_key=${apiKey}`, { cache: 'no-store' })

  if (single.ok) {
    fdcFood = await single.json()
  } else if (single.status === 404) {
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
      } else if (opts.fallbackFood) {
        fdcFood = { description: opts.fallbackFood.description, foodNutrients: opts.fallbackFood.foodNutrients ?? [] }
      } else {
        throw new Error(`fdcId ${fdcId} not found in USDA database`)
      }
    } else if (opts.fallbackFood) {
      fdcFood = { description: opts.fallbackFood.description, foodNutrients: opts.fallbackFood.foodNutrients ?? [] }
    } else {
      throw new Error(`USDA bulk lookup failed for fdcId ${fdcId}`)
    }
  } else {
    if (single.status === 429) throw new Error('USDA rate limit — try again in a minute')
    throw new Error(`USDA returned ${single.status} for fdcId ${fdcId}`)
  }

  // Build nutrient map
  const allNutrients = await database.select({ id: nutrients.id, fdcNutrientNumber: nutrients.fdcNutrientNumber }).from(nutrients)
  const nutrientMap = new Map(allNutrients.filter(n => n.fdcNutrientNumber != null).map(n => [n.fdcNutrientNumber!, n.id]))

  const parsedNutrients = parseUsdaNutrients((fdcFood.foodNutrients as unknown[]) ?? [], nutrientMap, fdcId)

  const ingredientName = opts.nameOverride ?? (fdcFood.description as string) ?? `FDC ${fdcId}`
  const repairId = existing[0]?.id

  let ingredientId: string
  if (repairId) {
    ingredientId = repairId
    if (parsedNutrients.length > 0) {
      await database.insert(ingredientNutrients).values(parsedNutrients.map(r => ({ ...r, ingredientId: repairId })))
    }
  } else {
    const [row] = await database
      .insert(ingredients)
      .values({
        name: ingredientName,
        sourceType,
        fdcId,
        fdcFetchedAt: new Date(),
        verification: 'unverified',
        naturallyDerived: true,
        notes: opts.notes ?? (sourceType === 'ai_extracted' ? `Auto-imported via AI research. Data: ${sourceUrl}` : null),
      })
      .returning()
    ingredientId = row.id
    if (parsedNutrients.length > 0) {
      await database.insert(ingredientNutrients).values(parsedNutrients.map(r => ({ ...r, ingredientId })))
    }
  }

  const [finalRow] = await database.select().from(ingredients).where(eq(ingredients.id, ingredientId)).limit(1)
  return {
    ingredient: { id: ingredientId, name: ingredientName, fdcId, sourceType: finalRow.sourceType, notes: finalRow.notes },
    nutrientCount: parsedNutrients.length,
    created: !repairId,
    sourceUrl,
  }
}
