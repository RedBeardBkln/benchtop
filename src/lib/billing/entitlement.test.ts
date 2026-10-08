import { describe, expect, it } from 'vitest'
import { ENTITLED_STATUSES, isDevBypassActive, isEntitled, needsStripeCancel } from './entitlement'

const ALL_STATUSES = [
  'active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused',
]

describe('isEntitled', () => {
  it.each(ALL_STATUSES)('non-exempt account with status %s', status => {
    const expected = ['active', 'trialing', 'past_due'].includes(status)
    expect(isEntitled({ billingExempt: false, status })).toBe(expected)
  })

  it.each(ALL_STATUSES)('exempt account is always entitled (status %s)', status => {
    expect(isEntitled({ billingExempt: true, status })).toBe(true)
  })

  it('no subscription: exempt yes, non-exempt no', () => {
    expect(isEntitled({ billingExempt: true, status: null })).toBe(true)
    expect(isEntitled({ billingExempt: false, status: null })).toBe(false)
    expect(isEntitled({ billingExempt: false })).toBe(false)
  })

  it('unknown statuses do not grant access', () => {
    expect(isEntitled({ billingExempt: false, status: 'something_new' })).toBe(false)
    expect(isEntitled({ billingExempt: false, status: '' })).toBe(false)
  })

  it('past_due keeps access (documented assumption)', () => {
    expect(ENTITLED_STATUSES).toContain('past_due')
  })

  it('dev bypass grants access', () => {
    expect(isEntitled({ billingExempt: false, status: null, devBypass: true })).toBe(true)
  })
})

describe('isDevBypassActive', () => {
  it('is on only when BILLING_DEV_BYPASS=true outside production', () => {
    expect(isDevBypassActive({ BILLING_DEV_BYPASS: 'true', NODE_ENV: 'development' })).toBe(true)
    expect(isDevBypassActive({ BILLING_DEV_BYPASS: 'true', NODE_ENV: 'test' })).toBe(true)
    expect(isDevBypassActive({ BILLING_DEV_BYPASS: 'true' })).toBe(true)
  })

  it('is ignored in production', () => {
    expect(isDevBypassActive({ BILLING_DEV_BYPASS: 'true', NODE_ENV: 'production' })).toBe(false)
  })

  it('is off unless exactly "true"', () => {
    expect(isDevBypassActive({ NODE_ENV: 'development' })).toBe(false)
    expect(isDevBypassActive({ BILLING_DEV_BYPASS: '1', NODE_ENV: 'development' })).toBe(false)
    expect(isDevBypassActive({ BILLING_DEV_BYPASS: 'TRUE', NODE_ENV: 'development' })).toBe(false)
    expect(isDevBypassActive({ BILLING_DEV_BYPASS: 'false', NODE_ENV: 'development' })).toBe(false)
  })
})

describe('needsStripeCancel (account deletion)', () => {
  it.each([
    ['active', true],
    ['trialing', true],
    ['past_due', true],
    ['unpaid', true],
    ['incomplete', true],
    ['paused', true],
    ['canceled', false],
    ['incomplete_expired', false],
  ])('stored status %s -> %s', (status, expected) => {
    expect(needsStripeCancel({ stripeSubscriptionId: 'sub_1', status })).toBe(expected)
  })
  it('is false with no subscription or no stripe id', () => {
    expect(needsStripeCancel(null)).toBe(false)
    expect(needsStripeCancel(undefined)).toBe(false)
    expect(needsStripeCancel({ stripeSubscriptionId: null, status: 'active' })).toBe(false)
  })
})
