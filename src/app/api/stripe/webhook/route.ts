import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accounts, stripeEvents } from '@/lib/db/schema'
import { getStripe, isWebhookConfigured } from '@/lib/billing/stripe'
import { applySubscription, customerIdOf, resolveAccountId, type StripeSubscriptionLike } from '@/lib/billing/sync'

// PUBLIC route (see middleware): authenticated by Stripe's signature over the RAW body.
// Idempotent: each event id is recorded in the same transaction that processes it, so a duplicate
// delivery is a no-op, and a processing failure rolls the record back so Stripe retries.

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function handleSubscriptionEvent(sub: StripeSubscriptionLike, created: number, hintAccountId?: string | null) {
  let accountId = await resolveAccountId(sub)
  if (!accountId && hintAccountId && UUID_RE.test(hintAccountId)) {
    const [row] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, hintAccountId)).limit(1)
    accountId = row?.id ?? null
  }
  if (!accountId) {
    console.warn(`[stripe webhook] subscription ${sub.id} does not match any account; ignoring`)
    return
  }
  // Remember the customer so later events without metadata still resolve
  const customerId = customerIdOf(sub)
  if (customerId) {
    await db
      .update(accounts)
      .set({ stripeCustomerId: customerId })
      .where(eq(accounts.id, accountId))
      .catch(() => undefined) // unique violation = customer already attached elsewhere; leave as is
  }
  await applySubscription(accountId, sub, created)
}

async function processEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      await handleSubscriptionEvent(event.data.object as unknown as StripeSubscriptionLike, event.created)
      return
    }
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'subscription' || !session.subscription) return
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id
      const sub = await getStripe().subscriptions.retrieve(subId)
      await handleSubscriptionEvent(sub as unknown as StripeSubscriptionLike, event.created, session.client_reference_id)
      return
    }
    case 'invoice.payment_failed': {
      // Status changes arrive via customer.subscription.updated (past_due); just log.
      console.warn(`[stripe webhook] payment failed (event ${event.id})`)
      return
    }
    default:
      return // unknown event types are acknowledged
  }
}

export async function POST(req: NextRequest) {
  if (!isWebhookConfigured()) {
    return NextResponse.json(
      { error: 'Billing webhook is not configured', code: 'billing_not_configured' },
      { status: 503 },
    )
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  // Must be the unparsed body: signature verification fails on re-serialized JSON
  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    await db.transaction(async tx => {
      const inserted = await tx
        .insert(stripeEvents)
        .values({ id: event.id, type: event.type })
        .onConflictDoNothing()
        .returning({ id: stripeEvents.id })
      if (inserted.length === 0) return // duplicate delivery
      await processEvent(event)
    })
  } catch (err) {
    console.error('[stripe webhook] processing failed:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
