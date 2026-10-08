import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accounts, subscriptions } from '@/lib/db/schema'
import { ENTITLED_STATUSES } from './entitlement'
import {
  customerIdOf,
  mapSubscription,
  type StripeSubscriptionLike,
} from './subscription-map'

export { canCheckoutReturnReplace, customerIdOf, mapSubscription, shouldApplyEvent } from './subscription-map'
export type { MappedSubscription, StripeSubscriptionLike } from './subscription-map'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Which account does a Stripe subscription belong to? metadata.account_id first, then the
// customer id we stored on the account. Returns null when neither matches (event is ignored).
export async function resolveAccountId(sub: StripeSubscriptionLike): Promise<string | null> {
  const meta = sub.metadata?.account_id
  if (meta && UUID_RE.test(meta)) {
    const [row] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, meta)).limit(1)
    if (row) return row.id
  }
  const customerId = customerIdOf(sub)
  if (customerId) {
    const [row] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.stripeCustomerId, customerId))
      .limit(1)
    if (row) return row.id
  }
  return null
}

// Upserts the account's subscription row unless a newer event has already been applied.
// Returns true when the row was written.
//
// `checkoutReturn: true` (browser-supplied session id, see /api/billing/sync) additionally refuses
// to replace a row for a DIFFERENT subscription that currently grants access. That condition is
// evaluated atomically in the same statement as the out-of-order guard.
export async function applySubscription(
  accountId: string,
  sub: StripeSubscriptionLike,
  eventCreated: number,
  opts: { checkoutReturn?: boolean } = {},
): Promise<boolean> {
  const mapped = mapSubscription(sub)
  const values = {
    accountId,
    stripeSubscriptionId: mapped.stripeSubscriptionId,
    status: mapped.status,
    priceId: mapped.priceId,
    currentPeriodEnd: mapped.currentPeriodEnd,
    cancelAtPeriodEnd: mapped.cancelAtPeriodEnd,
    lastEventCreated: eventCreated,
    updatedAt: new Date(),
  }
  const written = await db
    .insert(subscriptions)
    .values(values)
    .onConflictDoUpdate({
      target: subscriptions.accountId,
      set: {
        stripeSubscriptionId: values.stripeSubscriptionId,
        status: values.status,
        priceId: values.priceId,
        currentPeriodEnd: values.currentPeriodEnd,
        cancelAtPeriodEnd: values.cancelAtPeriodEnd,
        lastEventCreated: values.lastEventCreated,
        updatedAt: values.updatedAt,
      },
      // Out-of-order guard evaluated atomically in SQL
      setWhere: opts.checkoutReturn
        ? sql`(${subscriptions.lastEventCreated} is null or ${subscriptions.lastEventCreated} <= ${eventCreated})
          and (${subscriptions.stripeSubscriptionId} = ${values.stripeSubscriptionId}
            or ${subscriptions.status} not in (${sql.join(ENTITLED_STATUSES.map(s => sql`${s}`), sql`, `)}))`
        : sql`${subscriptions.lastEventCreated} is null or ${subscriptions.lastEventCreated} <= ${eventCreated}`,
    })
    .returning({ accountId: subscriptions.accountId })
  return written.length > 0
}
