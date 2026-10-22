import { NextRequest, NextResponse } from 'next/server'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { invitations } from '@/lib/db/schema'
import { teamInviteSchema } from '@/lib/account-schemas'
import { DEFAULT_INVITE_EXPIRY_DAYS, generateToken, hashToken, inviteExpiry, inviteUrl } from '@/lib/invitations'
import { canAddSeats, seatBillingState } from '@/lib/billing/seat-sync'
import { accessToStore } from '@/lib/team-server'
import { getAppOrigin } from '@/lib/app-url'
import { findAuthUserIdByEmail } from '@/lib/supabase/admin'

// Invite someone to the caller's team. The seat is billed when they accept. The plaintext link
// exists only in this response.
export async function POST(req: NextRequest) {
  const auth = await requireApi({ teamAdmin: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = teamInviteSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const { email, role, access } = parsed.data

  const state = seatBillingState({ billingExempt: ctx.account.billingExempt, subscription: ctx.subscription })
  if (!canAddSeats(state)) {
    return NextResponse.json(
      {
        error: state === 'not_configured'
          ? 'Team seat billing is not configured in this environment'
          : 'An active subscription is required to add team members',
        code: state,
      },
      { status: state === 'not_configured' ? 503 : 402 },
    )
  }

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
      { error: 'There is already a pending invitation for this email.', code: 'invite_pending' },
      { status: 409 },
    )
  }

  // A login belongs to exactly one account, so an existing user can't be added to a team
  if (await findAuthUserIdByEmail(email)) {
    return NextResponse.json(
      { error: 'This email already has a benchtop login, so it cannot join another team.', code: 'user_exists' },
      { status: 409 },
    )
  }

  const token = generateToken()
  const [row] = await db
    .insert(invitations)
    .values({
      email,
      tokenHash: hashToken(token),
      accountId: ctx.account.id,
      role,
      access: await accessToStore(ctx.account.id, role, access),
      invitedBy: ctx.user.id,
      expiresAt: inviteExpiry(now, DEFAULT_INVITE_EXPIRY_DAYS),
    })
    .returning({ id: invitations.id, email: invitations.email, expiresAt: invitations.expiresAt })

  return NextResponse.json(
    { ...row, url: inviteUrl(getAppOrigin(req.nextUrl.origin), token) },
    { status: 201 },
  )
}
