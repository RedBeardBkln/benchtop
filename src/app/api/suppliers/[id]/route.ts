import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { suppliers, ingredientSuppliers, supplierContacts } from '@/lib/db/schema'
import { and, asc, eq } from 'drizzle-orm'
import { isUuid, getOwnedSupplier, notFoundResponse } from '@/lib/tenancy'
import { normalizeSupplierFields, supplierPatchSchema } from '@/lib/supplier-schemas'
import { getSupplierIngredients } from '@/lib/suppliers-server'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const row = await getOwnedSupplier(ctx, id)
  if (!row) return notFoundResponse()

  const [contacts, linked] = await Promise.all([
    db.select().from(supplierContacts).where(eq(supplierContacts.supplierId, id))
      .orderBy(asc(supplierContacts.position), asc(supplierContacts.createdAt)),
    getSupplierIngredients(ctx.account.id, id, row.name),
  ])

  return NextResponse.json({ ...row, contacts, ingredients: linked })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ libraryEdit: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  if (!isUuid(id)) return notFoundResponse()

  const parsed = supplierPatchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid supplier' }, { status: 400 })
  }

  const [row] = await db
    .update(suppliers)
    .set({ ...normalizeSupplierFields(parsed.data), updatedAt: new Date() })
    .where(and(eq(suppliers.id, id), eq(suppliers.accountId, ctx.account.id)))
    .returning()
  if (!row) return notFoundResponse()
  return NextResponse.json(row)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ libraryEdit: true })
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

  // Contacts cascade
  await db.delete(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.accountId, ctx.account.id)))
  return new NextResponse(null, { status: 204 })
}
