import { describe, expect, it } from 'vitest'
import { createInviteSchema, profileSchema, redeemSchema } from './account-schemas'

describe('profileSchema', () => {
  it('trims, and turns blanks into null', () => {
    const r = profileSchema.parse({ fullName: '  Ada Lovelace  ', company: '   ', jobTitle: '', phone: '', timezone: '' })
    expect(r).toEqual({ fullName: 'Ada Lovelace', company: null, jobTitle: null, phone: null, timezone: null })
  })

  it('accepts unicode names', () => {
    expect(profileSchema.parse({ fullName: 'Zoë Müller-Åström 李雷' }).fullName).toBe('Zoë Müller-Åström 李雷')
  })

  it('requires a full name (whitespace only fails)', () => {
    expect(profileSchema.safeParse({ fullName: '   ' }).success).toBe(false)
    expect(profileSchema.safeParse({}).success).toBe(false)
  })

  it('rejects over-long values', () => {
    expect(profileSchema.safeParse({ fullName: 'x'.repeat(121) }).success).toBe(false)
    expect(profileSchema.safeParse({ fullName: 'a', company: 'x'.repeat(121) }).success).toBe(false)
    expect(profileSchema.safeParse({ fullName: 'a', phone: '1'.repeat(31) }).success).toBe(false)
  })

  it('validates phone format', () => {
    expect(profileSchema.safeParse({ fullName: 'a', phone: '+1 (555) 123-4567' }).success).toBe(true)
    expect(profileSchema.safeParse({ fullName: 'a', phone: 'call me' }).success).toBe(false)
    expect(profileSchema.safeParse({ fullName: 'a', phone: '123' }).success).toBe(false)
  })

  it('validates IANA time zones', () => {
    expect(profileSchema.safeParse({ fullName: 'a', timezone: 'America/New_York' }).success).toBe(true)
    expect(profileSchema.safeParse({ fullName: 'a', timezone: 'UTC' }).success).toBe(true)
    expect(profileSchema.safeParse({ fullName: 'a', timezone: 'Mars/Olympus' }).success).toBe(false)
  })
})

const validRedeem = {
  token: 'x'.repeat(43),
  fullName: 'Ada',
  password: 'correct horse',
  acceptTerms: true as const,
}

describe('redeemSchema', () => {
  it('accepts a valid body and nulls a blank company', () => {
    const r = redeemSchema.parse({ ...validRedeem, company: '  ' })
    expect(r.company).toBeNull()
  })

  it('requires terms acceptance', () => {
    expect(redeemSchema.safeParse({ ...validRedeem, acceptTerms: false }).success).toBe(false)
    expect(redeemSchema.safeParse({ ...validRedeem, acceptTerms: undefined }).success).toBe(false)
  })

  it('enforces password length 8..128', () => {
    expect(redeemSchema.safeParse({ ...validRedeem, password: '1234567' }).success).toBe(false)
    expect(redeemSchema.safeParse({ ...validRedeem, password: '12345678' }).success).toBe(true)
    expect(redeemSchema.safeParse({ ...validRedeem, password: 'x'.repeat(129) }).success).toBe(false)
  })

  it('rejects huge or tiny tokens and missing names', () => {
    expect(redeemSchema.safeParse({ ...validRedeem, token: 'x'.repeat(201) }).success).toBe(false)
    expect(redeemSchema.safeParse({ ...validRedeem, token: 'short' }).success).toBe(false)
    expect(redeemSchema.safeParse({ ...validRedeem, fullName: '' }).success).toBe(false)
  })
})

describe('createInviteSchema', () => {
  it('normalizes email to lowercase and trims', () => {
    expect(createInviteSchema.parse({ email: '  Foo@Example.COM ' }).email).toBe('foo@example.com')
  })

  it('rejects bad emails and out-of-range expiry', () => {
    expect(createInviteSchema.safeParse({ email: 'nope' }).success).toBe(false)
    expect(createInviteSchema.safeParse({ email: 'a@b.co', expiresInDays: 0 }).success).toBe(false)
    expect(createInviteSchema.safeParse({ email: 'a@b.co', expiresInDays: 61 }).success).toBe(false)
    expect(createInviteSchema.safeParse({ email: 'a@b.co', expiresInDays: 30 }).success).toBe(true)
  })
})
