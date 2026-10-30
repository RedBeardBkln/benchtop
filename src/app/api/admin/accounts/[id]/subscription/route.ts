import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { accounts, subscriptions } from '@/lib/db/schema'
import { adminSubscriptionSchema } from '@/lib/account-schemas'
import { recordAdminAction } from '@/lib/activity-server'
import { needsStripeCancel } from '@/lib/billing/entitlement'
import { billingNotConfiguredResponse, getStripe, isBillingConfigured } from '@/lib/billing/stripe'
import { applySubscription } from '@/lib/billing/sync'
import { isUuid, notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string }> }

const LABELS = {
  cancel_at_period_end: 'subscription.cancel_at_period_end',
  resume: 'subscription.resume',
  cancel_now: 'subscription.cancel_now',
} as const

// Platform admin: cancel an account's Stripe subscription at the end of the period, undo that, or
// cancel it straight away (no refund). The local copy is updated from Stripe's answer right away;
// the webhook confirms it.
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ allowUnentitled: true, platformAdmin: true })
  if (!auth.ok) return auth.res

  const { id } = await params
  if (!isUuid(id)) return notFoundResponse()
  const [account] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1)
  if (!account || account.deletedAt) return notFoundResponse()

  const parsed = adminSubscriptionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const { action } = parsed.data

  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.accountId, id)).limit(1)
  if (!sub?.stripeSubscriptionId || !needsStripeCancel(sub)) {
    return NextResponse.json({ error: 'This account has no live Stripe subscription', code: 'no_subscription' }, { status: 409 })
  }
  if (!isBillingConfigured()) return billingNotConfiguredResponse()

  try {
    const stripe = getStripe()
    const startedAt = Math.floor(Date.now() / 1000)
    const updated = action === 'cancel_now'
      ? await stripe.subscriptions.cancel(sub.stripeSubscriptionId)
      : await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: action === 'cancel_at_period_end' })
    await applySubscription(id, updated, startedAt)
    await recordAdminAction({
      adminUserId: auth.ctx.user.id,
      accountId: id,
      action: LABELS[action],
      details: { accountName: account.name, stripeSubscriptionId: sub.stripeSubscriptionId, status: updated.status },
    })
    return NextResponse.json({ status: updated.status, cancelAtPeriodEnd: updated.cancel_at_period_end })
  } catch (err) {
    console.error('[admin/subscription]', err)
    return NextResponse.json({ error: 'Stripe could not make that change. Please try again.' }, { status: 502 })
  }
}
