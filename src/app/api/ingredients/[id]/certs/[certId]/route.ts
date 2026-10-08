import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { ingredientCerts } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { getOwnedIngredient, notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string; certId: string }> }

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id, certId } = await params
  if (!(await getOwnedIngredient(ctx, id))) return notFoundResponse()

  await db
    .delete(ingredientCerts)
    .where(and(eq(ingredientCerts.id, certId), eq(ingredientCerts.ingredientId, id)))

  return new NextResponse(null, { status: 204 })
}
