import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { ingredientNutrients } from '@/lib/db/schema'
import { eq, inArray, sql } from 'drizzle-orm'
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { values, deleteIds } = parsed.data

  await db.transaction(async tx => {
    if (deleteIds.length > 0) {
      await tx
        .delete(ingredientNutrients)
        .where(inArray(ingredientNutrients.id, deleteIds))
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
