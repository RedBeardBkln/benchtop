import { NextRequest, NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { invitations } from '@/lib/db/schema'
import { isUuid, notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string }> }

// Revoke a pending team invitation (idempotent). No seat is billed until acceptance, so billing
// is untouched.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ allowUnentitled: true, teamAdmin: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  if (!isUuid(id)) return notFoundResponse()

  const [invite] = await db
    .select({ acceptedAt: invitations.acceptedAt })
    .from(invitations)
    .where(and(eq(invitations.id, id), eq(invitations.accountId, ctx.account.id)))
    .limit(1)
  if (!invite) return notFoundResponse()
  if (invite.acceptedAt) {
    return NextResponse.json({ error: 'This invitation has already been accepted', code: 'already_accepted' }, { status: 409 })
  }

  await db
    .update(invitations)
    .set({ revokedAt: new Date() })
    .where(and(eq(invitations.id, id), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)))
  return new NextResponse(null, { status: 204 })
}
