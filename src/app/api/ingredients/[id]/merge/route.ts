import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApi } from '@/lib/auth/context'
import { getOwnedIngredient, notFoundResponse } from '@/lib/tenancy'
import { mergeIngredients } from '@/lib/ingredient-merge'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/ingredients/:id/merge  { intoId }
// Merges :id (removed) into intoId (kept). Both must belong to the caller's account.
const bodySchema = z.object({ intoId: z.string().uuid() })

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Choose the ingredient to keep' }, { status: 400 })
  const { intoId } = parsed.data

  if (id === intoId) return NextResponse.json({ error: 'Choose a different ingredient to merge into' }, { status: 400 })

  const [source, target] = await Promise.all([getOwnedIngredient(ctx, id), getOwnedIngredient(ctx, intoId)])
  if (!source || !target) return notFoundResponse()

  try {
    const summary = await mergeIngredients({
      accountId: ctx.account.id,
      userId: ctx.user.id,
      sourceId: id,
      targetId: intoId,
    })
    return NextResponse.json({ ok: true, ...summary, keptName: target.name })
  } catch (err) {
    console.error('POST /api/ingredients/[id]/merge error:', err)
    return NextResponse.json({ error: 'Merge failed. Nothing was changed.' }, { status: 500 })
  }
}
