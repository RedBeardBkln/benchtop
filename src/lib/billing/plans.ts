// Pure plan rules for accounts created from a platform-admin invitation. No imports on purpose,
// like entitlement.ts, so it is safe in any runtime and trivially unit-testable.

export const ACCOUNT_PLANS = ['paid', 'free_lifetime', 'free_period'] as const
export type AccountPlan = (typeof ACCOUNT_PLANS)[number]

// Every paid subscriber starts with this many free days from signup
export const PAID_TRIAL_DAYS = 60
// A free period must be longer than the paid trial, otherwise it is just a trial
export const MIN_FREE_PERIOD_DAYS = PAID_TRIAL_DAYS + 1
export const MAX_FREE_PERIOD_DAYS = 3650

export const PLAN_LABELS: Record<AccountPlan, string> = {
  paid: 'Paid subscriber',
  free_lifetime: 'Free for life',
  free_period: 'Free for a set time',
}

const DAY_MS = 24 * 60 * 60 * 1000

export function asAccountPlan(value: string | null | undefined): AccountPlan {
  return (ACCOUNT_PLANS as readonly string[]).includes(value ?? '') ? (value as AccountPlan) : 'paid'
}

// When the free access of a new account ends: the paid trial, the chosen free period, or never
export function freeUntilFor(plan: AccountPlan, freeDays: number | null | undefined, now: Date): Date | null {
  if (plan === 'free_lifetime') return null
  const days = plan === 'free_period' ? Math.max(freeDays ?? MIN_FREE_PERIOD_DAYS, MIN_FREE_PERIOD_DAYS) : PAID_TRIAL_DAYS
  return new Date(now.getTime() + days * DAY_MS)
}

// Is the account inside its free access (for life, or before free_until)?
export function hasFreeAccess(
  account: { plan: string; freeUntil: Date | null },
  now: Date = new Date(),
): boolean {
  if (account.plan === 'free_lifetime') return true
  return account.freeUntil != null && account.freeUntil.getTime() > now.getTime()
}

// Stripe needs a trial end at least 48 hours out. A subscription started during free access is
// not charged until the free access ends; closer than that, billing simply starts now.
export function checkoutTrialEnd(
  account: { plan: string; freeUntil: Date | null },
  now: Date = new Date(),
): number | undefined {
  if (account.plan === 'free_lifetime' || !account.freeUntil) return undefined
  if (account.freeUntil.getTime() - now.getTime() < 2 * DAY_MS + 60 * 60 * 1000) return undefined
  return Math.floor(account.freeUntil.getTime() / 1000)
}

export function describePlan(plan: AccountPlan, freeDays?: number | null): string {
  if (plan === 'free_lifetime') return 'Free for life'
  if (plan === 'free_period') return `Free for ${freeDays ?? MIN_FREE_PERIOD_DAYS} days, then a paid subscription`
  return `Paid subscription with a ${PAID_TRIAL_DAYS}-day free trial`
}

// Highest cap the admin can set on a free-for-life account's additional users
export const MAX_USER_CAP = 1000

// The cap on additional users (besides the owner), or null when there is none. Only free-for-life
// accounts are capped; every other account pays for its seats.
export function userCap(account: { plan: string; maxUsers: number | null }): number | null {
  return account.plan === 'free_lifetime' && account.maxUsers != null ? account.maxUsers : null
}

// Would one more user go over the cap? `used` counts current additional users plus pending invites.
export function capReached(cap: number | null, used: number): boolean {
  return cap != null && used >= cap
}
