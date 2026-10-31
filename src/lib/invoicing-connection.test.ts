import { describe, expect, it } from 'vitest'
import { bearerKey, canUseInvoicingConnection, looksLikeConnectionKey, planBilledChange } from './invoicing-connection'

const KEY = 'btk_' + 'a'.repeat(43)
const A = '3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5a'
const B = '3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5b'
const C = '3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5c'
const D = '3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5d'

describe('invoicing connection allow-list', () => {
  it('only the listed login, any case', () => {
    expect(canUseInvoicingConnection('eric@launchtime.solutions')).toBe(true)
    expect(canUseInvoicingConnection(' Eric@LaunchTime.Solutions ')).toBe(true)
    expect(canUseInvoicingConnection('ekinniburgh@gmail.com')).toBe(false)
    expect(canUseInvoicingConnection(undefined)).toBe(false)
    expect(canUseInvoicingConnection('')).toBe(false)
  })
})

describe('connection keys', () => {
  it('checks the shape', () => {
    expect(looksLikeConnectionKey(KEY)).toBe(true)
    expect(looksLikeConnectionKey(KEY + 'a')).toBe(false)
    expect(looksLikeConnectionKey('sk_' + 'a'.repeat(43))).toBe(false)
  })

  it('reads a bearer header', () => {
    expect(bearerKey(`Bearer ${KEY}`)).toBe(KEY)
    expect(bearerKey(`bearer ${KEY}`)).toBe(KEY)
    expect(bearerKey(KEY)).toBeNull()
    expect(bearerKey('Bearer nope')).toBeNull()
    expect(bearerKey(null)).toBeNull()
  })
})

describe('planBilledChange', () => {
  const rows = [
    { id: A, billed: false, billedRef: null },
    { id: B, billed: true, billedRef: '3100' },
    { id: C, billed: true, billedRef: null }, // marked billed by hand
  ]

  it('marks unbilled entries; a retry on the same invoice is fine; other billing is a conflict', () => {
    expect(planBilledChange({ ids: [A, B, C, D, A], billed: true, invoice: '3100' }, rows)).toEqual({
      change: [A], unchanged: [B], conflicts: [C], missing: [D],
    })
    expect(planBilledChange({ ids: [B], billed: true, invoice: '3101' }, rows).conflicts).toEqual([B])
  })

  it('only unbills entries billed on that invoice', () => {
    expect(planBilledChange({ ids: [A, B, C], billed: false, invoice: '3100' }, rows)).toEqual({
      change: [B], unchanged: [A], conflicts: [C], missing: [],
    })
  })
})
