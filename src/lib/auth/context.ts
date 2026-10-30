import { after, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { accountMembers, accounts, profiles, subscriptions } from '@/lib/db/schema'
import { isDevBypassActive, isEntitled } from '@/lib/billing/entitlement'
import { asAccountPlan, hasFreeAccess, userCap, type AccountPlan } from '@/lib/billing/plans'
import { needsLegalAcceptance } from '@/lib/legal'
import { METHOD_HEADER, PATH_HEADER } from '@/lib/activity'
import { recordActivity, touchLastSeen } from '@/lib/activity-server'
import {
  accessForRole, canEditLibrary, DEFAULT_MEMBER_ACCESS, isTeamAdmin, memberAccessSchema,
  type MemberAccess, type MemberRole,
} from '@/lib/team-access'

export type { MemberRole } from '@/lib/team-access'

export type AuthContext = {
  user: { id: string; email: string | undefined }
  account: {
    id: string
    name: string
    billingExempt: boolean
    plan: AccountPlan
    // End of the free period or paid trial; null for free for life or when there never was one
    freeUntil: Date | null
    // Free for life, or still inside the free period / trial
    freeAccess: boolean
    // Cap on additional users (free for life only); null = no cap
    userCap: number | null
    stripeCustomerId: string | null
    // Team logo applied by an owner or admin (see lib/logo.ts)
    logoPath: string | null
    createdAt: Date
  }
  role: MemberRole
  // What a 'member' may see and edit; null for owners and admins (unrestricted)
  access: MemberAccess | null
  profile: typeof profiles.$inferSelect | null
  subscription: typeof subscriptions.$inferSelect | null
  entitled: boolean
  isPlatformAdmin: boolean
}

export type ContextFailure = 'unauthenticated' | 'no_account' | 'suspended' | 'not_entitled'

export type ContextResult =
  | { ok: true; ctx: AuthContext }
  // `ctx` is present for suspended and not_entitled so settings/billing code can still use it
  | { ok: false; reason: ContextFailure; ctx?: AuthContext }

// Resolves who is calling and which account they belong to. Deny by default: a signed-in user
// with no account_members row gets 'no_account' (no data), whatever else is true.
export async function getContext(): Promise<ContextResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'unauthenticated' }

  const [row] = await db
    .select({ role: accountMembers.role, access: accountMembers.access, account: accounts })
    .from(accountMembers)
    .innerJoin(accounts, eq(accountMembers.accountId, accounts.id))
    .where(eq(accountMembers.userId, user.id))
    .limit(1)

  if (!row || row.account.deletedAt) return { ok: false, reason: 'no_account' }

  const [[profile], [subscription]] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1),
    db.select().from(subscriptions).where(eq(subscriptions.accountId, row.account.id)).limit(1),
  ])

  const freeAccess = hasFreeAccess(row.account)
  const entitled = isEntitled({
    billingExempt: row.account.billingExempt,
    freeAccess,
    status: subscription?.status ?? null,
    devBypass: isDevBypassActive(),
  })

  const role: MemberRole = row.role === 'owner' || row.role === 'admin' ? row.role : 'member'
  // A malformed stored value falls back to the restrictive default, never to full access
  const stored = memberAccessSchema.safeParse(row.access)
  const access = accessForRole(role, stored.success ? stored.data : DEFAULT_MEMBER_ACCESS)

  const ctx: AuthContext = {
    user: { id: user.id, email: user.email },
    account: {
      id: row.account.id,
      name: row.account.name,
      billingExempt: row.account.billingExempt,
      plan: asAccountPlan(row.account.plan),
      freeUntil: row.account.freeUntil,
      freeAccess,
      userCap: userCap(row.account),
      stripeCustomerId: row.account.stripeCustomerId,
      logoPath: row.account.logoPath,
      createdAt: row.account.createdAt,
    },
    role,
    access,
    profile: profile ?? null,
    subscription: subscription ?? null,
    entitled,
    isPlatformAdmin: profile?.isPlatformAdmin ?? false,
  }

  // A platform admin suspends an account or a person; platform admins themselves never are
  if (!ctx.isPlatformAdmin && (row.account.suspendedAt || profile?.suspendedAt)) {
    return { ok: false, reason: 'suspended', ctx }
  }
  return entitled ? { ok: true, ctx } : { ok: false, reason: 'not_entitled', ctx }
}

// After the response: the activity log entry for this call (changes only) and the last-seen time
async function trackUse(ctx: AuthContext, api: boolean) {
  let method: string | null = null
  let path: string | null = null
  if (api) {
    const h = await headers()
    method = h.get(METHOD_HEADER)
    path = h.get(PATH_HEADER)
  }
  after(async () => {
    await Promise.all([
      api ? recordActivity({ accountId: ctx.account.id, userId: ctx.user.id, method, path }) : null,
      touchLastSeen(ctx.user.id),
    ])
  })
}

export type RequireOptions = {
  // Settings, billing APIs and the like must work for signed-in members without a subscription
  allowUnentitled?: boolean
  role?: 'owner'
  // Owners and admins: team management
  teamAdmin?: boolean
  // Changes to the ingredient library, suppliers, equipment or lab intake
  libraryEdit?: boolean
  platformAdmin?: boolean
  // Only for accepting the current Terms and Privacy Policy, which every other route requires first
  allowWithoutTerms?: boolean
}

function forbidden(error: string) {
  return NextResponse.json({ error, code: 'forbidden' }, { status: 403 })
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

  if (!result.ok && result.reason === 'suspended') {
    return {
      ok: false,
      res: NextResponse.json({ error: 'This account has been suspended', code: 'account_suspended' }, { status: 403 }),
    }
  }

  const ctx = result.ctx!
  if (!opts.allowWithoutTerms && needsLegalAcceptance(ctx.profile)) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: 'Please accept the current Terms of Service and Privacy Policy first', code: 'terms_required' },
        { status: 403 },
      ),
    }
  }
  if (!result.ok && !opts.allowUnentitled) {
    return {
      ok: false,
      res: NextResponse.json({ error: 'An active subscription is required', code: 'subscription_required' }, { status: 402 }),
    }
  }
  if (opts.role === 'owner' && ctx.role !== 'owner') {
    return { ok: false, res: forbidden('Only the account owner can do this') }
  }
  if (opts.teamAdmin && !isTeamAdmin(ctx.role)) {
    return { ok: false, res: forbidden('Only account admins can do this') }
  }
  if (opts.libraryEdit && !canEditLibrary(ctx.access)) {
    return { ok: false, res: forbidden('You have view-only access to the ingredient library') }
  }
  if (opts.platformAdmin && !ctx.isPlatformAdmin) {
    return { ok: false, res: NextResponse.json({ error: 'Forbidden', code: 'forbidden' }, { status: 403 }) }
  }
  await trackUse(ctx, true)
  return { ok: true, ctx }
}

// For server pages: redirects instead of returning a response.
export async function requirePage(opts: RequireOptions = {}): Promise<AuthContext> {
  const result = await getContext()

  if (!result.ok && result.reason === 'unauthenticated') redirect('/login')
  if (!result.ok && result.reason === 'no_account') redirect('/no-account')
  if (!result.ok && result.reason === 'suspended') redirect('/suspended')

  const ctx = result.ctx!
  if (!opts.allowWithoutTerms && needsLegalAcceptance(ctx.profile)) redirect('/accept-terms')
  if (!result.ok && !opts.allowUnentitled) redirect('/settings/billing?reason=subscription_required')
  if (opts.role === 'owner' && ctx.role !== 'owner') notFound()
  if (opts.teamAdmin && !isTeamAdmin(ctx.role)) notFound()
  if (opts.platformAdmin && !ctx.isPlatformAdmin) notFound()
  await trackUse(ctx, false)
  return ctx
}
