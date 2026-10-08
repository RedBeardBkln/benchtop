import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Regression for D1: replaying an OLD checkout session id through POST /api/billing/sync must not
// replace a newer, access-granting subscription row, and must never stamp writes with "now".
// Everything at the edges (auth context, Stripe, the DB write) is replaced; the route handler and
// the pure decision helper are the real ones.
const h = vi.hoisted(() => ({
  ctx: null as unknown,
  session: null as unknown,
  apply: vi.fn(async (..._args: unknown[]) => true),
}))

vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/auth/context', () => ({
  requireApi: async () => ({ ok: true, ctx: h.ctx }),
}))
vi.mock('@/lib/billing/stripe', () => ({
  isBillingConfigured: () => true,
  billingNotConfiguredResponse: () => new Response(null, { status: 503 }),
  getStripe: () => ({ checkout: { sessions: { retrieve: async () => h.session } } }),
}))
vi.mock('@/lib/billing/sync', async () => {
  const actual = await vi.importActual<typeof import('@/lib/billing/subscription-map')>('@/lib/billing/subscription-map')
  return { canCheckoutReturnReplace: actual.canCheckoutReturnReplace, applySubscription: h.apply }
})

import { POST } from '@/app/api/billing/sync/route'
import { canCheckoutReturnReplace } from '@/lib/billing/subscription-map'

const ACCOUNT = '11111111-1111-4111-8111-111111111111'

function ctxWith(subscription: { stripeSubscriptionId: string | null; status: string } | null) {
  return { account: { id: ACCOUNT, stripeCustomerId: 'cus_1' }, subscription }
}
function sessionFor(subId: string, status: string, created: number) {
  return {
    id: 'cs_old',
    created,
    client_reference_id: ACCOUNT,
    customer: 'cus_1',
    subscription: { id: subId, status, items: { data: [{ price: { id: 'price_1' }, current_period_end: 9_999_999_999 }] } },
  }
}
function call() {
  return POST(
    new NextRequest('http://localhost/api/billing/sync', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'cs_old' }),
      headers: { 'content-type': 'application/json' },
    }),
  )
}

describe('POST /api/billing/sync (replayed / old session ids)', () => {
  beforeEach(() => {
    ;h.apply.mockClear()
    ;h.apply.mockResolvedValue(true)
  })

  it('does not replace an active row for a different subscription (the D1 replay)', async () => {
    h.ctx = ctxWith({ stripeSubscriptionId: 'sub_new', status: 'active' })
    h.session = sessionFor('sub_old', 'canceled', 1000)
    const res = await call()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ synced: false, reason: 'stale_session' })
    expect(h.apply).not.toHaveBeenCalled()
  })

  it.each(['active', 'trialing', 'past_due'])('also protects a %s row', async status => {
    h.ctx = ctxWith({ stripeSubscriptionId: 'sub_new', status })
    h.session = sessionFor('sub_old', 'active', 1000)
    await call()
    expect(h.apply).not.toHaveBeenCalled()
  })

  it('stamps the write with the session time (never "now") and requests the checkout-return guard', async () => {
    h.ctx = ctxWith(null)
    h.session = sessionFor('sub_1', 'active', 1234)
    const before = Math.floor(Date.now() / 1000)
    const res = await call()
    expect(await res.json()).toEqual({ synced: true, status: 'active' })
    expect(h.apply).toHaveBeenCalledTimes(1)
    const [accountId, , stamp, opts] = h.apply.mock.calls[0]
    expect(accountId).toBe(ACCOUNT)
    expect(stamp).toBe(1234)
    expect(stamp).toBeLessThan(before)
    expect(opts).toEqual({ checkoutReturn: true })
  })

  it('still lets a resubscribe replace a row that grants no access', async () => {
    h.ctx = ctxWith({ stripeSubscriptionId: 'sub_old', status: 'canceled' })
    h.session = sessionFor('sub_new', 'active', 5000)
    const res = await call()
    expect(await res.json()).toEqual({ synced: true, status: 'active' })
    expect(h.apply).toHaveBeenCalledTimes(1)
  })

  it('refreshes the subscription already tracked', async () => {
    h.ctx = ctxWith({ stripeSubscriptionId: 'sub_1', status: 'active' })
    h.session = sessionFor('sub_1', 'active', 5000)
    await call()
    expect(h.apply).toHaveBeenCalledTimes(1)
  })

  it('reports stale_session when the atomic SQL guard declines the write', async () => {
    ;h.apply.mockResolvedValue(false)
    h.ctx = ctxWith(null)
    h.session = sessionFor('sub_1', 'active', 10)
    expect(await (await call()).json()).toEqual({ synced: false, reason: 'stale_session', status: 'active' })
  })
})

describe('canCheckoutReturnReplace', () => {
  it.each([
    [null, true],
    [{ stripeSubscriptionId: 'sub_x', status: 'active' }, true],
    [{ stripeSubscriptionId: 'sub_y', status: 'active' }, false],
    [{ stripeSubscriptionId: 'sub_y', status: 'trialing' }, false],
    [{ stripeSubscriptionId: 'sub_y', status: 'past_due' }, false],
    [{ stripeSubscriptionId: 'sub_y', status: 'canceled' }, true],
    [{ stripeSubscriptionId: 'sub_y', status: 'incomplete_expired' }, true],
    [{ stripeSubscriptionId: null, status: 'unpaid' }, true],
  ])('existing %j -> %s (incoming sub_x)', (existing, expected) => {
    expect(canCheckoutReturnReplace(existing, 'sub_x')).toBe(expected)
  })
})
