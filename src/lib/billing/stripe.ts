import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import type { SeatInterval } from './seats'

type Env = Record<string, string | undefined>

// Billing is "configured" when the secret key and both plan prices (monthly and yearly) are
// present. The webhook route additionally needs STRIPE_WEBHOOK_SECRET.
export function isBillingConfigured(env: Env = process.env): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PLAN_PRICE_MONTHLY_ID && env.STRIPE_PLAN_PRICE_YEARLY_ID)
}

export function isWebhookConfigured(env: Env = process.env): boolean {
  return isBillingConfigured(env) && Boolean(env.STRIPE_WEBHOOK_SECRET)
}

export class BillingNotConfiguredError extends Error {
  constructor() {
    super('Billing is not configured in this environment')
    this.name = 'BillingNotConfiguredError'
  }
}

let cached: Stripe | null = null

// Lazy: never constructed at import time, so `next build` works without any Stripe env vars.
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new BillingNotConfiguredError()
  if (!cached) cached = new Stripe(key)
  return cached
}

export function getPlanPriceId(interval: SeatInterval, env: Env = process.env): string {
  const id = interval === 'year' ? env.STRIPE_PLAN_PRICE_YEARLY_ID : env.STRIPE_PLAN_PRICE_MONTHLY_ID
  if (!id) throw new BillingNotConfiguredError()
  return id
}

/** The interval of a subscription's plan price: yearly if it is the yearly plan price, else monthly. */
export function planIntervalForPrice(priceId: string | null | undefined, env: Env = process.env): SeatInterval {
  return priceId && priceId === env.STRIPE_PLAN_PRICE_YEARLY_ID ? 'year' : 'month'
}

// Extra team seats: one price per plan interval, since every item on a Stripe subscription must
// share its billing interval. See SEAT_PRICE_USD for the amounts.
export function isSeatBillingConfigured(env: Env = process.env): boolean {
  return isBillingConfigured(env) && Boolean(env.STRIPE_SEAT_PRICE_MONTHLY_ID && env.STRIPE_SEAT_PRICE_YEARLY_ID)
}

export function getSeatPriceIds(env: Env = process.env): string[] {
  return [env.STRIPE_SEAT_PRICE_MONTHLY_ID, env.STRIPE_SEAT_PRICE_YEARLY_ID].filter((v): v is string => Boolean(v))
}

export function getSeatPriceId(interval: 'month' | 'year', env: Env = process.env): string {
  const id = interval === 'year' ? env.STRIPE_SEAT_PRICE_YEARLY_ID : env.STRIPE_SEAT_PRICE_MONTHLY_ID
  if (!id) throw new BillingNotConfiguredError()
  return id
}

export function billingNotConfiguredResponse() {
  return NextResponse.json(
    { error: 'Billing is not configured in this environment', code: 'billing_not_configured' },
    { status: 503 },
  )
}
