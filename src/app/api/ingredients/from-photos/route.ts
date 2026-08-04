import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import {
  ingredients,
  ingredientNutrients,
  ingredientAllergens,
  ingredientCerts,
  subIngredients,
} from '@/lib/db/schema'
import { z } from 'zod'

const bodySchema = z.object({
  name: z.string().min(1).max(255),
  labelName: z.string().max(500).nullable().optional(),
  isAbSpi: z.boolean().default(false),
  isIsolateOrConcentrate: z.boolean().default(false),
  naturallyDerived: z.boolean().default(true),
  moisturePct: z.number().min(0).max(100).nullable().optional(),
  stockG: z.number().min(0).nullable().optional(),
  notes: z.string().max(2000).optional(),
  nutrients: z.array(z.object({
    nutrientId: z.string().uuid(),
    amountPer100g: z.number().min(0),
  })).default([]),
  allergens: z.array(z.string().min(1)).default([]),
  certs: z.array(z.string().min(1)).default([]),
  subIngredients: z.array(z.object({
    position: z.number().int().min(1),
    name: z.string().min(1),
  })).default([]),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data

  try {
    const result = await db.transaction(async tx => {
      const [row] = await tx
        .insert(ingredients)
        .values({
          name: d.name,
          labelName: d.labelName ?? null,
          sourceType: 'ai_extracted',
          verification: 'unverified',
          isAbSpi: d.isAbSpi,
          isIsolateOrConcentrate: d.isIsolateOrConcentrate,
          naturallyDerived: d.naturallyDerived,
          moisturePct: d.moisturePct?.toString() ?? null,
          stockG: d.stockG?.toString() ?? null,
          notes: d.notes ?? null,
        })
        .returning({ id: ingredients.id, name: ingredients.name })

      if (d.nutrients.length > 0) {
        await tx.insert(ingredientNutrients).values(
          d.nutrients.map(n => ({
            ingredientId: row.id,
            nutrientId: n.nutrientId,
            amountPer100g: n.amountPer100g.toString(),
            sourceRef: 'AI: photo scan',
            sourceUrl: null,
          }))
        )
      }

      if (d.allergens.length > 0) {
        await tx.insert(ingredientAllergens).values(
          d.allergens.map(a => ({ ingredientId: row.id, allergen: a }))
        )
      }

      if (d.certs.length > 0) {
        await tx.insert(ingredientCerts).values(
          d.certs.map(c => ({ ingredientId: row.id, cert: c }))
        )
      }

      if (d.subIngredients.length > 0) {
        await tx.insert(subIngredients).values(
          d.subIngredients.map(s => ({
            ingredientId: row.id,
            position: s.position,
            name: s.name,
          }))
        )
      }

      return row
    })

    return NextResponse.json({ id: result.id, name: result.name }, { status: 201 })
  } catch (err) {
    console.error('[from-photos]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
