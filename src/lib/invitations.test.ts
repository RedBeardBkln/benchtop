import { describe, expect, it } from 'vitest'
import {
  deriveStatus, failureReason, generateToken, hashToken, inviteExpiry, inviteUrl, normalizeEmail,
} from './invitations'

const now = new Date('2026-10-03T12:00:00Z')
const future = new Date('2026-10-10T12:00:00Z')
const past = new Date('2026-10-01T12:00:00Z')

describe('token generation and hashing', () => {
  it('generates 256-bit base64url tokens that are unique', () => {
    const a = generateToken()
    const b = generateToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(a).not.toBe(b)
  })

  it('hash is deterministic, hex SHA-256, and never equals the token', () => {
    const t = generateToken()
    expect(hashToken(t)).toBe(hashToken(t))
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken(t)).not.toContain(t)
    expect(hashToken(t)).not.toBe(hashToken(generateToken()))
  })

  it('matches a known SHA-256 vector', () => {
    expect(hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('deriveStatus / failureReason', () => {
  it('pending', () => {
    const inv = { acceptedAt: null, revokedAt: null, expiresAt: future }
    expect(deriveStatus(inv, now)).toBe('pending')
    expect(failureReason(inv, now)).toBeNull()
  })

  it('expired (including exactly at the expiry instant)', () => {
    expect(deriveStatus({ acceptedAt: null, revokedAt: null, expiresAt: past }, now)).toBe('expired')
    expect(deriveStatus({ acceptedAt: null, revokedAt: null, expiresAt: now }, now)).toBe('expired')
    expect(failureReason({ acceptedAt: null, revokedAt: null, expiresAt: past }, now)).toBe('expired')
  })

  it('revoked', () => {
    const inv = { acceptedAt: null, revokedAt: past, expiresAt: future }
    expect(deriveStatus(inv, now)).toBe('revoked')
    expect(failureReason(inv, now)).toBe('revoked')
  })

  it('accepted wins over revoked/expired and reports "used"', () => {
    const inv = { acceptedAt: past, revokedAt: past, expiresAt: past }
    expect(deriveStatus(inv, now)).toBe('accepted')
    expect(failureReason(inv, now)).toBe('used')
  })

  it('unknown invite is "invalid"', () => {
    expect(failureReason(null, now)).toBe('invalid')
    expect(failureReason(undefined, now)).toBe('invalid')
  })
})

describe('helpers', () => {
  it('normalizes email case and whitespace', () => {
    expect(normalizeEmail('  Foo@X.com ')).toBe('foo@x.com')
  })

  it('computes expiry in days', () => {
    expect(inviteExpiry(now, 7).toISOString()).toBe('2026-10-10T12:00:00.000Z')
    expect(inviteExpiry(now).toISOString()).toBe('2026-10-10T12:00:00.000Z')
  })

  it('builds the invite url without double slashes', () => {
    expect(inviteUrl('https://x.test/', 'tok')).toBe('https://x.test/invite/tok')
    expect(inviteUrl('https://x.test', 'tok')).toBe('https://x.test/invite/tok')
  })
})
