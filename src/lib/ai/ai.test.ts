import { describe, expect, it } from 'vitest'
import { fromAnthropicUsage, usageCostMicros } from './pricing'
import { allowanceState, monthlyAllowanceUsd, monthStart, nextMonthStart } from './allowance'
import { decryptApiKey, encryptApiKey, keyHint } from './key-crypto'

describe('pricing', () => {
  it('prices Opus 5.5 tokens and web searches', () => {
    const u = fromAnthropicUsage({
      input_tokens: 1_000_000, output_tokens: 100_000, cache_read_input_tokens: 500_000,
      cache_creation_input_tokens: 0, server_tool_use: { web_search_requests: 3 },
    })
    // $4 + $2 + $0.10 + 3 x $0.01
    expect(usageCostMicros('claude-opus-5-5', u)).toBe(6_130_000)
  })
  it('prices unknown models at the highest known rate', () => {
    expect(usageCostMicros('mystery', { ...fromAnthropicUsage(null), outputTokens: 1_000_000 })).toBe(25_000_000)
  })
})

describe('allowance', () => {
  it('adds add-on units and has no limit for exempt accounts', () => {
    expect(monthlyAllowanceUsd({ billingExempt: false, addonUnits: 0 })).toBe(5)
    expect(monthlyAllowanceUsd({ billingExempt: false, addonUnits: 2 })).toBe(25)
    expect(monthlyAllowanceUsd({ billingExempt: false, addonUnits: 99 })).toBe(105)
    expect(monthlyAllowanceUsd({ billingExempt: true, addonUnits: 0 })).toBeNull()
  })
  it('reports percent used and exhaustion', () => {
    const now = new Date('2026-11-13T12:00:00Z')
    expect(allowanceState(2_500_000, 5, now)).toMatchObject({ spentUsd: 2.5, percent: 50, exhausted: false, resetsAt: '2026-12-01T00:00:00.000Z' })
    expect(allowanceState(5_000_000, 5, now).exhausted).toBe(true)
    expect(allowanceState(9_000_000, null, now)).toMatchObject({ percent: 0, exhausted: false })
  })
  it('finds month bounds in UTC', () => {
    expect(monthStart(new Date('2026-12-31T23:59:00Z')).toISOString()).toBe('2026-12-01T00:00:00.000Z')
    expect(nextMonthStart(new Date('2026-12-31T23:59:00Z')).toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })
})

describe('key crypto', () => {
  const secret = 'a-long-random-test-secret-value'
  it('round-trips and uses a fresh IV each time', () => {
    const a = encryptApiKey('sk-ant-123', secret)
    expect(a).not.toBe(encryptApiKey('sk-ant-123', secret))
    expect(decryptApiKey(a, secret)).toBe('sk-ant-123')
  })
  it('fails with the wrong secret', () => {
    expect(() => decryptApiKey(encryptApiKey('sk-1', secret), 'another-long-secret-value')).toThrow()
  })
  it('hints the last four characters', () => expect(keyHint(' sk-abcd1234 ')).toBe('1234'))
})
