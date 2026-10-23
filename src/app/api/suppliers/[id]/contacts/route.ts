import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { supplierContacts } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { contactSchema } from '@/lib/client-schemas'
import { getOwnedSupplier, notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ libraryEdit: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const supplier = await getOwnedSupplier(ctx, id)
  if (!supplier) return notFoundResponse()

  const parsed = contactSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid contact' }, { status: 400 })
  }
  const d = parsed.data

  const row = await db.transaction(async tx => {
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(supplierContacts)
      .where(eq(supplierContacts.supplierId, id))
    // The first contact is the primary one; a new primary replaces the old
    const isPrimary = d.isPrimary ?? count === 0
    if (isPrimary) await tx.update(supplierContacts).set({ isPrimary: false }).where(eq(supplierContacts.supplierId, id))
    const [created] = await tx
      .insert(supplierContacts)
      .values({
        supplierId: id,
        name: d.name,
        title: d.title || null,
        email: d.email || null,
        phone: d.phone || null,
        notes: d.notes || null,
        isPrimary,
        position: count,
      })
      .returning()
    return created
  })

  return NextResponse.json(row, { status: 201 })
}
