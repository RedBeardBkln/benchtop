import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireApi, type AuthContext } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { formulationImports } from '@/lib/db/schema'
import { importDraftSchema } from '@/lib/formulation-import'
import { isUuid, notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string }> }

const mine = (ctx: AuthContext, id: string) => and(
  eq(formulationImports.id, id),
  eq(formulationImports.accountId, ctx.account.id),
  eq(formulationImports.userId, ctx.user.id),
)

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth
  const { id } = await params
  if (!isUuid(id)) return notFoundResponse()

  const [row] = await db.select().from(formulationImports).where(mine(ctx, id)).limit(1)
  if (!row) return notFoundResponse()
  return NextResponse.json({ id: row.id, draft: row.draft, updatedAt: row.updatedAt })
}

const bodySchema = z.object({ draft: importDraftSchema })

export async function PUT(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth
  const { id } = await params
  if (!isUuid(id)) return notFoundResponse()

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid import draft' }, { status: 400 })
  const { draft } = parsed.data

  const [row] = await db
    .update(formulationImports)
    .set({ draft, name: draft.name.trim() || draft.fileName, updatedAt: new Date() })
    .where(mine(ctx, id))
    .returning({ id: formulationImports.id })
  if (!row) return notFoundResponse()
  return NextResponse.json(row)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth
  const { id } = await params
  if (!isUuid(id)) return notFoundResponse()

  const [row] = await db.delete(formulationImports).where(mine(ctx, id)).returning({ id: formulationImports.id })
  if (!row) return notFoundResponse()
  return NextResponse.json({ ok: true })
}
