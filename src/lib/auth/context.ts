import { NextResponse } from 'next/server'
import { notFound, redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { accountMembers, accounts, profiles, subscriptions } from '@/lib/db/schema'
import { isDevBypassActive, isEntitled } from '@/lib/billing/entitlement'

export type MemberRole = 'owner' | 'member'

export type AuthContext = {
  user: { id: string; email: string | undefined }
  account: {
    id: string
    name: string
    billingExempt: boolean
    stripeCustomerId: string | null
    createdAt: Date
  }
  role: MemberRole
  profile: typeof profiles.$inferSelect | null
  subscription: typeof subscriptions.$inferSelect | null
  entitled: boolean
  isPlatformAdmin: boolean
}

export type ContextFailure = 'unauthenticated' | 'no_account' | 'not_entitled'

export type ContextResult =
  | { ok: true; ctx: AuthContext }
  // `ctx` is present for not_entitled so settings/billing code can still use it
  | { ok: false; reason: ContextFailure; ctx?: AuthContext }

// Resolves who is calling and which account they belong to. Deny by default: a signed-in user
// with no account_members row gets 'no_account' (no data), whatever else is true.
export async function getContext(): Promise<ContextResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'unauthenticated' }

  const [row] = await db
    .select({ role: accountMembers.role, account: accounts })
    .from(accountMembers)
    .innerJoin(accounts, eq(accountMembers.accountId, accounts.id))
    .where(eq(accountMembers.userId, user.id))
    .limit(1)

  if (!row || row.account.deletedAt) return { ok: false, reason: 'no_account' }

  const [[profile], [subscription]] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1),
    db.select().from(subscriptions).where(eq(subscriptions.accountId, row.account.id)).limit(1),
  ])

  const entitled = isEntitled({
    billingExempt: row.account.billingExempt,
    status: subscription?.status ?? null,
    devBypass: isDevBypassActive(),
  })

  const ctx: AuthContext = {
    user: { id: user.id, email: user.email },
    account: {
      id: row.account.id,
      name: row.account.name,
      billingExempt: row.account.billingExempt,
      stripeCustomerId: row.account.stripeCustomerId,
      createdAt: row.account.createdAt,
    },
    role: row.role === 'owner' ? 'owner' : 'member',
    profile: profile ?? null,
    subscription: subscription ?? null,
    entitled,
    isPlatformAdmin: profile?.isPlatformAdmin ?? false,
  }

  return entitled ? { ok: true, ctx } : { ok: false, reason: 'not_entitled', ctx }
}

export type RequireOptions = {
  // Settings, billing APIs and the like must work for signed-in members without a subscription
  allowUnentitled?: boolean
  role?: MemberRole
  platformAdmin?: boolean
}

export type ApiAuth = { ok: true; ctx: AuthContext } | { ok: false; res: NextResponse }

// For route handlers:  const auth = await requireApi(); if (!auth.ok) return auth.res
export async function requireApi(opts: RequireOptions = {}): Promise<ApiAuth> {
  const result = await getContext()

  if (!result.ok && result.reason === 'unauthenticated') {
    return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!result.ok && result.reason === 'no_account') {
    return {
      ok: false,
      res: NextResponse.json({ error: 'No account is associated with this user', code: 'no_account' }, { status: 403 }),
    }
  }

  const ctx = result.ctx!
  if (!result.ok && !opts.allowUnentitled) {
    return {
      ok: false,
      res: NextResponse.json({ error: 'An active subscription is required', code: 'subscription_required' }, { status: 402 }),
    }
  }
  if (opts.role === 'owner' && ctx.role !== 'owner') {
    return { ok: false, res: NextResponse.json({ error: 'Only the account owner can do this', code: 'forbidden' }, { status: 403 }) }
  }
  if (opts.platformAdmin && !ctx.isPlatformAdmin) {
    return { ok: false, res: NextResponse.json({ error: 'Forbidden', code: 'forbidden' }, { status: 403 }) }
  }
  return { ok: true, ctx }
}

// For server pages: redirects instead of returning a response.
export async function requirePage(opts: RequireOptions = {}): Promise<AuthContext> {
  const result = await getContext()

  if (!result.ok && result.reason === 'unauthenticated') redirect('/login')
  if (!result.ok && result.reason === 'no_account') redirect('/no-account')

  const ctx = result.ctx!
  if (!result.ok && !opts.allowUnentitled) redirect('/settings/billing?reason=subscription_required')
  if (opts.role === 'owner' && ctx.role !== 'owner') notFound()
  if (opts.platformAdmin && !ctx.isPlatformAdmin) notFound()
  return ctx
}
