import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accountMembers, accounts, subscriptions } from '@/lib/db/schema'
import { ENTITLED_STATUSES, isDevBypassActive } from './entitlement'
import { getSeatPriceId, getSeatPriceIds, getStripe, isSeatBillingConfigured } from './stripe'
import { billableSeats, seatInterval, seatItemChanges } from './seats'
import { hasFreeAccess } from './plans'

// Can this account add team members right now, and how would they be billed?
//   exempt          internal account; seats are free
//   free            free for life, or in a free period / trial without a subscription yet; seats
//                   are free until the account subscribes (checkout then bills them)
//   dev_bypass      local development without Stripe; seats are free
//   ready           active subscription and seat prices configured
//   not_configured  the seat prices (or Stripe itself) are not configured
//   no_subscription no subscription that grants access
export type SeatBillingState = 'exempt' | 'free' | 'dev_bypass' | 'ready' | 'not_configured' | 'no_subscription'

export function seatBillingState(input: {
  billingExempt: boolean
  plan?: string
  freeAccess?: boolean
  subscription: { stripeSubscriptionId: string | null; status: string } | null
}): SeatBillingState {
  if (input.billingExempt) return 'exempt'
  if (input.plan === 'free_lifetime') return 'free'
  const sub = input.subscription
  const subscribed = Boolean(sub?.stripeSubscriptionId) && ENTITLED_STATUSES.includes(sub!.status)
  if (!subscribed && input.freeAccess) return 'free'
  if (!subscribed) return isDevBypassActive() ? 'dev_bypass' : 'no_subscription'
  return isSeatBillingConfigured() ? 'ready' : 'not_configured'
}

export function canAddSeats(state: SeatBillingState): boolean {
  return state === 'exempt' || state === 'free' || state === 'dev_bypass' || state === 'ready'
}

export async function countSeats(accountId: string): Promise<number> {
  const members = await db
    .select({ role: accountMembers.role })
    .from(accountMembers)
    .where(eq(accountMembers.accountId, accountId))
  return billableSeats(members)
}

export type SeatSyncResult =
  | { ok: true; seats: number; billed: boolean }
  | { ok: false; seats: number; error: string }

// Brings the Stripe seat quantity in line with the account's current members. Idempotent; call it
// after every membership change. Stripe prorates the change on the next invoice.
export async function syncSeats(accountId: string): Promise<SeatSyncResult> {
  const seats = await countSeats(accountId)
  const [[account], [sub]] = await Promise.all([
    db.select({ billingExempt: accounts.billingExempt, plan: accounts.plan, freeUntil: accounts.freeUntil }).from(accounts).where(eq(accounts.id, accountId)).limit(1),
    db.select().from(subscriptions).where(eq(subscriptions.accountId, accountId)).limit(1),
  ])
  if (!account) return { ok: false, seats, error: 'Account not found' }

  const state = seatBillingState({
    billingExempt: account.billingExempt,
    plan: account.plan,
    freeAccess: hasFreeAccess(account),
    subscription: sub ?? null,
  })
  if (state === 'exempt' || state === 'free' || state === 'dev_bypass') return { ok: true, seats, billed: false }
  if (state === 'not_configured') return { ok: false, seats, error: 'Team seat billing is not configured' }
  if (state === 'no_subscription' || !sub?.stripeSubscriptionId) {
    // Nothing to bill against; the seats are added when the account subscribes (see checkout)
    return { ok: true, seats, billed: false }
  }

  try {
    const stripe = getStripe()
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId)
    const seatPriceIds = getSeatPriceIds()
    const planItem = stripeSub.items.data.find(i => !seatPriceIds.includes(i.price.id)) ?? stripeSub.items.data[0]
    const seatPriceId = getSeatPriceId(seatInterval(planItem?.price.recurring?.interval))
    const changes = seatItemChanges(stripeSub.items.data, seatPriceIds, seatPriceId, seats)
    if (changes.length > 0) {
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        items: changes,
        proration_behavior: 'create_prorations',
      })
    }
    // The webhook mirrors this too; writing it now keeps the team page current
    await db.update(subscriptions).set({ seatQuantity: seats }).where(eq(subscriptions.accountId, accountId))
    return { ok: true, seats, billed: true }
  } catch (err) {
    console.error('[seats] sync failed:', err)
    return { ok: false, seats, error: 'Could not update the number of billed seats in Stripe' }
  }
}
