import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { billingNotConfiguredResponse, getStripe, isBillingConfigured } from '@/lib/billing/stripe'
import { getAppOrigin } from '@/lib/app-url'

// Opens the Stripe Customer Portal for the account's customer. Owner only.
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
  if (!ctx.account.stripeCustomerId) {
    return NextResponse.json(
      { error: 'No billing profile exists for this account yet', code: 'no_customer' },
      { status: 409 },
    )
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: ctx.account.stripeCustomerId,
      return_url: `${getAppOrigin(req.nextUrl.origin)}/settings/billing`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[billing/portal]', err)
    return NextResponse.json({ error: 'Could not open the billing portal. Please try again.' }, { status: 502 })
  }
}
