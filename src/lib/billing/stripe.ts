import Stripe from 'stripe'
import { NextResponse } from 'next/server'

type Env = Record<string, string | undefined>

// Billing is "configured" when the secret key and price are present. The webhook route
// additionally needs STRIPE_WEBHOOK_SECRET.
export function isBillingConfigured(env: Env = process.env): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID)
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

export function getPriceId(): string {
  const id = process.env.STRIPE_PRICE_ID
  if (!id) throw new BillingNotConfiguredError()
  return id
}

export function billingNotConfiguredResponse() {
  return NextResponse.json(
    { error: 'Billing is not configured in this environment', code: 'billing_not_configured' },
    { status: 503 },
  )
}
