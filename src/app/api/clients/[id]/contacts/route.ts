import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { clientContacts } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { contactSchema } from '@/lib/client-schemas'
import { getOwnedClient } from '@/lib/clients-server'
import { notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ teamAdmin: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const client = await getOwnedClient(ctx.account.id, id)
  if (!client) return notFoundResponse()

  const parsed = contactSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid contact' }, { status: 400 })
  }
  const d = parsed.data

  const row = await db.transaction(async tx => {
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(clientContacts)
      .where(eq(clientContacts.clientId, id))
    // The first contact is the primary one; a new primary replaces the old
    const isPrimary = d.isPrimary ?? count === 0
    if (isPrimary) await tx.update(clientContacts).set({ isPrimary: false }).where(eq(clientContacts.clientId, id))
    const [created] = await tx
      .insert(clientContacts)
      .values({
        clientId: id,
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
