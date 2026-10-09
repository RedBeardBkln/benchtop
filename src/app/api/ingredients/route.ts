import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import {
  ingredients,
  ingredientNutrients,
  ingredientAllergens,
  ingredientCerts,
  formulationLines,
} from '@/lib/db/schema'
import { and, desc, ilike, sql, eq } from 'drizzle-orm'
import { z } from 'zod'
import { duplicateResponse, findDuplicate, loadIdentityRows } from '@/lib/ingredient-duplicates'
import { duplicateCounts } from '@/lib/ingredient-identity'

export async function GET(request: NextRequest) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

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
        naturallyDerived: ingredients.naturallyDerived,
        defaultCostPerKg: ingredients.defaultCostPerKg,
        stockG: ingredients.stockG,
        notes: ingredients.notes,
        labelName: ingredients.labelName,
        brandName: ingredients.brandName,
        supplierName: ingredients.supplierName,
        itemCode: ingredients.itemCode,
        createdAt: ingredients.createdAt,
        updatedAt: ingredients.updatedAt,
        formulationCount: sql<number>`coalesce(${formulationCountSq.cnt}, 0)`,
      })
      .from(ingredients)
      .leftJoin(formulationCountSq, eq(formulationCountSq.ingredientId, ingredients.id))
      .where(
        and(
          eq(ingredients.accountId, ctx.account.id),
          q ? ilike(ingredients.name, `%${q}%`) : undefined,
        ),
      )
      .orderBy(desc(ingredients.createdAt))
      .limit(500)

    // Flag entries that share name + brand + supplier + item code with another entry. Computed over the
    // whole library (not just this page/search) so a filtered list still shows the flag.
    const dupes = duplicateCounts(await loadIdentityRows(ctx.account.id))
    return NextResponse.json(rows.map(r => ({ ...r, duplicateCount: dupes.get(r.id) ?? 0 })))
  } catch (err) {
    console.error('GET /api/ingredients error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  sourceType: z.enum(['manual', 'supplier']).default('manual'),
  naturallyDerived: z.boolean().default(true),
  notes: z.string().max(2000).optional(),
  // 0 is valid for newly added ingredients with unknown/placeholder cost.
  defaultCostPerKg: z.number().min(0).optional(),
  moisturePct: z.number().min(0).max(100).optional(),
  labelName: z.string().trim().max(500).optional(),
  brandName: z.string().trim().max(255).optional(),
  supplierName: z.string().trim().max(255).optional(),
  itemCode: z.string().trim().max(100).optional(),
})

export async function POST(request: NextRequest) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

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
    const dupe = await findDuplicate(ctx.account.id, d)
    if (dupe) return duplicateResponse(d, dupe)

    const [row] = await db
      .insert(ingredients)
      .values({
        accountId: ctx.account.id,
        name: d.name,
        sourceType: d.sourceType,
        naturallyDerived: d.naturallyDerived,
        notes: d.notes,
        labelName: d.labelName || null,
        brandName: d.brandName || null,
        supplierName: d.supplierName || null,
        itemCode: d.itemCode || null,
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
