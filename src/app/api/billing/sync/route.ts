import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApi } from '@/lib/auth/context'
import { billingNotConfiguredResponse, getStripe, isBillingConfigured } from '@/lib/billing/stripe'
import { applySubscription, canCheckoutReturnReplace } from '@/lib/billing/sync'

const bodySchema = z.object({ sessionId: z.string().min(1).max(255).startsWith('cs_') })

// Called when the user returns from Checkout so access is granted even if the webhook is slower
// than the redirect. The session must belong to the caller's account.
export async function POST(req: NextRequest) {
  const auth = await requireApi({ allowUnentitled: true, role: 'owner' })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  if (!isBillingConfigured()) return billingNotConfiguredResponse()

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid session id' }, { status: 400 })

  try {
    const session = await getStripe().checkout.sessions.retrieve(parsed.data.sessionId, {
      expand: ['subscription'],
    })

    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
    const ownsSession =
      session.client_reference_id === ctx.account.id &&
      (!ctx.account.stripeCustomerId || ctx.account.stripeCustomerId === customerId)
    // 404 rather than 403: don't confirm that someone else's session id exists
    if (!ownsSession) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const sub = session.subscription
    if (!sub || typeof sub === 'string') {
      return NextResponse.json({ synced: false, reason: 'no_subscription_yet' })
    }

    // The session id comes from the browser and may be an old one (bookmarked or stale return
    // URL). Never let it replace a row for a different subscription that currently grants access.
    // (Re-checked atomically in SQL by applySubscription; this early exit just avoids the write.)
    if (!canCheckoutReturnReplace(ctx.subscription, sub.id)) {
      return NextResponse.json({ synced: false, reason: 'stale_session' })
    }

    // Stamp with the session's own creation time, not "now": a real webhook event for this
    // subscription is always created after its checkout session, so it is never suppressed by this
    // write, while genuinely newer state already applied is not overwritten.
    const applied = await applySubscription(ctx.account.id, sub, session.created, { checkoutReturn: true })
    return NextResponse.json(
      applied ? { synced: true, status: sub.status } : { synced: false, reason: 'stale_session', status: sub.status },
    )
  } catch (err) {
    console.error('[billing/sync]', err)
    return NextResponse.json({ error: 'Could not confirm the subscription yet. Please refresh in a moment.' }, { status: 502 })
  }
}
