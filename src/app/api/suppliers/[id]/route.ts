import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { suppliers, ingredientSuppliers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

type Ctx = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  websiteUrl: z.string().url().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const [row] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1)
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data
  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (d.name !== undefined) updates.name = d.name
  if (d.websiteUrl !== undefined) updates.websiteUrl = d.websiteUrl
  if (d.notes !== undefined) updates.notes = d.notes

  const [row] = await db.update(suppliers).set(updates).where(eq(suppliers.id, id)).returning()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
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

  await db.delete(suppliers).where(eq(suppliers.id, id))
  return new NextResponse(null, { status: 204 })
}
