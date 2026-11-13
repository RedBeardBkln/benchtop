// The AI each team may use on the platform's key per calendar month (UTC), in US dollars of
// list-price usage. A team on its own key has no limit. Pure, so it is unit-testable.
// The add-on is an extra item on the subscription, like team seats; its Stripe prices are
// STRIPE_AI_PRICE_MONTHLY_ID / STRIPE_AI_PRICE_YEARLY_ID and must match AI_ADDON.price.

export const AI_INCLUDED_USD = 5

export const AI_ADDON = {
  /** Extra monthly allowance each unit adds */
  usdPerUnit: 10,
  /** What a unit costs */
  price: { month: 15, year: 150 },
  maxUnits: 10,
} as const

/** null = no limit (internal billing-exempt accounts) */
export function monthlyAllowanceUsd(a: { billingExempt: boolean; addonUnits: number }): number | null {
  if (a.billingExempt) return null
  return AI_INCLUDED_USD + Math.max(0, Math.min(a.addonUnits, AI_ADDON.maxUnits)) * AI_ADDON.usdPerUnit
}

export function monthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export function nextMonthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
}

export type AllowanceState = {
  spentUsd: number
  allowanceUsd: number | null
  /** 0–100, rounded down; 0 when there is no limit */
  percent: number
  exhausted: boolean
  resetsAt: string
}

export function allowanceState(spentMicros: number, allowanceUsd: number | null, now: Date = new Date()): AllowanceState {
  const spentUsd = spentMicros / 1_000_000
  const percent = allowanceUsd ? Math.min(100, Math.floor((spentUsd / allowanceUsd) * 100)) : 0
  return {
    spentUsd: Math.round(spentUsd * 100) / 100,
    allowanceUsd,
    percent,
    exhausted: allowanceUsd != null && spentUsd >= allowanceUsd,
    resetsAt: nextMonthStart(now).toISOString(),
  }
}
