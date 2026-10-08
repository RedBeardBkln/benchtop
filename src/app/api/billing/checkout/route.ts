import { NextRequest, NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { accounts } from '@/lib/db/schema'
import { isEntitled } from '@/lib/billing/entitlement'
import { billingNotConfiguredResponse, getPriceId, getStripe, isBillingConfigured } from '@/lib/billing/stripe'
import { getAppOrigin } from '@/lib/app-url'

// Starts a Stripe Checkout (subscription mode). Owner only; allowed while the account is unentitled.
export async function POST(req: NextRequest) {
  const auth = await requireApi({ allowUnentitled: true, role: 'owner' })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  if (ctx.account.billingExempt) {
    return NextResponse.json(
      { error: 'This account does not require a subscription', code: 'billing_exempt' },
      { status: 409 },
    )
  }
  if (!isBillingConfigured()) return billingNotConfiguredResponse()

  if (ctx.subscription && isEntitled({ billingExempt: false, status: ctx.subscription.status })) {
    return NextResponse.json(
      { error: 'This account already has an active subscription', code: 'already_subscribed' },
      { status: 409 },
    )
  }

  try {
    const stripe = getStripe()

    let customerId = ctx.account.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: ctx.user.email,
        name: ctx.account.name,
        metadata: { account_id: ctx.account.id },
      })
      // Only set if still empty, so two concurrent checkouts can't end up with different customers
      const [saved] = await db
        .update(accounts)
        .set({ stripeCustomerId: customer.id })
        .where(and(eq(accounts.id, ctx.account.id), isNull(accounts.stripeCustomerId)))
        .returning({ stripeCustomerId: accounts.stripeCustomerId })
      if (saved) {
        customerId = saved.stripeCustomerId
      } else {
        const [row] = await db
          .select({ stripeCustomerId: accounts.stripeCustomerId })
          .from(accounts)
          .where(eq(accounts.id, ctx.account.id))
          .limit(1)
        customerId = row?.stripeCustomerId ?? customer.id
      }
    }

    const origin = getAppOrigin(req.nextUrl.origin)
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId ?? undefined,
      line_items: [{ price: getPriceId(), quantity: 1 }],
      client_reference_id: ctx.account.id,
      subscription_data: { metadata: { account_id: ctx.account.id } },
      success_url: `${origin}/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/settings/billing?checkout=cancelled`,
    })

    if (!session.url) {
      return NextResponse.json({ error: 'Could not start checkout' }, { status: 502 })
    }
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[billing/checkout]', err)
    return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 502 })
  }
}
