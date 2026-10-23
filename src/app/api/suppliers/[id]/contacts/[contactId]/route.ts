import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { supplierContacts } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { contactPatchSchema } from '@/lib/client-schemas'
import { getOwnedSupplier, isUuid, notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string; contactId: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ libraryEdit: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id, contactId } = await params
  const supplier = await getOwnedSupplier(ctx, id)
  if (!supplier || !isUuid(contactId)) return notFoundResponse()

  const parsed = contactPatchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid contact' }, { status: 400 })
  }
  const d = parsed.data
  const updates: Record<string, unknown> = {}
  if (d.name !== undefined) updates.name = d.name
  for (const k of ['title', 'email', 'phone', 'notes'] as const) {
    if (d[k] !== undefined) updates[k] = d[k] || null
  }
  if (d.isPrimary !== undefined) updates.isPrimary = d.isPrimary

  const row = await db.transaction(async tx => {
    if (d.isPrimary) await tx.update(supplierContacts).set({ isPrimary: false }).where(eq(supplierContacts.supplierId, id))
    const [updated] = await tx
      .update(supplierContacts)
      .set(updates)
      .where(and(eq(supplierContacts.id, contactId), eq(supplierContacts.supplierId, id)))
      .returning()
    return updated
  })
  if (!row) return notFoundResponse()
  return NextResponse.json(row)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ libraryEdit: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id, contactId } = await params
  const supplier = await getOwnedSupplier(ctx, id)
  if (!supplier || !isUuid(contactId)) return notFoundResponse()

  await db.delete(supplierContacts).where(and(eq(supplierContacts.id, contactId), eq(supplierContacts.supplierId, id)))
  return new NextResponse(null, { status: 204 })
}
