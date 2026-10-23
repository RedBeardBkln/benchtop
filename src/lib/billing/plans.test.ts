import { describe, expect, it } from 'vitest'
import {
  asAccountPlan, capReached, checkoutTrialEnd, describePlan, freeUntilFor, hasFreeAccess, MIN_FREE_PERIOD_DAYS, PAID_TRIAL_DAYS, userCap,
} from './plans'

const DAY = 24 * 60 * 60 * 1000
const now = new Date('2026-10-23T12:00:00Z')

describe('freeUntilFor', () => {
  it('gives paid subscribers the trial', () => {
    expect(freeUntilFor('paid', null, now)!.getTime()).toBe(now.getTime() + PAID_TRIAL_DAYS * DAY)
  })
  it('never ends for free for life', () => {
    expect(freeUntilFor('free_lifetime', 400, now)).toBeNull()
  })
  it('uses the chosen free period, never shorter than the minimum', () => {
    expect(freeUntilFor('free_period', 365, now)!.getTime()).toBe(now.getTime() + 365 * DAY)
    expect(freeUntilFor('free_period', 10, now)!.getTime()).toBe(now.getTime() + MIN_FREE_PERIOD_DAYS * DAY)
  })
})

describe('hasFreeAccess', () => {
  it('is always true for free for life', () => {
    expect(hasFreeAccess({ plan: 'free_lifetime', freeUntil: null }, now)).toBe(true)
  })
  it('is true only before free_until', () => {
    expect(hasFreeAccess({ plan: 'paid', freeUntil: new Date(now.getTime() + DAY) }, now)).toBe(true)
    expect(hasFreeAccess({ plan: 'free_period', freeUntil: new Date(now.getTime() - 1) }, now)).toBe(false)
    expect(hasFreeAccess({ plan: 'paid', freeUntil: null }, now)).toBe(false)
  })
})

describe('checkoutTrialEnd', () => {
  it('defers billing to the end of free access', () => {
    const until = new Date(now.getTime() + 30 * DAY)
    expect(checkoutTrialEnd({ plan: 'paid', freeUntil: until }, now)).toBe(Math.floor(until.getTime() / 1000))
  })
  it('starts billing now when free access is over or about to end', () => {
    expect(checkoutTrialEnd({ plan: 'paid', freeUntil: new Date(now.getTime() + DAY) }, now)).toBeUndefined()
    expect(checkoutTrialEnd({ plan: 'paid', freeUntil: null }, now)).toBeUndefined()
  })
})

describe('asAccountPlan / describePlan', () => {
  it('falls back to paid', () => {
    expect(asAccountPlan('bogus')).toBe('paid')
    expect(asAccountPlan(null)).toBe('paid')
    expect(asAccountPlan('free_period')).toBe('free_period')
  })
  it('describes each plan', () => {
    expect(describePlan('paid')).toMatch(/60-day free trial/)
    expect(describePlan('free_period', 180)).toMatch(/180 days/)
    expect(describePlan('free_lifetime')).toBe('Free for life')
  })
})

describe('userCap / capReached', () => {
  it('caps only free-for-life accounts that have a cap', () => {
    expect(userCap({ plan: 'free_lifetime', maxUsers: 3 })).toBe(3)
    expect(userCap({ plan: 'free_lifetime', maxUsers: null })).toBeNull()
    expect(userCap({ plan: 'paid', maxUsers: 3 })).toBeNull()
  })
  it('is reached once used meets the cap', () => {
    expect(capReached(2, 1)).toBe(false)
    expect(capReached(2, 2)).toBe(true)
    expect(capReached(0, 0)).toBe(true)
    expect(capReached(null, 99)).toBe(false)
  })
})
