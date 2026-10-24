import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type Stripe from 'stripe'
import { requireApi } from '@/lib/auth/context'
import {
  billingNotConfiguredResponse, getPlanPriceId, getSeatPriceId, getSeatPriceIds, getStripe, isBillingConfigured,
  isSeatBillingConfigured, planIntervalForPrice,
} from '@/lib/billing/stripe'
import { ENTITLED_STATUSES } from '@/lib/billing/entitlement'
import { applySubscription } from '@/lib/billing/sync'

const bodySchema = z.object({ interval: z.enum(['month', 'year']) })

// Switches the subscription between monthly and annual billing. Stripe requires every item on a
// subscription to share one interval, so the team-seat item moves with the plan. Stripe credits
// the unused part of the current period and invoices the new one straight away. Owner only.
export async function POST(req: NextRequest) {
  const auth = await requireApi({ allowUnentitled: true, role: 'owner' })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  if (!isBillingConfigured()) return billingNotConfiguredResponse()
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Choose monthly or annual billing' }, { status: 400 })
  const { interval } = parsed.data

  const subId = ctx.subscription?.stripeSubscriptionId
  if (!subId || !ENTITLED_STATUSES.includes(ctx.subscription!.status)) {
    return NextResponse.json({ error: 'There is no active subscription to change', code: 'no_subscription' }, { status: 409 })
  }

  try {
    const stripe = getStripe()
    const current = await stripe.subscriptions.retrieve(subId)
    const seatPriceIds = getSeatPriceIds()
    const planItem = current.items.data.find(i => !seatPriceIds.includes(i.price.id)) ?? current.items.data[0]
    if (!planItem) return NextResponse.json({ error: 'The subscription has no plan' }, { status: 409 })
    if (planIntervalForPrice(planItem.price.id) === interval) {
      return NextResponse.json({ error: `You're already billed ${interval === 'year' ? 'annually' : 'monthly'}` }, { status: 409 })
    }
    const seatItems = current.items.data.filter(i => seatPriceIds.includes(i.price.id))
    if (seatItems.length > 0 && !isSeatBillingConfigured()) {
      return NextResponse.json({ error: 'Team seat billing is not configured' }, { status: 503 })
    }

    const items: Stripe.SubscriptionUpdateParams.Item[] = [
      { id: planItem.id, price: getPlanPriceId(interval) },
      ...seatItems.map(i => ({ id: i.id, price: getSeatPriceId(interval), quantity: i.quantity ?? 0 })),
    ]
    const updated = await stripe.subscriptions.update(subId, {
      items,
      proration_behavior: 'always_invoice',
      // Refuse the change (rather than leave the subscription unpaid) if the new invoice can't be paid
      payment_behavior: 'error_if_incomplete',
    })
    await applySubscription(ctx.account.id, updated, Math.floor(Date.now() / 1000))
    return NextResponse.json({ interval, status: updated.status })
  } catch (err) {
    const e = err as { type?: string; message?: string }
    if (e.type === 'StripeCardError') {
      return NextResponse.json({ error: `Your card was declined: ${e.message}. Update it under Manage billing.` }, { status: 402 })
    }
    console.error('[billing/interval]', err)
    return NextResponse.json({ error: 'Could not change the billing interval. Please try again.' }, { status: 502 })
  }
}
