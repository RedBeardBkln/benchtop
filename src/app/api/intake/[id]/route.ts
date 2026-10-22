import { NextRequest, NextResponse } from 'next/server'
import { and, eq, ne } from 'drizzle-orm'
import { z } from 'zod'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { intakeItems } from '@/lib/db/schema'
import { INGREDIENT_CATEGORIES, INTAKE_UNITS } from '@/lib/ingredient-categories'
import { assertIngredientsOwned, isUuid, notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string }> }

const optText = (max: number) => z.string().trim().max(max).nullable().optional()

const patchSchema = z.object({
  rawName: z.string().trim().min(1).max(255).optional(),
  quantity: z.number().positive().max(1e9).nullable().optional(),
  quantityUnit: z.enum(INTAKE_UNITS).nullable().optional(),
  name: optText(255),
  category: z.enum(INGREDIENT_CATEGORIES).nullable().optional(),
  subcategory: optText(120),
  microCategory: optText(120),
  matchedIngredientId: z.string().uuid().nullable().optional(),
})

// Edit one list entry. Changing the label text sends it back to 'pending' so Claude re-identifies it.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ libraryEdit: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth
  const { id } = await params
  if (!isUuid(id)) return notFoundResponse()

  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }
  const d = parsed.data

  if (d.matchedIngredientId && !(await assertIngredientsOwned(ctx, [d.matchedIngredientId]))) {
    return notFoundResponse('Ingredient not found')
  }

  const values: Partial<typeof intakeItems.$inferInsert> = { updatedAt: new Date() }
  if (d.rawName !== undefined) {
    values.rawName = d.rawName
    values.status = 'pending'
  }
  if (d.quantity !== undefined) values.quantity = d.quantity?.toString() ?? null
  if (d.quantityUnit !== undefined) values.quantityUnit = d.quantityUnit
  if (d.name !== undefined) values.name = d.name || null
  if (d.category !== undefined) values.category = d.category
  if (d.subcategory !== undefined) values.subcategory = d.subcategory || null
  if (d.microCategory !== undefined) values.microCategory = d.microCategory || null
  if (d.matchedIngredientId !== undefined) values.matchedIngredientId = d.matchedIngredientId

  try {
    const [row] = await db
      .update(intakeItems)
      .set(values)
      .where(and(eq(intakeItems.id, id), eq(intakeItems.accountId, ctx.account.id), ne(intakeItems.status, 'imported')))
      .returning()
    if (!row) return notFoundResponse()
    return NextResponse.json(row)
  } catch (err) {
    console.error('PATCH /api/intake/[id] error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ libraryEdit: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth
  const { id } = await params
  if (!isUuid(id)) return notFoundResponse()

  try {
    const [row] = await db
      .delete(intakeItems)
      .where(and(eq(intakeItems.id, id), eq(intakeItems.accountId, ctx.account.id)))
      .returning({ id: intakeItems.id })
    if (!row) return notFoundResponse()
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('DELETE /api/intake/[id] error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
