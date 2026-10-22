import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { ingredients, ingredientAllergens, subIngredients } from '@/lib/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'

const idsSchema = z.array(z.string().uuid()).min(1).max(200)

// Label name, allergens and sub-ingredients for several ingredients at once (used to pre-fill NFP statements)
export async function GET(request: NextRequest) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = idsSchema.safeParse(
    [...new Set((request.nextUrl.searchParams.get('ids') ?? '').split(',').filter(Boolean))],
  )
  if (!parsed.success) return NextResponse.json({ error: 'Invalid ingredient ids' }, { status: 400 })

  const rows = await db
    .select({ id: ingredients.id, labelName: ingredients.labelName })
    .from(ingredients)
    .where(and(inArray(ingredients.id, parsed.data), eq(ingredients.accountId, ctx.account.id)))
  const ids = rows.map(r => r.id)
  if (ids.length === 0) return NextResponse.json({ ingredients: [] })

  const [allergenRows, subRows] = await Promise.all([
    db.select({ ingredientId: ingredientAllergens.ingredientId, allergen: ingredientAllergens.allergen })
      .from(ingredientAllergens).where(inArray(ingredientAllergens.ingredientId, ids)),
    db.select({ ingredientId: subIngredients.ingredientId, name: subIngredients.name })
      .from(subIngredients).where(inArray(subIngredients.ingredientId, ids)).orderBy(subIngredients.position),
  ])

  return NextResponse.json({
    ingredients: rows.map(r => ({
      id: r.id,
      labelName: r.labelName,
      allergens: allergenRows.filter(a => a.ingredientId === r.id).map(a => a.allergen),
      subIngredients: subRows.filter(s => s.ingredientId === r.id).map(s => s.name),
    })),
  })
}
