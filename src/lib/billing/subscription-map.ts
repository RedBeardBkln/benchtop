// Pure Stripe subscription -> DB mapping helpers (no DB or Stripe imports, so they are unit-testable).
import { ENTITLED_STATUSES } from './entitlement'

// Structural subset of a Stripe Subscription so the mapping stays unit-testable without Stripe.
// In current Stripe API versions `current_period_end` lives on the subscription ITEMS; older
// versions had it on the subscription itself, so both are read.
export type StripeSubscriptionLike = {
  id: string
  status: string
  cancel_at_period_end?: boolean | null
  current_period_end?: number | null
  customer?: string | { id: string } | null
  metadata?: Record<string, string> | null
  items?: {
    data: Array<{
      current_period_end?: number | null
      price?: { id: string } | null
    }>
  } | null
}

export type MappedSubscription = {
  stripeSubscriptionId: string
  status: string
  priceId: string | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
}

export function mapSubscription(sub: StripeSubscriptionLike): MappedSubscription {
  const item = sub.items?.data?.[0]
  const periodEndUnix = item?.current_period_end ?? sub.current_period_end ?? null
  return {
    stripeSubscriptionId: sub.id,
    status: sub.status,
    priceId: item?.price?.id ?? null,
    currentPeriodEnd: periodEndUnix != null ? new Date(periodEndUnix * 1000) : null,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
  }
}

// Out-of-order guard: an event older than the newest one already applied is ignored.
// Equal timestamps apply (Stripe events within the same second; the later-processed one wins).
export function shouldApplyEvent(lastEventCreated: number | null | undefined, eventCreated: number): boolean {
  return lastEventCreated == null || eventCreated >= lastEventCreated
}

// Checkout-return sync (POST /api/billing/sync) is driven by a session id the browser supplies, so
// it may be an OLD one. It may only (a) create the first row, (b) refresh the subscription we
// already track, or (c) replace a row that currently grants no access (resubscribe). It must
// never replace a row for a different subscription that currently grants access.
export function canCheckoutReturnReplace(
  existing: { stripeSubscriptionId: string | null; status: string } | null | undefined,
  incomingSubscriptionId: string,
): boolean {
  if (!existing) return true
  if (existing.stripeSubscriptionId === incomingSubscriptionId) return true
  return !ENTITLED_STATUSES.includes(existing.status)
}

export function customerIdOf(sub: StripeSubscriptionLike): string | null {
  if (!sub.customer) return null
  return typeof sub.customer === 'string' ? sub.customer : sub.customer.id
}
