import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { invitations } from '@/lib/db/schema'
import { createInviteSchema } from '@/lib/account-schemas'
import {
  DEFAULT_INVITE_EXPIRY_DAYS,
  deriveStatus,
  generateToken,
  hashToken,
  inviteExpiry,
  inviteUrl,
} from '@/lib/invitations'
import { getAppOrigin } from '@/lib/app-url'
import { findAuthUserIdByEmail } from '@/lib/supabase/admin'

// Platform-admin only. Never returns a token: the plaintext link exists only in the POST response.

export async function GET() {
  const auth = await requireApi({ allowUnentitled: true, platformAdmin: true })
  if (!auth.ok) return auth.res

  const rows = await db.select().from(invitations).orderBy(desc(invitations.createdAt)).limit(500)
  const now = new Date()
  return NextResponse.json(
    rows.map(r => ({
      id: r.id,
      email: r.email,
      note: r.note,
      status: deriveStatus(r, now),
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      acceptedAt: r.acceptedAt,
      revokedAt: r.revokedAt,
    })),
  )
}

export async function POST(req: NextRequest) {
  const auth = await requireApi({ allowUnentitled: true, platformAdmin: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = createInviteSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const { email, note, expiresInDays } = parsed.data

  const now = new Date()
  const [pending] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(
      and(
        eq(invitations.email, email),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
        gt(invitations.expiresAt, now),
      ),
    )
    .limit(1)
  if (pending) {
    return NextResponse.json(
      { error: 'There is already a pending invitation for this email. Revoke it first.', code: 'invite_pending' },
      { status: 409 },
    )
  }

  if (await findAuthUserIdByEmail(email)) {
    return NextResponse.json(
      { error: 'A user with this email already exists.', code: 'user_exists' },
      { status: 409 },
    )
  }

  const token = generateToken()
  const expiresAt = inviteExpiry(now, expiresInDays ?? DEFAULT_INVITE_EXPIRY_DAYS)
  const [row] = await db
    .insert(invitations)
    .values({
      email,
      tokenHash: hashToken(token),
      note: note || null,
      invitedBy: ctx.user.id,
      expiresAt,
    })
    .returning({ id: invitations.id, email: invitations.email, expiresAt: invitations.expiresAt })

  return NextResponse.json(
    { ...row, url: inviteUrl(getAppOrigin(req.nextUrl.origin), token) },
    { status: 201 },
  )
}
