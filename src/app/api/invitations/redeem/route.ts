import { NextRequest, NextResponse } from 'next/server'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accountMembers, accounts, invitations, profiles } from '@/lib/db/schema'
import { redeemSchema } from '@/lib/account-schemas'
import { hashToken, INVITE_FAILURE_MESSAGES } from '@/lib/invitations'
import { lookupInvite } from '@/lib/invitations-server'
import { getSupabaseAdmin, isAdminConfigured } from '@/lib/supabase/admin'
import { PRIVACY_VERSION, TERMS_VERSION } from '@/lib/legal'

// PUBLIC route (no session): authenticated by possession of a valid invite token.
// Order of operations: claim token (single conditional UPDATE, race-safe) -> create pre-confirmed
// auth user -> create account/membership/profile in one DB transaction. Any failure after the
// claim is compensated (auth user deleted, token un-claimed) so a retry is possible.

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
      const [account] = await tx
        .insert(accounts)
        .values({ name: company || fullName })
        .returning({ id: accounts.id })
      await tx.insert(accountMembers).values({ accountId: account.id, userId: newUserId, role: 'owner' })
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

    return NextResponse.json({ ok: true, email: claimed.email }, { status: 201 })
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
