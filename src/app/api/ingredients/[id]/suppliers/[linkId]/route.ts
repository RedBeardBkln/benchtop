import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { ingredientSuppliers } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

type Ctx = { params: Promise<{ id: string; linkId: string }> }

const patchSchema = z.object({
  packSize: z.number().positive().nullable().optional(),
  packUnit: z.string().max(50).nullable().optional(),
  costPerUnit: z.number().positive().nullable().optional(),
  isPreferred: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, linkId } = await params
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

  const [row] = await db
    .update(ingredientSuppliers)
    .set(updates)
    .where(and(eq(ingredientSuppliers.id, linkId), eq(ingredientSuppliers.ingredientId, id)))
    .returning()

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, linkId } = await params
  await db
    .delete(ingredientSuppliers)
    .where(and(eq(ingredientSuppliers.id, linkId), eq(ingredientSuppliers.ingredientId, id)))

  return new NextResponse(null, { status: 204 })
}
