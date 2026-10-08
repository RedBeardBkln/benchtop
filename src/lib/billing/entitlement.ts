// Pure access rule: is an account allowed to use the app right now?
// No imports on purpose, so it is trivially unit-testable and safe in any runtime.

// Stripe statuses that keep access. `past_due` keeps access while Stripe retries the payment
// (the billing page shows a banner). Everything else (canceled, unpaid, incomplete,
// incomplete_expired, paused, no subscription) does not.
export const ENTITLED_STATUSES: readonly string[] = ['active', 'trialing', 'past_due']

export function isEntitled(input: {
  billingExempt: boolean
  status?: string | null
  // Dev-only escape hatch; only ever true via isDevBypassActive()
  devBypass?: boolean
}): boolean {
  if (input.billingExempt) return true
  if (input.devBypass) return true
  return input.status != null && ENTITLED_STATUSES.includes(input.status)
}

// BILLING_DEV_BYPASS=true lets developers exercise the app without Stripe, but is ignored
// entirely in production builds.
export function isDevBypassActive(env: Record<string, string | undefined> = process.env): boolean {
  return env.BILLING_DEV_BYPASS === 'true' && env.NODE_ENV !== 'production'
}

// Statuses from which a Stripe subscription can never come back; there is nothing left to cancel
// (Stripe refuses to cancel them), so account deletion must not depend on a cancel call.
export const TERMINAL_STATUSES: readonly string[] = ['canceled', 'incomplete_expired']

export function needsStripeCancel(sub: { stripeSubscriptionId: string | null; status: string } | null | undefined): boolean {
  return Boolean(sub?.stripeSubscriptionId) && !TERMINAL_STATUSES.includes(sub!.status)
}
