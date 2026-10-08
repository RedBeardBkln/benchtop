import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import Stripe from 'stripe'

// Webhook signature / configuration behaviour that needs no database: the DB module is replaced
// with a stub whose transaction is observable, so we can prove a rejected request never reaches it.
const tx = vi.hoisted(() => ({ calls: 0 }))
vi.mock('@/lib/db', () => ({
  db: {
    transaction: async () => {
      tx.calls++
    },
  },
}))

import { POST } from '@/app/api/stripe/webhook/route'

const SECRET = 'whsec_unit_test_secret'
const stripe = new Stripe('sk_test_unit')
const payload = JSON.stringify({
  id: 'evt_unit_1',
  object: 'event',
  type: 'some.unknown.type',
  created: 1_700_000_000,
  data: { object: {} },
})

function req(body: string, signature?: string) {
  const headers: Record<string, string> = {}
  if (signature !== undefined) headers['stripe-signature'] = signature
  return new NextRequest('http://localhost/api/stripe/webhook', { method: 'POST', body, headers })
}
const sign = (body: string, secret = SECRET) => stripe.webhooks.generateTestHeaderString({ payload: body, secret })

describe('POST /api/stripe/webhook (signature handling)', () => {
  const saved = { ...process.env }
  beforeEach(() => {
    tx.calls = 0
    process.env.STRIPE_SECRET_KEY = 'sk_test_unit'
    process.env.STRIPE_PRICE_ID = 'price_unit'
    process.env.STRIPE_WEBHOOK_SECRET = SECRET
  })
  afterEach(() => {
    process.env = { ...saved }
  })

  it('returns 503 billing_not_configured when the webhook secret is missing', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    const res = await POST(req(payload, sign(payload)))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('billing_not_configured')
    expect(tx.calls).toBe(0)
  })

  it('returns 503 when no Stripe env vars are set at all', async () => {
    delete process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_PRICE_ID
    delete process.env.STRIPE_WEBHOOK_SECRET
    const res = await POST(req(payload, sign(payload)))
    expect(res.status).toBe(503)
    expect(tx.calls).toBe(0)
  })

  it('returns 400 and never touches the DB for a missing signature', async () => {
    const res = await POST(req(payload))
    expect(res.status).toBe(400)
    expect(tx.calls).toBe(0)
  })

  it.each([
    ['garbage header', () => 'not-a-signature'],
    ['signed with the wrong secret', () => sign(payload, 'whsec_other')],
    ['body altered after signing', () => sign(payload + ' ')],
    ['stale timestamp', () => stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET, timestamp: Math.floor(Date.now() / 1000) - 3600 })],
  ])('returns 400 and never touches the DB: %s', async (_name, makeSig) => {
    const res = await POST(req(payload, makeSig()))
    expect(res.status).toBe(400)
    expect(tx.calls).toBe(0)
  })

  it('a correctly signed event is accepted and handed to the idempotent transaction exactly once', async () => {
    const res = await POST(req(payload, sign(payload)))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true })
    expect(tx.calls).toBe(1)
  })
})
