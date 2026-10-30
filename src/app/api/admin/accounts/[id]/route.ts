import { NextRequest, NextResponse } from 'next/server'
import { asc, eq } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { accountMembers, accounts, profiles, subscriptions } from '@/lib/db/schema'
import { accountPlanUpdateSchema, adminDeleteAccountSchema } from '@/lib/account-schemas'
import { deleteAccount } from '@/lib/account-deletion'
import { recordAdminAction } from '@/lib/activity-server'
import { getAccountUsage, getAuthUsers } from '@/lib/admin-server'
import { ENTITLED_STATUSES } from '@/lib/billing/entitlement'
import { asAccountPlan, checkoutTrialEnd, hasFreeAccess } from '@/lib/billing/plans'
import { syncSeats } from '@/lib/billing/seat-sync'
import { getStripe, isBillingConfigured } from '@/lib/billing/stripe'
import { applySubscription } from '@/lib/billing/sync'
import { isUuid, notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string }> }

async function loadAccount(id: string) {
  if (!isUuid(id)) return null
  const [account] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1)
  return account && !account.deletedAt ? account : null
}

// Platform admin: one account in full: plan, subscription, people, usage.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ allowUnentitled: true, platformAdmin: true })
  if (!auth.ok) return auth.res

  const { id } = await params
  const account = await loadAccount(id)
  if (!account) return notFoundResponse()

  const [[subscription], members, usage] = await Promise.all([
    db.select().from(subscriptions).where(eq(subscriptions.accountId, id)).limit(1),
    db
      .select({
        userId: accountMembers.userId,
        role: accountMembers.role,
        createdAt: accountMembers.createdAt,
        fullName: profiles.fullName,
        lastSeenAt: profiles.lastSeenAt,
        suspendedAt: profiles.suspendedAt,
        isPlatformAdmin: profiles.isPlatformAdmin,
      })
      .from(accountMembers)
      .leftJoin(profiles, eq(profiles.userId, accountMembers.userId))
      .where(eq(accountMembers.accountId, id))
      .orderBy(asc(accountMembers.createdAt)),
    getAccountUsage(id),
  ])
  const users = await getAuthUsers(members.map(m => m.userId))

  return NextResponse.json({
    id: account.id,
    name: account.name,
    billingExempt: account.billingExempt,
    plan: asAccountPlan(account.plan),
    freeUntil: account.freeUntil,
    freeAccess: hasFreeAccess(account),
    maxUsers: account.maxUsers,
    additionalUsers: members.filter(m => m.role !== 'owner').length,
    stripeCustomerId: account.stripeCustomerId,
    suspendedAt: account.suspendedAt,
    suspendedReason: account.suspendedReason,
    createdAt: account.createdAt,
    isOwnAccount: account.id === auth.ctx.account.id,
    subscription: subscription
      ? {
          status: subscription.status,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          seatQuantity: subscription.seatQuantity,
          priceId: subscription.priceId,
        }
      : null,
    members: members.map(m => ({
      ...m,
      email: users.get(m.userId)?.email ?? null,
      lastSignInAt: users.get(m.userId)?.lastSignInAt ?? null,
    })),
    usage: usage.get(id) ?? null,
  })
}

// Platform admin: change an account's plan (see accountPlanUpdateSchema for what each plan takes).
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ allowUnentitled: true, platformAdmin: true })
  if (!auth.ok) return auth.res

  const { id } = await params
  const account = await loadAccount(id)
  if (!account) return notFoundResponse()

  const parsed = accountPlanUpdateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const { plan, freeUntil, maxUsers } = parsed.data

  if (account.billingExempt) {
    return NextResponse.json(
      { error: 'Internal accounts are billing exempt and have no plan to change', code: 'billing_exempt' },
      { status: 409 },
    )
  }

  const [updated] = await db
    .update(accounts)
    .set({
      plan,
      freeUntil: plan === 'free_lifetime' || !freeUntil ? null : new Date(freeUntil),
      maxUsers: plan === 'free_lifetime' ? maxUsers ?? null : null,
    })
    .where(eq(accounts.id, id))
    .returning()

  await recordAdminAction({
    adminUserId: auth.ctx.user.id,
    accountId: id,
    action: 'plan.change',
    details: {
      accountName: account.name,
      from: { plan: account.plan, freeUntil: account.freeUntil, maxUsers: account.maxUsers },
      to: { plan: updated.plan, freeUntil: updated.freeUntil, maxUsers: updated.maxUsers },
    },
  })

  // Seats are free on a free plan and billed on a subscription; bring Stripe in line either way
  const seats = await syncSeats(id).catch(err => ({ ok: false as const, error: String(err) }))
  if (!seats.ok) console.error('[admin/accounts] seat sync failed:', seats.error)

  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.accountId, id)).limit(1)
  const stillSubscribed = Boolean(sub?.stripeSubscriptionId) && ENTITLED_STATUSES.includes(sub!.status) && !sub!.cancelAtPeriodEnd
  const warnings: string[] = []

  // Free time added to a running subscription: Stripe doesn't charge again until it ends
  const trialEnd = stillSubscribed && plan !== 'free_lifetime' ? checkoutTrialEnd(updated) : undefined
  const currentEnd = sub?.currentPeriodEnd ? Math.floor(sub.currentPeriodEnd.getTime() / 1000) : 0
  if (trialEnd && trialEnd > currentEnd) {
    if (!isBillingConfigured()) {
      warnings.push('Billing is not configured here, so Stripe was not told about the extra free time.')
    } else {
      try {
        const stripeSub = await getStripe().subscriptions.update(sub!.stripeSubscriptionId!, {
          trial_end: trialEnd,
          proration_behavior: 'none',
        })
        await applySubscription(id, stripeSub, Math.floor(Date.now() / 1000))
      } catch (err) {
        console.error('[admin/accounts] stripe trial extension failed:', err)
        warnings.push('The free time is saved here, but Stripe could not be updated, so the next charge date is unchanged.')
      }
    }
  }

  // Changing the plan never cancels Stripe; a running subscription keeps billing until canceled
  if (plan === 'free_lifetime' && stillSubscribed) {
    warnings.push('This account still has an active Stripe subscription, which keeps billing until it is canceled. Cancel it in the Subscription section.')
  }

  return NextResponse.json({
    id: updated.id,
    plan: updated.plan,
    freeUntil: updated.freeUntil,
    maxUsers: updated.maxUsers,
    warning: warnings.join(' ') || null,
  })
}

// Platform admin: permanently delete an account and everything in it
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ allowUnentitled: true, platformAdmin: true })
  if (!auth.ok) return auth.res

  const { id } = await params
  const account = await loadAccount(id)
  if (!account) return notFoundResponse()

  if (account.billingExempt || account.id === auth.ctx.account.id) {
    return NextResponse.json(
      { error: 'Your own account and internal accounts can’t be deleted here', code: 'account_protected' },
      { status: 403 },
    )
  }

  const parsed = adminDeleteAccountSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success || parsed.data.confirmName !== account.name.trim()) {
    return NextResponse.json({ error: 'Type the account’s name exactly to confirm', code: 'confirm_mismatch' }, { status: 400 })
  }

  const members = await db.select({ userId: accountMembers.userId }).from(accountMembers).where(eq(accountMembers.accountId, id))
  const emails = await getAuthUsers(members.map(m => m.userId))

  const result = await deleteAccount(id)
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status })

  await recordAdminAction({
    adminUserId: auth.ctx.user.id,
    accountId: id,
    action: 'account.delete',
    details: { accountName: account.name, people: [...emails.values()].map(u => u.email), loginsRemoved: result.loginsRemoved },
  })
  return NextResponse.json({ ok: true, loginsRemoved: result.loginsRemoved })
}
