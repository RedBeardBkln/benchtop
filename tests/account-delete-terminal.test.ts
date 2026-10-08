import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Regression for D4: account deletion must not call Stripe's cancel for subscriptions that are
// already terminal (canceled / incomplete_expired), and must still call it for live ones.
const h = vi.hoisted(() => ({
  ctx: null as unknown,
  cancel: vi.fn(async (..._a: unknown[]) => ({})),
}))

// Any query chain resolves to an empty result set.
function chain(): unknown {
  const target = () => undefined
  return new Proxy(target, {
    get(_t, prop) {
      if (prop === 'then') return (resolve: (v: unknown[]) => void) => resolve([])
      return () => chain()
    },
    apply() {
      return chain()
    },
  })
}
vi.mock('@/lib/db', () => ({
  db: {
    select: () => chain(),
    transaction: async (fn: (tx: unknown) => Promise<void>) => fn(chain()),
  },
}))
vi.mock('@/lib/auth/context', () => ({ requireApi: async () => ({ ok: true, ctx: h.ctx }) }))
vi.mock('@/lib/billing/stripe', () => ({
  BillingNotConfiguredError: class extends Error {},
  isBillingConfigured: () => true,
  getStripe: () => ({ subscriptions: { cancel: h.cancel } }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  DOCS_BUCKET: 'docs',
  isAdminConfigured: () => true,
  getSupabaseAdmin: () => ({
    storage: { from: () => ({ remove: async () => ({ error: null }) }) },
    auth: { admin: { deleteUser: async () => ({ error: null }) } },
  }),
}))

import { DELETE } from '@/app/api/account/route'

function ctxWith(subscription: { stripeSubscriptionId: string | null; status: string } | null) {
  return {
    user: { id: 'u1', email: 'owner@example.com' },
    account: { id: '11111111-1111-4111-8111-111111111111', billingExempt: false },
    subscription,
  }
}
function del() {
  return DELETE(
    new NextRequest('http://localhost/api/account', {
      method: 'DELETE',
      body: JSON.stringify({ confirmEmail: 'owner@example.com' }),
      headers: { 'content-type': 'application/json' },
    }),
  )
}

describe('DELETE /api/account and Stripe cancel', () => {
  beforeEach(() => h.cancel.mockClear())

  it.each(['canceled', 'incomplete_expired'])('does not call Stripe cancel for a %s subscription and deletes', async status => {
    h.ctx = ctxWith({ stripeSubscriptionId: 'sub_1', status })
    const res = await del()
    expect(res.status).toBe(200)
    expect(h.cancel).not.toHaveBeenCalled()
  })

  it.each(['active', 'past_due', 'unpaid'])('still cancels a %s subscription', async status => {
    h.ctx = ctxWith({ stripeSubscriptionId: 'sub_1', status })
    const res = await del()
    expect(res.status).toBe(200)
    expect(h.cancel).toHaveBeenCalledWith('sub_1')
  })

  it('keeps refusing (502, nothing deleted) when the cancel of a live subscription fails', async () => {
    h.cancel.mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 'api_error' }))
    h.ctx = ctxWith({ stripeSubscriptionId: 'sub_1', status: 'active' })
    const res = await del()
    expect(res.status).toBe(502)
  })
})
