import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { ingredientNutrients } from '@/lib/db/schema'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { getOwnedIngredient, notFoundResponse } from '@/lib/tenancy'
import { z } from 'zod'

type Ctx = { params: Promise<{ id: string }> }

const valueSchema = z.object({
  nutrientId: z.string().uuid(),
  amountPer100g: z.number().finite().min(0),
  sourceRef: z.string().min(1).max(500),
  sourceUrl: z.string().max(2000).optional().or(z.literal('')),
})

const bodySchema = z.object({
  values: z.array(valueSchema).max(100),
  deleteIds: z.array(z.string().uuid()).max(100).default([]),
})

export async function PUT(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (!(await getOwnedIngredient(ctx, id))) return notFoundResponse()

  const { values, deleteIds } = parsed.data

  await db.transaction(async tx => {
    if (deleteIds.length > 0) {
      await tx
        .delete(ingredientNutrients)
        .where(and(inArray(ingredientNutrients.id, deleteIds), eq(ingredientNutrients.ingredientId, id)))
    }

    if (values.length > 0) {
      await tx
        .insert(ingredientNutrients)
        .values(
          values.map(v => ({
            ingredientId: id,
            nutrientId: v.nutrientId,
            amountPer100g: v.amountPer100g.toString(),
            sourceRef: v.sourceRef,
            sourceUrl: v.sourceUrl || null,
          }))
        )
        .onConflictDoUpdate({
          target: [ingredientNutrients.ingredientId, ingredientNutrients.nutrientId],
          set: {
            amountPer100g: sql`EXCLUDED.amount_per_100g`,
            sourceRef: sql`EXCLUDED.source_ref`,
            sourceUrl: sql`EXCLUDED.source_url`,
          },
        })
    }
  })

  return NextResponse.json({ ok: true })
}
