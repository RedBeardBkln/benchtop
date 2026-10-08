import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { ingredientSuppliers, suppliers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { assertSuppliersOwned, getOwnedIngredient, notFoundResponse } from '@/lib/tenancy'
import { z } from 'zod'

type Ctx = { params: Promise<{ id: string }> }

const createSchema = z.object({
  supplierId: z.string().uuid(),
  packSize: z.number().positive().nullable().optional(),
  packUnit: z.string().max(50).nullable().optional(),
  costPerUnit: z.number().positive().nullable().optional(),
  isPreferred: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  if (!(await getOwnedIngredient(ctx, id))) return notFoundResponse()

  const rows = await db
    .select({
      id: ingredientSuppliers.id,
      ingredientId: ingredientSuppliers.ingredientId,
      supplierId: ingredientSuppliers.supplierId,
      packSize: ingredientSuppliers.packSize,
      packUnit: ingredientSuppliers.packUnit,
      costPerUnit: ingredientSuppliers.costPerUnit,
      isPreferred: ingredientSuppliers.isPreferred,
      notes: ingredientSuppliers.notes,
      createdAt: ingredientSuppliers.createdAt,
      supplierName: suppliers.name,
      supplierWebsiteUrl: suppliers.websiteUrl,
    })
    .from(ingredientSuppliers)
    .innerJoin(suppliers, eq(ingredientSuppliers.supplierId, suppliers.id))
    .where(eq(ingredientSuppliers.ingredientId, id))
    .orderBy(ingredientSuppliers.createdAt)

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (!(await getOwnedIngredient(ctx, id))) return notFoundResponse()
  // The supplier id comes from the request body: it must belong to the same account
  if (!(await assertSuppliersOwned(ctx, [parsed.data.supplierId]))) return notFoundResponse('Supplier not found')

  const { supplierId, packSize, packUnit, costPerUnit, isPreferred, notes } = parsed.data
  const [row] = await db
    .insert(ingredientSuppliers)
    .values({
      ingredientId: id,
      supplierId,
      packSize: packSize != null ? packSize.toString() : null,
      packUnit: packUnit ?? null,
      costPerUnit: costPerUnit != null ? costPerUnit.toString() : null,
      isPreferred: isPreferred ?? false,
      notes: notes ?? null,
    })
    .returning()

  return NextResponse.json(row, { status: 201 })
}
