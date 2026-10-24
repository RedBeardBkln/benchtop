import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { equipment } from '@/lib/db/schema'
import { and, eq, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import { notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
})

// Renames a piece of equipment; every step that uses it shows the new name
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ libraryEdit: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return notFoundResponse()
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const { name } = parsed.data

  const [clash] = await db
    .select({ id: equipment.id })
    .from(equipment)
    .where(and(eq(equipment.accountId, ctx.account.id), ne(equipment.id, id), sql`lower(${equipment.name}) = lower(${name})`))
    .limit(1)
  if (clash) return NextResponse.json({ error: `There's already equipment called "${name}"` }, { status: 409 })

  const [row] = await db
    .update(equipment)
    .set({ name })
    .where(and(eq(equipment.id, id), eq(equipment.accountId, ctx.account.id)))
    .returning()
  if (!row) return notFoundResponse()
  return NextResponse.json(row)
}

// Removes a piece of equipment; steps that used it keep everything else and show no equipment
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ libraryEdit: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return notFoundResponse()
  const [row] = await db
    .delete(equipment)
    .where(and(eq(equipment.id, id), eq(equipment.accountId, ctx.account.id)))
    .returning({ id: equipment.id })
  if (!row) return notFoundResponse()
  return NextResponse.json({ ok: true })
}
