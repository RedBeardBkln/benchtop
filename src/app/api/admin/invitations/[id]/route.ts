import { NextRequest, NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { invitations } from '@/lib/db/schema'
import { isUuid } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string }> }

// Revoke a pending invitation. Accepted invitations cannot be revoked.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ allowUnentitled: true, platformAdmin: true })
  if (!auth.ok) return auth.res

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [revoked] = await db
    .update(invitations)
    .set({ revokedAt: new Date() })
    .where(and(eq(invitations.id, id), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)))
    .returning({ id: invitations.id })

  if (revoked) return new NextResponse(null, { status: 204 })

  const [existing] = await db
    .select({ acceptedAt: invitations.acceptedAt })
    .from(invitations)
    .where(eq(invitations.id, id))
    .limit(1)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.acceptedAt) {
    return NextResponse.json({ error: 'This invitation has already been accepted', code: 'already_accepted' }, { status: 409 })
  }
  // Already revoked: idempotent
  return new NextResponse(null, { status: 204 })
}
