import { NextRequest, NextResponse } from 'next/server'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accountMembers, accounts, invitations, profiles } from '@/lib/db/schema'
import { redeemSchema } from '@/lib/account-schemas'
import { hashToken, INVITE_FAILURE_MESSAGES } from '@/lib/invitations'
import { lookupInvite } from '@/lib/invitations-server'
import { getSupabaseAdmin, isAdminConfigured } from '@/lib/supabase/admin'
import { PRIVACY_VERSION, TERMS_VERSION } from '@/lib/legal'
import { syncSeats } from '@/lib/billing/seat-sync'
import { accessForRole, memberAccessSchema } from '@/lib/team-access'

// PUBLIC route (no session): authenticated by possession of a valid invite token.
// Order of operations: claim token (single conditional UPDATE, race-safe) -> create pre-confirmed
// auth user -> create account/membership/profile in one DB transaction. Any failure after the
// claim is compensated (auth user deleted, token un-claimed) so a retry is possible.
// A team invitation (account_id set) joins that account instead of creating one, and its seat is
// then billed.

const GENERIC_ERROR = 'We could not complete your signup. Please try again or contact the person who invited you.'

async function unclaim(tokenHash: string) {
  await db
    .update(invitations)
    .set({ acceptedAt: null, acceptedBy: null })
    .where(eq(invitations.tokenHash, tokenHash))
}

export async function POST(req: NextRequest) {
  const parsed = redeemSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const { token, fullName, company, password } = parsed.data

  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: 'Signup is not available in this environment', code: 'signup_not_configured' },
      { status: 503 },
    )
  }

  const tokenHash = hashToken(token)

  // Claim: succeeds for exactly one concurrent caller
  const [claimed] = await db
    .update(invitations)
    .set({ acceptedAt: new Date() })
    .where(
      and(
        eq(invitations.tokenHash, tokenHash),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .returning()

  if (!claimed) {
    const lookup = await lookupInvite(token)
    const reason = lookup.ok ? 'invalid' : lookup.reason
    return NextResponse.json({ error: INVITE_FAILURE_MESSAGES[reason], code: reason }, { status: 410 })
  }

  // A team invitation whose account has since been deleted can't be used
  let teamAccountId: string | null = null
  if (claimed.accountId) {
    const [account] = await db
      .select({ id: accounts.id, deletedAt: accounts.deletedAt })
      .from(accounts)
      .where(eq(accounts.id, claimed.accountId))
      .limit(1)
    if (!account || account.deletedAt) {
      await unclaim(tokenHash)
      return NextResponse.json({ error: INVITE_FAILURE_MESSAGES.invalid, code: 'invalid' }, { status: 410 })
    }
    teamAccountId = account.id
  }

  const admin = getSupabaseAdmin()
  let userId: string | null = null
  try {
    const { data, error } = await admin.auth.admin.createUser({
      email: claimed.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (error || !data.user) {
      await unclaim(tokenHash)
      const msg = error?.message?.toLowerCase() ?? ''
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Please sign in instead.', code: 'email_exists' },
          { status: 409 },
        )
      }
      console.error('[redeem] createUser failed:', error?.message)
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 })
    }
    userId = data.user.id

    const newUserId = userId
    const now = new Date()
    await db.transaction(async tx => {
      if (teamAccountId) {
        const role = claimed.role === 'admin' ? 'admin' : 'member'
        const stored = memberAccessSchema.safeParse(claimed.access)
        await tx.insert(accountMembers).values({
          accountId: teamAccountId,
          userId: newUserId,
          role,
          access: accessForRole(role, stored.success ? stored.data : undefined),
        })
      } else {
        const [account] = await tx
          .insert(accounts)
          .values({ name: company || fullName })
          .returning({ id: accounts.id })
        await tx.insert(accountMembers).values({ accountId: account.id, userId: newUserId, role: 'owner' })
      }
      await tx.insert(profiles).values({
        userId: newUserId,
        fullName,
        company: company ?? null,
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: now,
        privacyVersion: PRIVACY_VERSION,
        privacyAcceptedAt: now,
      })
      await tx.update(invitations).set({ acceptedBy: newUserId }).where(eq(invitations.id, claimed.id))
    })

    if (teamAccountId) {
      // The member is in either way; a billing failure is logged and shows on the team page
      // (seats billed vs used) where an admin can retry it.
      const seats = await syncSeats(teamAccountId).catch(err => ({ ok: false as const, error: String(err) }))
      if (!seats.ok) console.error('[redeem] seat sync failed:', seats.error)
    }

    return NextResponse.json({ ok: true, email: claimed.email, team: Boolean(teamAccountId) }, { status: 201 })
  } catch (err) {
    console.error('[redeem] failed after claiming invite:', err)
    // Compensate so the invitee can retry and no orphan auth user is left behind
    if (userId) {
      await admin.auth.admin.deleteUser(userId).catch(e => console.error('[redeem] cleanup deleteUser failed:', e))
    }
    await unclaim(tokenHash).catch(e => console.error('[redeem] cleanup unclaim failed:', e))
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 })
  }
}
