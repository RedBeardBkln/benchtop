import { describe, expect, it } from 'vitest'
import { customerIdOf, mapSubscription, shouldApplyEvent } from './subscription-map'

describe('mapSubscription', () => {
  it('reads current_period_end and price from the subscription ITEM (current Stripe API)', () => {
    const m = mapSubscription({
      id: 'sub_1',
      status: 'active',
      cancel_at_period_end: false,
      items: { data: [{ current_period_end: 1_800_000_000, price: { id: 'price_1' } }] },
    })
    expect(m).toEqual({
      stripeSubscriptionId: 'sub_1',
      status: 'active',
      priceId: 'price_1',
      currentPeriodEnd: new Date(1_800_000_000 * 1000),
      cancelAtPeriodEnd: false,
    })
  })

  it('falls back to the legacy subscription-level current_period_end', () => {
    const m = mapSubscription({ id: 'sub_2', status: 'trialing', current_period_end: 1_700_000_000 })
    expect(m.currentPeriodEnd).toEqual(new Date(1_700_000_000 * 1000))
    expect(m.priceId).toBeNull()
  })

  it('prefers the item value when both exist', () => {
    const m = mapSubscription({
      id: 'sub_3',
      status: 'active',
      current_period_end: 1,
      items: { data: [{ current_period_end: 2 }] },
    })
    expect(m.currentPeriodEnd).toEqual(new Date(2000))
  })

  it('handles a missing period end and cancel flag', () => {
    const m = mapSubscription({ id: 'sub_4', status: 'canceled', cancel_at_period_end: null, items: { data: [] } })
    expect(m.currentPeriodEnd).toBeNull()
    expect(m.cancelAtPeriodEnd).toBe(false)
  })

  it('maps cancel_at_period_end = true', () => {
    expect(mapSubscription({ id: 'sub_5', status: 'active', cancel_at_period_end: true }).cancelAtPeriodEnd).toBe(true)
  })
})

describe('shouldApplyEvent (out-of-order guard)', () => {
  it('applies when nothing has been applied yet', () => {
    expect(shouldApplyEvent(null, 100)).toBe(true)
    expect(shouldApplyEvent(undefined, 100)).toBe(true)
  })
  it('applies newer and same-second events', () => {
    expect(shouldApplyEvent(100, 101)).toBe(true)
    expect(shouldApplyEvent(100, 100)).toBe(true)
  })
  it('ignores older events', () => {
    expect(shouldApplyEvent(100, 99)).toBe(false)
  })
})

describe('customerIdOf', () => {
  it('handles string, expanded object and missing customer', () => {
    expect(customerIdOf({ id: 's', status: 'active', customer: 'cus_1' })).toBe('cus_1')
    expect(customerIdOf({ id: 's', status: 'active', customer: { id: 'cus_2' } })).toBe('cus_2')
    expect(customerIdOf({ id: 's', status: 'active' })).toBeNull()
  })
})
