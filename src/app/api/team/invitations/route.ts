import { NextRequest, NextResponse } from 'next/server'
import { and, count, eq, gt, isNull, ne } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { accountMembers, invitations } from '@/lib/db/schema'
import { teamInviteSchema } from '@/lib/account-schemas'
import { DEFAULT_INVITE_EXPIRY_DAYS, generateToken, hashToken, inviteExpiry, inviteUrl } from '@/lib/invitations'
import { canAddSeats, seatBillingState } from '@/lib/billing/seat-sync'
import { capReached } from '@/lib/billing/plans'
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

  const state = seatBillingState({
    billingExempt: ctx.account.billingExempt,
    plan: ctx.account.plan,
    freeAccess: ctx.account.freeAccess,
    subscription: ctx.subscription,
  })
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
  if (ctx.account.userCap != null) {
    // Current additional users plus invitations still waiting to be accepted
    const [[members], [invited]] = await Promise.all([
      db.select({ n: count() }).from(accountMembers)
        .where(and(eq(accountMembers.accountId, ctx.account.id), ne(accountMembers.role, 'owner'))),
      db.select({ n: count() }).from(invitations).where(and(
        eq(invitations.accountId, ctx.account.id),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
        gt(invitations.expiresAt, now),
      )),
    ])
    if (capReached(ctx.account.userCap, members.n + invited.n)) {
      return NextResponse.json(
        {
          error: `Your plan allows up to ${ctx.account.userCap} additional user${ctx.account.userCap === 1 ? '' : 's'}, counting pending invitations.`,
          code: 'user_cap',
        },
        { status: 409 },
      )
    }
  }

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
      { error: 'This email already has a Benchtop login, so it cannot join another team.', code: 'user_exists' },
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
