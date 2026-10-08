import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { ingredientCerts } from '@/lib/db/schema'
import { z } from 'zod'
import { getOwnedIngredient, notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string }> }

const schema = z.object({ cert: z.string().min(1).max(100) })

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const body = schema.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 })

  if (!(await getOwnedIngredient(ctx, id))) return notFoundResponse()

  const [row] = await db
    .insert(ingredientCerts)
    .values({ ingredientId: id, cert: body.data.cert })
    .onConflictDoNothing()
    .returning()

  return NextResponse.json(row ?? { cert: body.data.cert }, { status: 201 })
}
