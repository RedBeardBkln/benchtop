import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApi } from '@/lib/auth/context'
import {
  billingNotConfiguredResponse, getAddonPriceIds, getAiPriceId, getAiPriceIds, getStripe, isAiAddonConfigured,
} from '@/lib/billing/stripe'
import { ENTITLED_STATUSES } from '@/lib/billing/entitlement'
import { seatInterval, seatItemChanges } from '@/lib/billing/seats'
import { applySubscription } from '@/lib/billing/sync'
import { AI_ADDON } from '@/lib/ai/allowance'

// Owner: set how many units of the AI add-on the subscription carries (0 removes it). Each unit
// raises the team's monthly AI allowance; Stripe prorates the change on the next invoice.

const bodySchema = z.object({ units: z.number().int().min(0).max(AI_ADDON.maxUnits) })

export async function POST(req: NextRequest) {
  const auth = await requireApi({ allowUnentitled: true, role: 'owner' })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  if (!isAiAddonConfigured()) return billingNotConfiguredResponse()
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: `Choose 0 to ${AI_ADDON.maxUnits}` }, { status: 400 })
  const { units } = parsed.data

  const subId = ctx.subscription?.stripeSubscriptionId
  if (!subId || !ENTITLED_STATUSES.includes(ctx.subscription!.status)) {
    return NextResponse.json({ error: 'Subscribe first, then add more AI', code: 'no_subscription' }, { status: 409 })
  }

  try {
    const stripe = getStripe()
    const current = await stripe.subscriptions.retrieve(subId)
    const addonPriceIds = getAddonPriceIds()
    const planItem = current.items.data.find(i => !addonPriceIds.includes(i.price.id)) ?? current.items.data[0]
    // Every item on a subscription bills on the same interval, so the add-on follows the plan's
    const priceId = getAiPriceId(seatInterval(planItem?.price.recurring?.interval))
    const changes = seatItemChanges(current.items.data, getAiPriceIds(), priceId, units)
    if (changes.length === 0) return NextResponse.json({ units })

    const updated = await stripe.subscriptions.update(subId, {
      items: changes,
      proration_behavior: 'always_invoice',
      payment_behavior: 'error_if_incomplete',
    })
    await applySubscription(ctx.account.id, updated, Math.floor(Date.now() / 1000))
    return NextResponse.json({ units })
  } catch (err) {
    const e = err as { type?: string; message?: string }
    if (e.type === 'StripeCardError') {
      return NextResponse.json({ error: `Your card was declined: ${e.message}. Update it under Manage billing.` }, { status: 402 })
    }
    console.error('[billing/ai-addon]', err)
    return NextResponse.json({ error: 'Could not change the AI add-on. Please try again.' }, { status: 502 })
  }
}
