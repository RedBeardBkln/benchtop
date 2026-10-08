import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { subIngredients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getOwnedIngredient, notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string }> }

const schema = z.object({
  names: z.array(z.string().min(1).max(500)).max(500),
})

export async function PUT(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const body = schema.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 })

  if (!(await getOwnedIngredient(ctx, id))) return notFoundResponse()

  const names = body.data.names.map(n => n.trim()).filter(Boolean)

  await db.transaction(async tx => {
    await tx.delete(subIngredients).where(eq(subIngredients.ingredientId, id))
    if (names.length > 0) {
      await tx.insert(subIngredients).values(
        names.map((name, i) => ({ ingredientId: id, position: i + 1, name }))
      )
    }
  })

  const rows = await db
    .select()
    .from(subIngredients)
    .where(eq(subIngredients.ingredientId, id))
    .orderBy(subIngredients.position)

  return NextResponse.json(rows)
}
