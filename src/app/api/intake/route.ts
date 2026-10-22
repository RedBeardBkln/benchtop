import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { ingredients, intakeItems } from '@/lib/db/schema'
import { INTAKE_UNITS } from '@/lib/ingredient-categories'

// The account's lab intake list: everything not yet uploaded to the library, oldest first.
export async function GET() {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  try {
    const [rows, [{ importedCount }]] = await Promise.all([
      db
        .select({
          item: intakeItems,
          matchedName: ingredients.name,
        })
        .from(intakeItems)
        .leftJoin(ingredients, eq(ingredients.id, intakeItems.matchedIngredientId))
        .where(and(eq(intakeItems.accountId, ctx.account.id), ne(intakeItems.status, 'imported')))
        .orderBy(asc(intakeItems.createdAt)),
      db
        .select({ importedCount: sql<number>`count(*)::int` })
        .from(intakeItems)
        .where(and(eq(intakeItems.accountId, ctx.account.id), eq(intakeItems.status, 'imported'))),
    ])
    return NextResponse.json({
      items: rows.map(r => ({ ...r.item, matchedName: r.matchedName })),
      importedCount,
    })
  } catch (err) {
    console.error('GET /api/intake error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

const createSchema = z.object({
  items: z.array(z.object({
    rawName: z.string().trim().min(1, 'Name is required').max(255),
    quantity: z.number().positive().max(1e9).nullable().optional(),
    quantityUnit: z.enum(INTAKE_UNITS).nullable().optional(),
  })).min(1).max(500),
})

export async function POST(request: NextRequest) {
  const auth = await requireApi({ libraryEdit: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  try {
    const rows = await db
      .insert(intakeItems)
      .values(parsed.data.items.map(i => ({
        accountId: ctx.account.id,
        rawName: i.rawName,
        quantity: i.quantity != null && i.quantityUnit ? i.quantity.toString() : null,
        quantityUnit: i.quantity != null && i.quantityUnit ? i.quantityUnit : null,
      })))
      .returning()
    return NextResponse.json(rows, { status: 201 })
  } catch (err) {
    console.error('POST /api/intake error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
