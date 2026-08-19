import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import {
  ingredients,
  ingredientNutrients,
  ingredientAllergens,
  ingredientCerts,
  formulationLines,
} from '@/lib/db/schema'
import { desc, ilike, sql, eq } from 'drizzle-orm'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim()

  try {
    const formulationCountSq = db
      .select({ ingredientId: formulationLines.ingredientId, cnt: sql<number>`count(*)::int`.as('cnt') })
      .from(formulationLines)
      .groupBy(formulationLines.ingredientId)
      .as('fc')

    const rows = await db
      .select({
        id: ingredients.id,
        name: ingredients.name,
        sourceType: ingredients.sourceType,
        fdcId: ingredients.fdcId,
        verification: ingredients.verification,
        isAbSpi: ingredients.isAbSpi,
        isIsolateOrConcentrate: ingredients.isIsolateOrConcentrate,
        naturallyDerived: ingredients.naturallyDerived,
        defaultCostPerKg: ingredients.defaultCostPerKg,
        stockG: ingredients.stockG,
        notes: ingredients.notes,
        createdAt: ingredients.createdAt,
        updatedAt: ingredients.updatedAt,
        formulationCount: sql<number>`coalesce(${formulationCountSq.cnt}, 0)`,
      })
      .from(ingredients)
      .leftJoin(formulationCountSq, eq(formulationCountSq.ingredientId, ingredients.id))
      .where(q ? ilike(ingredients.name, `%${q}%`) : undefined)
      .orderBy(desc(ingredients.createdAt))
      .limit(500)

    return NextResponse.json(rows)
  } catch (err) {
    console.error('GET /api/ingredients error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  sourceType: z.enum(['manual', 'supplier']).default('manual'),
  isAbSpi: z.boolean().default(false),
  isIsolateOrConcentrate: z.boolean().default(false),
  naturallyDerived: z.boolean().default(true),
  notes: z.string().max(2000).optional(),
  // 0 is valid for newly added ingredients with unknown/placeholder cost.
  defaultCostPerKg: z.number().min(0).optional(),
  moisturePct: z.number().min(0).max(100).optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const firstError =
      Object.values(fieldErrors).flat().find(Boolean) ??
      parsed.error.flatten().formErrors[0] ??
      'Invalid ingredient input'
    return NextResponse.json({ error: firstError }, { status: 400 })
  }

  const d = parsed.data
  try {
    const [row] = await db
      .insert(ingredients)
      .values({
        name: d.name,
        sourceType: d.sourceType,
        isAbSpi: d.isAbSpi,
        isIsolateOrConcentrate: d.isIsolateOrConcentrate,
        naturallyDerived: d.naturallyDerived,
        notes: d.notes,
        verification: 'unverified',
        defaultCostPerKg: d.defaultCostPerKg?.toString(),
        moisturePct: d.moisturePct?.toString(),
      })
      .returning()

    return NextResponse.json(row, { status: 201 })
  } catch (err) {
    console.error('POST /api/ingredients error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
