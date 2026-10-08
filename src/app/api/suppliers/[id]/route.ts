import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { suppliers, ingredientSuppliers } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { isUuid, getOwnedSupplier, notFoundResponse } from '@/lib/tenancy'
import { z } from 'zod'

type Ctx = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  websiteUrl: z.string().url().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const row = await getOwnedSupplier(ctx, id)
  if (!row) return notFoundResponse()
  return NextResponse.json(row)
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  if (!isUuid(id)) return notFoundResponse()
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data
  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (d.name !== undefined) updates.name = d.name
  if (d.websiteUrl !== undefined) updates.websiteUrl = d.websiteUrl
  if (d.notes !== undefined) updates.notes = d.notes

  const [row] = await db
    .update(suppliers)
    .set(updates)
    .where(and(eq(suppliers.id, id), eq(suppliers.accountId, ctx.account.id)))
    .returning()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const supplier = await getOwnedSupplier(ctx, id)
  if (!supplier) return notFoundResponse()

  // Check if this supplier is still linked to any ingredients
  const links = await db
    .select({ id: ingredientSuppliers.id })
    .from(ingredientSuppliers)
    .where(eq(ingredientSuppliers.supplierId, id))
    .limit(1)

  if (links.length > 0) {
    return NextResponse.json(
      { error: 'Supplier is still linked to one or more ingredients. Remove all links first.' },
      { status: 409 },
    )
  }

  await db.delete(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.accountId, ctx.account.id)))
  return new NextResponse(null, { status: 204 })
}
