import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { ingredientSuppliers } from '@/lib/db/schema'
import { and, eq, ne, TransactionRollbackError } from 'drizzle-orm'
import { getOwnedIngredient, notFoundResponse } from '@/lib/tenancy'
import { z } from 'zod'

type Ctx = { params: Promise<{ id: string; linkId: string }> }

const patchSchema = z.object({
  packSize: z.number().positive().nullable().optional(),
  packUnit: z.string().max(50).nullable().optional(),
  costPerUnit: z.number().positive().nullable().optional(),
  isPreferred: z.boolean().optional(),
  useForCost: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ libraryEdit: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id, linkId } = await params
  if (!(await getOwnedIngredient(ctx, id))) return notFoundResponse()
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data
  const updates: Record<string, unknown> = {}
  if (d.packSize !== undefined) updates.packSize = d.packSize != null ? d.packSize.toString() : null
  if (d.packUnit !== undefined) updates.packUnit = d.packUnit
  if (d.costPerUnit !== undefined) updates.costPerUnit = d.costPerUnit != null ? d.costPerUnit.toString() : null
  if (d.isPreferred !== undefined) updates.isPreferred = d.isPreferred
  if (d.notes !== undefined) updates.notes = d.notes

  if (d.useForCost !== undefined) updates.useForCost = d.useForCost

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const row = await db.transaction(async tx => {
    // Only one supplier price is the ingredient's cost, so choosing this one clears the others first
    // (the partial unique index allows one)
    if (d.useForCost) {
      await tx.update(ingredientSuppliers).set({ useForCost: false })
        .where(and(eq(ingredientSuppliers.ingredientId, id), ne(ingredientSuppliers.id, linkId)))
    }
    const [r] = await tx
      .update(ingredientSuppliers)
      .set(updates)
      .where(and(eq(ingredientSuppliers.id, linkId), eq(ingredientSuppliers.ingredientId, id)))
      .returning()
    // Unknown link: roll back so the other links keep their flag
    if (!r) tx.rollback()
    return r
  }).catch(e => { if (e instanceof TransactionRollbackError) return undefined; throw e })

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ libraryEdit: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id, linkId } = await params
  if (!(await getOwnedIngredient(ctx, id))) return notFoundResponse()
  await db
    .delete(ingredientSuppliers)
    .where(and(eq(ingredientSuppliers.id, linkId), eq(ingredientSuppliers.ingredientId, id)))

  return new NextResponse(null, { status: 204 })
}
