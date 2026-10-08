import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { ingredientAllergens } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { getOwnedIngredient, notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string; allergenId: string }> }

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id, allergenId } = await params
  if (!(await getOwnedIngredient(ctx, id))) return notFoundResponse()

  await db
    .delete(ingredientAllergens)
    .where(and(eq(ingredientAllergens.id, allergenId), eq(ingredientAllergens.ingredientId, id)))

  return new NextResponse(null, { status: 204 })
}
