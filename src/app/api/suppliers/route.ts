import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { supplierContacts, suppliers } from '@/lib/db/schema'
import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { normalizeSupplierFields, supplierCreateSchema } from '@/lib/supplier-schemas'
import { duplicateSupplierResponse, findSupplierByName, getSupplierIngredientCounts } from '@/lib/suppliers-server'

export async function GET(req: NextRequest) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth
  // ?archived=1 lists only archived suppliers; otherwise they're left out (supplier list and pickers)
  const archived = req.nextUrl.searchParams.get('archived') === '1'

  const [rows, counts, contacts] = await Promise.all([
    db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.accountId, ctx.account.id), archived ? isNotNull(suppliers.archivedAt) : isNull(suppliers.archivedAt)))
      .orderBy(asc(sql`lower(${suppliers.name})`)),
    getSupplierIngredientCounts(ctx.account.id),
    db
      .select({
        supplierId: supplierContacts.supplierId,
        name: supplierContacts.name,
        email: supplierContacts.email,
        phone: supplierContacts.phone,
        isPrimary: supplierContacts.isPrimary,
      })
      .from(supplierContacts)
      .innerJoin(suppliers, eq(supplierContacts.supplierId, suppliers.id))
      .where(eq(suppliers.accountId, ctx.account.id))
      .orderBy(asc(supplierContacts.position), asc(supplierContacts.createdAt)),
  ])

  // The primary contact, or the first one listed
  const contactBy = new Map<string, { name: string; email: string | null; phone: string | null }>()
  for (const c of contacts) {
    if (c.isPrimary || !contactBy.has(c.supplierId)) contactBy.set(c.supplierId, { name: c.name, email: c.email, phone: c.phone })
  }

  return NextResponse.json(rows.map(r => ({
    ...r,
    ingredientCount: counts.get(r.id) ?? 0,
    primaryContact: contactBy.get(r.id) ?? null,
  })))
}

export async function POST(req: NextRequest) {
  const auth = await requireApi({ libraryEdit: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = supplierCreateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid supplier' }, { status: 400 })
  }
  const { contact, ...fields } = parsed.data
  const same = await findSupplierByName(ctx.account.id, fields.name)
  if (same) return duplicateSupplierResponse(same)

  const row = await db.transaction(async tx => {
    const [created] = await tx
      .insert(suppliers)
      .values({ ...normalizeSupplierFields(fields), accountId: ctx.account.id })
      .returning()
    if (contact) {
      await tx.insert(supplierContacts).values({
        supplierId: created.id,
        name: contact.name,
        title: contact.title || null,
        email: contact.email || null,
        phone: contact.phone || null,
        notes: contact.notes || null,
        isPrimary: true,
      })
    }
    return created
  })

  return NextResponse.json(row, { status: 201 })
}
